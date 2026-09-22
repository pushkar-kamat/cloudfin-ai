from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth import require_admin
from app.config import MAX_UPLOAD_MB
from app.rag.knowledge_base import knowledge_base
from app.schemas import RetrievalRequest
from app.services.cache import answer_cache

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview")
def overview(_: dict[str, Any] = Depends(require_admin)) -> dict:
    return {
        **knowledge_base.stats(),
        "documents": knowledge_base.documents,
        "cache_entries": answer_cache.size,
        "cache_hits": answer_cache.hits,
        "cache_misses": answer_cache.misses,
        "storage_note": "Runtime uploads are temporary on Render Free and can be lost after restart, redeploy, or spin-down.",
    }


@router.post("/reload")
def reload_index(_: dict[str, Any] = Depends(require_admin)) -> dict:
    knowledge_base.reload()
    return {"status": "reloaded", **knowledge_base.stats()}


@router.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    _: dict[str, Any] = Depends(require_admin),
) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File must be {MAX_UPLOAD_MB} MB or smaller")
    try:
        document = knowledge_base.add_upload(file.filename, data)
        return {"status": "uploaded", "document": document, **knowledge_base.stats()}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/documents/{document_id:path}")
def delete_document(document_id: str, _: dict[str, Any] = Depends(require_admin)) -> dict:
    try:
        knowledge_base.delete_runtime(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "deleted", **knowledge_base.stats()}


@router.post("/retrieve")
def retrieval_lab(payload: RetrievalRequest, _: dict[str, Any] = Depends(require_admin)) -> dict:
    results = knowledge_base.search(payload.query, top_k=payload.top_k)
    return {
        "query": payload.query,
        "results": [
            {
                "document": r.get("document"),
                "section": r.get("section"),
                "page": r.get("page"),
                "origin": r.get("origin"),
                "relevance": round(float(r.get("score", 0.0)), 3),
                "excerpt": " ".join((r.get("text") or "").split())[:420],
            }
            for r in results
        ],
    }
