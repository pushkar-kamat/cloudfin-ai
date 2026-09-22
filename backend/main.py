from __future__ import annotations

import json
import os
import time
import urllib.request
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    from google import genai
    from google.genai import types
except Exception:
    genai = None
    types = None

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
KNOWLEDGE_DIR = BASE_DIR.parent / "knowledge"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").strip()
COGNITO_ISSUER = os.getenv("COGNITO_ISSUER", "").rstrip("/")
COGNITO_CLIENT_ID = os.getenv("COGNITO_CLIENT_ID", "").strip()

app = FastAPI(title="CloudFin AI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[u.strip() for u in FRONTEND_URL.split(",") if u.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=2, max_length=1500)


class SourceItem(BaseModel):
    document: str
    relevance: float


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceItem]


def pretty_name(path: Path) -> str:
    return path.stem.replace("_", " ").title() + " Policy"


def chunk_text(text: str, max_chars: int = 1800) -> list[str]:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = ""
    for p in paragraphs:
        candidate = f"{current}\n\n{p}".strip() if current else p
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                chunks.append(current)
            if len(p) <= max_chars:
                current = p
            else:
                for i in range(0, len(p), max_chars):
                    part = p[i:i + max_chars].strip()
                    if part:
                        chunks.append(part)
                current = ""
    if current:
        chunks.append(current)
    return chunks


class KnowledgeIndex:
    def __init__(self) -> None:
        self.vectorizer = TfidfVectorizer(
            lowercase=True,
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True,
        )
        self.records: list[dict[str, Any]] = []
        self.matrix = None
        self.documents: list[str] = []
        self.reload()

    def reload(self) -> None:
        records: list[dict[str, Any]] = []
        documents: list[str] = []
        for path in sorted(KNOWLEDGE_DIR.glob("*.md")):
            documents.append(pretty_name(path))
            text = path.read_text(encoding="utf-8")
            for chunk in chunk_text(text):
                records.append({
                    "document": pretty_name(path),
                    "path": path.name,
                    "text": chunk,
                })
        self.records = records
        self.documents = documents
        self.matrix = self.vectorizer.fit_transform([r["text"] for r in records]) if records else None

    def search(self, query: str, top_k: int = 5, min_score: float = 0.06) -> list[dict[str, Any]]:
        if self.matrix is None or not self.records:
            return []
        q = self.vectorizer.transform([query])
        scores = cosine_similarity(q, self.matrix).flatten()
        ranked = scores.argsort()[::-1]
        results: list[dict[str, Any]] = []
        for idx in ranked[: max(top_k * 2, top_k)]:
            score = float(scores[idx])
            if score < min_score:
                continue
            item = dict(self.records[int(idx)])
            item["score"] = score
            results.append(item)
            if len(results) >= top_k:
                break
        return results


knowledge = KnowledgeIndex()

_jwks_cache: dict[str, Any] = {"keys": None, "expires": 0.0}


def get_jwks() -> dict[str, Any]:
    now = time.time()
    if _jwks_cache["keys"] and now < _jwks_cache["expires"]:
        return _jwks_cache["keys"]
    if not COGNITO_ISSUER:
        raise HTTPException(status_code=503, detail="Cognito is not configured")
    url = f"{COGNITO_ISSUER}/.well-known/jwks.json"
    try:
        with urllib.request.urlopen(url, timeout=6) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Unable to load Cognito signing keys") from exc
    _jwks_cache.update({"keys": data, "expires": now + 3600})
    return data


def verify_cognito_token(request: Request) -> dict[str, Any]:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = auth.removeprefix("Bearer ").strip()
    if not COGNITO_ISSUER or not COGNITO_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Cognito is not configured")
    try:
        headers = jwt.get_unverified_header(token)
        jwks = get_jwks()
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == headers.get("kid")), None)
        if not key:
            raise HTTPException(status_code=401, detail="Unknown signing key")
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=COGNITO_CLIENT_ID,
            issuer=COGNITO_ISSUER,
            options={"verify_at_hash": False},
        )
        if claims.get("token_use") != "id":
            raise HTTPException(status_code=401, detail="ID token required")
        return claims
    except HTTPException:
        raise
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc


def require_admin(claims: dict[str, Any] = Depends(verify_cognito_token)) -> dict[str, Any]:
    groups = claims.get("cognito:groups", []) or []
    if "admin" not in groups:
        raise HTTPException(status_code=403, detail="Administrator access required")
    return claims


def generate_answer(question: str, results: list[dict[str, Any]]) -> str:
    if not results:
        return "I couldn't find relevant information in the current policy knowledge base."
    if not GEMINI_API_KEY or genai is None:
        return (
            "Relevant policy information was found, but the Gemini service is not configured. "
            "Add GEMINI_API_KEY to the backend environment to generate the final grounded answer."
        )

    context = "\n\n".join(
        f"SOURCE: {r['document']}\n{r['text']}" for r in results
    )
    system_instruction = (
        "You are CloudFin AI, a financial policy information assistant. "
        "Answer only from the supplied policy context. Do not invent policy rules or facts. "
        "If the answer is not supported, clearly say the information is unavailable in the current knowledge base. "
        "Do not provide personalized financial advice, investment recommendations, lending decisions, or trading guidance. "
        "Use concise professional language and helpful bullet points when appropriate."
    )
    prompt = f"POLICY CONTEXT:\n{context}\n\nUSER QUESTION:\n{question}"
    client = genai.Client(api_key=GEMINI_API_KEY)
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2,
                max_output_tokens=800,
            ),
        )
        text = (response.text or "").strip()
        return text or "The AI service did not return a usable response. Please try again."
    except Exception:
        raise HTTPException(status_code=502, detail="The AI service could not generate a response")


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "CloudFin AI", "status": "running"}


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "healthy",
        "knowledge_documents": len(knowledge.documents),
        "knowledge_chunks": len(knowledge.records),
        "gemini_configured": bool(GEMINI_API_KEY),
        "cognito_configured": bool(COGNITO_ISSUER and COGNITO_CLIENT_ID),
    }


@app.get("/sources")
def sources(_: dict[str, Any] = Depends(verify_cognito_token)) -> dict[str, list[str]]:
    return {"documents": knowledge.documents}


@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, _: dict[str, Any] = Depends(verify_cognito_token)) -> ChatResponse:
    results = knowledge.search(payload.message, top_k=5)
    answer = generate_answer(payload.message, results)
    by_doc: dict[str, float] = {}
    for r in results:
        by_doc[r["document"]] = max(by_doc.get(r["document"], 0.0), r["score"])
    src = [
        SourceItem(document=doc, relevance=round(score, 3))
        for doc, score in sorted(by_doc.items(), key=lambda x: x[1], reverse=True)
    ]
    return ChatResponse(answer=answer, sources=src)


@app.post("/admin/reload")
def admin_reload(_: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    knowledge.reload()
    return {
        "status": "reloaded",
        "knowledge_documents": len(knowledge.documents),
        "knowledge_chunks": len(knowledge.records),
    }
