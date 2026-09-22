from __future__ import annotations

from app.config import MAX_HISTORY_MESSAGES, TOP_K
from app.rag.knowledge_base import knowledge_base
from app.schemas import ChatRequest
from app.services.cache import answer_cache
from app.services.llm import generate_answer


def _history_for_retrieval(payload: ChatRequest) -> list[dict[str, str]]:
    raw = [item.model_dump() for item in payload.history[-MAX_HISTORY_MESSAGES:]]
    return raw


def _retrieval_query(message: str, history: list[dict[str, str]]) -> str:
    recent_users = [item["content"] for item in history if item["role"] == "user"][-2:]
    if not recent_users:
        return message
    return "\n".join([*recent_users, message])


def answer_chat(payload: ChatRequest) -> dict:
    history = _history_for_retrieval(payload)
    cache_payload = {
        "message": payload.message.strip().lower(),
        "history": history,
        "knowledge_version": knowledge_base.version,
    }
    key = answer_cache.key(cache_payload)
    cached = answer_cache.get(key)
    if cached:
        return {**cached, "cached": True}

    retrieval_query = _retrieval_query(payload.message, history)
    results = knowledge_base.search(retrieval_query, top_k=TOP_K)
    answer, provider, fallback_used = generate_answer(payload.message, results, history)

    sources = []
    seen: set[tuple] = set()
    for result in results:
        identity = (result.get("document"), result.get("section"), result.get("page"))
        if identity in seen:
            continue
        seen.add(identity)
        excerpt = " ".join((result.get("text") or "").split())[:260]
        if len(" ".join((result.get("text") or "").split())) > 260:
            excerpt += "…"
        sources.append({
            "document": result.get("document") or "Unknown document",
            "section": result.get("section"),
            "page": result.get("page"),
            "relevance": round(float(result.get("score", 0.0)), 3),
            "excerpt": excerpt,
            "origin": result.get("origin", "core"),
        })

    response = {
        "answer": answer,
        "sources": sources,
        "cached": False,
        "chunks_used": len(results),
        "provider": provider,
        "fallback_used": fallback_used,
    }
    answer_cache.set(key, response)
    return response
