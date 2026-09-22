from __future__ import annotations

from typing import Any
from fastapi import APIRouter

from app.config import GEMINI_API_KEY, GROQ_API_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL
from app.rag.knowledge_base import knowledge_base
from app.services.cache import answer_cache
from app.services.llm import get_llm_status

router = APIRouter(tags=["system"])


@router.get("/")
def root() -> dict[str, str]:
    return {"name": "CloudFin AI", "version": "2.0", "status": "running"}


@router.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "healthy",
        **knowledge_base.stats(),
        "gemini_configured": bool(GEMINI_API_KEY),
        "groq_configured": bool(GROQ_API_KEY),
        "supabase_configured": bool(SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY),
        "llm": get_llm_status(),
        "cache_entries": answer_cache.size,
        "cache_hits": answer_cache.hits,
        "cache_misses": answer_cache.misses,
    }
