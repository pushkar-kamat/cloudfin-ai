from __future__ import annotations

from pydantic import BaseModel, Field


class HistoryMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=5000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=2, max_length=1500)
    history: list[HistoryMessage] = Field(default_factory=list)


class SourceItem(BaseModel):
    document: str
    section: str | None = None
    page: int | None = None
    relevance: float
    excerpt: str
    origin: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceItem]
    cached: bool = False
    chunks_used: int = 0
    provider: str = "none"
    fallback_used: bool = False


class RetrievalRequest(BaseModel):
    query: str = Field(min_length=2, max_length=1500)
    top_k: int = Field(default=5, ge=1, le=10)
