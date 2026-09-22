from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends

from app.auth import verify_supabase_token
from app.rag.knowledge_base import knowledge_base
from app.rag.pipeline import answer_chat
from app.schemas import ChatRequest, ChatResponse

router = APIRouter(tags=["chat"])


@router.get("/sources")
def sources(_: dict[str, Any] = Depends(verify_supabase_token)) -> dict:
    return {"documents": knowledge_base.documents}


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, _: dict[str, Any] = Depends(verify_supabase_token)) -> ChatResponse:
    return ChatResponse(**answer_chat(payload))
