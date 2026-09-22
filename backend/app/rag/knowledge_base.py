from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.config import (
    ALLOWED_UPLOAD_EXTENSIONS,
    CHAR_TFIDF_WEIGHT,
    KNOWLEDGE_DIR,
    MIN_RELEVANCE,
    RUNTIME_UPLOAD_DIR,
    TOP_K,
    WORD_TFIDF_WEIGHT,
)
from app.rag.chunker import chunk_records
from app.rag.loaders import load_document
from app.services.cache import answer_cache


def _safe_filename(name: str) -> str:
    base = Path(name).name
    stem = re.sub(r"[^A-Za-z0-9._ -]+", "_", Path(base).stem).strip(" ._") or "document"
    suffix = Path(base).suffix.lower()
    return f"{stem}{suffix}"


def _doc_id(origin: str, path: Path) -> str:
    return f"{origin}:{path.name}"


class KnowledgeBase:
    def __init__(self) -> None:
        self.word_vectorizer = TfidfVectorizer(
            lowercase=True,
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True,
            max_features=18000,
        )
        self.char_vectorizer = TfidfVectorizer(
            lowercase=True,
            analyzer="char_wb",
            ngram_range=(3, 5),
            sublinear_tf=True,
            max_features=22000,
        )
        self.records: list[dict[str, Any]] = []
        self.documents: list[dict[str, Any]] = []
        self.word_matrix = None
        self.char_matrix = None
        self.version = 0
        self.reload()

    def _paths(self) -> list[tuple[str, Path]]:
        core = [("core", path) for path in sorted(KNOWLEDGE_DIR.glob("*.md"))]
        runtime = [
            ("runtime", path)
            for path in sorted(RUNTIME_UPLOAD_DIR.iterdir())
            if path.is_file() and path.suffix.lower() in ALLOWED_UPLOAD_EXTENSIONS
        ]
        return core + runtime

    def reload(self) -> None:
        all_records: list[dict[str, Any]] = []
        docs: list[dict[str, Any]] = []

        for origin, path in self._paths():
            try:
                loaded = load_document(path, origin=origin)
                chunks = chunk_records(loaded)
            except Exception as exc:
                docs.append({
                    "id": _doc_id(origin, path),
                    "name": path.name,
                    "display_name": path.stem.replace("_", " ").title(),
                    "origin": origin,
                    "type": path.suffix.lower().lstrip("."),
                    "chunks": 0,
                    "status": "error",
                    "error": str(exc),
                })
                continue

            for chunk in chunks:
                chunk["document_id"] = _doc_id(origin, path)
            all_records.extend(chunks)
            docs.append({
                "id": _doc_id(origin, path),
                "name": path.name,
                "display_name": chunks[0]["document"] if chunks else path.stem.replace("_", " ").title(),
                "origin": origin,
                "type": path.suffix.lower().lstrip("."),
                "chunks": len(chunks),
                "status": "ready" if chunks else "empty",
            })

        self.records = all_records
        self.documents = docs
        texts = [r["text"] for r in all_records]
        if texts:
            self.word_matrix = self.word_vectorizer.fit_transform(texts)
            self.char_matrix = self.char_vectorizer.fit_transform(texts)
        else:
            self.word_matrix = None
            self.char_matrix = None
        self.version += 1
        answer_cache.clear()

    def search(self, query: str, top_k: int = TOP_K, min_score: float = MIN_RELEVANCE) -> list[dict[str, Any]]:
        if not self.records or self.word_matrix is None or self.char_matrix is None:
            return []

        word_q = self.word_vectorizer.transform([query])
        char_q = self.char_vectorizer.transform([query])
        word_scores = cosine_similarity(word_q, self.word_matrix).flatten()
        char_scores = cosine_similarity(char_q, self.char_matrix).flatten()
        scores = WORD_TFIDF_WEIGHT * word_scores + CHAR_TFIDF_WEIGHT * char_scores

        # Lightweight lexical boosts make headings and policy titles matter more.
        query_terms = {t for t in re.findall(r"[a-z0-9]+", query.lower()) if len(t) > 2}
        boosts = np.zeros(len(self.records), dtype=float)
        for idx, record in enumerate(self.records):
            title = (record.get("document") or "").lower()
            section = (record.get("section") or "").lower()
            title_hits = sum(1 for term in query_terms if term in title)
            section_hits = sum(1 for term in query_terms if term in section)
            boosts[idx] = min(0.14, title_hits * 0.08 + section_hits * 0.02)
        scores = scores + boosts

        ranked = scores.argsort()[::-1]
        output: list[dict[str, Any]] = []
        for idx in ranked[: max(top_k * 4, 12)]:
            score = float(scores[int(idx)])
            if score < min_score:
                continue
            item = dict(self.records[int(idx)])
            item["score"] = min(score, 1.0)
            output.append(item)
            if len(output) >= top_k:
                break
        return output

    def add_upload(self, filename: str, data: bytes) -> dict[str, Any]:
        safe = _safe_filename(filename)
        suffix = Path(safe).suffix.lower()
        if suffix not in ALLOWED_UPLOAD_EXTENSIONS:
            raise ValueError("Supported file types: PDF, DOCX, TXT, Markdown and Excel (XLSX/XLS)")

        unique = f"{uuid.uuid4().hex[:8]}_{safe}"
        path = RUNTIME_UPLOAD_DIR / unique
        path.write_bytes(data)
        try:
            records = load_document(path, origin="runtime")
            if not records or not any((r.get("text") or "").strip() for r in records):
                raise ValueError("No readable text could be extracted from this document")
        except Exception:
            path.unlink(missing_ok=True)
            raise

        self.reload()
        return next(doc for doc in self.documents if doc["id"] == _doc_id("runtime", path))

    def delete_runtime(self, document_id: str) -> None:
        if not document_id.startswith("runtime:"):
            raise ValueError("Core policy documents cannot be deleted from the admin interface")
        filename = document_id.split(":", 1)[1]
        path = RUNTIME_UPLOAD_DIR / Path(filename).name
        if not path.exists():
            raise FileNotFoundError("Document not found")
        path.unlink()
        self.reload()

    def stats(self) -> dict[str, Any]:
        core_docs = sum(1 for d in self.documents if d["origin"] == "core" and d["status"] == "ready")
        runtime_docs = sum(1 for d in self.documents if d["origin"] == "runtime" and d["status"] == "ready")
        return {
            "knowledge_documents": sum(1 for d in self.documents if d["status"] == "ready"),
            "knowledge_chunks": len(self.records),
            "core_documents": core_docs,
            "runtime_documents": runtime_docs,
            "index_version": self.version,
        }


knowledge_base = KnowledgeBase()
