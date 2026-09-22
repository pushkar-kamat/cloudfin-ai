from __future__ import annotations

import logging
import threading
import time
from typing import Any, Callable

import httpx
from fastapi import HTTPException

from app.config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    GEMINI_TIMEOUT_SECONDS,
    GROQ_API_KEY,
    GROQ_MODEL,
    GROQ_TIMEOUT_SECONDS,
    LLM_CIRCUIT_BREAKER_SECONDS,
    LLM_FAILURE_THRESHOLD,
    LLM_FALLBACK,
    LLM_PRIMARY,
)

logger = logging.getLogger("cloudfin.llm")

_PROVIDER_NAMES = {"gemini", "groq"}
_state_lock = threading.Lock()
_provider_state: dict[str, dict[str, Any]] = {
    "gemini": {"failures": 0, "open_until": 0.0, "last_error": None},
    "groq": {"failures": 0, "open_until": 0.0, "last_error": None},
}


def _history_text(history: list[dict[str, str]]) -> str:
    if not history:
        return "No earlier conversation context."
    return "\n".join(f"{item['role'].upper()}: {item['content']}" for item in history)


def _build_prompt(
    question: str,
    results: list[dict[str, Any]],
    history: list[dict[str, str]],
) -> tuple[str, str]:
    context_blocks = []
    for idx, result in enumerate(results, start=1):
        context_blocks.append(
            "\n".join([
                f"SOURCE {idx}",
                f"Document: {result.get('document')}",
                f"Section: {result.get('section') or 'Not specified'}",
                f"Page: {result.get('page') or 'Not specified'}",
                f"Content: {result.get('text')}",
            ])
        )
    context = "\n\n".join(context_blocks)

    system_instruction = (
        "You are CloudFin AI, an enterprise financial-policy information assistant. "
        "Answer only from the supplied policy context. Never invent policy rules, limits, authorities, exceptions, dates, or thresholds. "
        "If the evidence is insufficient, say that the information is unavailable in the current knowledge base. "
        "Do not provide personalized financial advice, investment recommendations, lending decisions, or trading guidance. "
        "Use earlier conversation messages only to understand follow-up wording; policy facts must still come from the retrieved context. "
        "Format answers for easy reading in the chat interface. Begin with a short direct answer, then use clear Markdown headings and bullet or numbered lists when useful. "
        "For policy requirement questions, group related requirements under meaningful headings instead of producing one long block. "
        "Do not use a Markdown table unless the user explicitly asks for a table or the question is genuinely a comparison that is clearer as a table. "
        "Do not repeat document/source names beside every bullet because the application displays source cards separately. "
        "Keep the answer focused and avoid adding concluding claims that are not directly supported by the retrieved policy text."
    )
    prompt = (
        f"RECENT CONVERSATION:\n{_history_text(history)}\n\n"
        f"POLICY CONTEXT:\n{context}\n\n"
        f"USER QUESTION:\n{question}"
    )
    return system_instruction, prompt


def _generate_with_gemini(system_instruction: str, prompt: str) -> str:
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini is not configured")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    payload = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 900,
        },
    }

    with httpx.Client(timeout=GEMINI_TIMEOUT_SECONDS) as client:
        response = client.post(
            url,
            headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError("Gemini returned no candidates")
    parts = ((candidates[0].get("content") or {}).get("parts") or [])
    text = "".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()
    if not text:
        raise RuntimeError("Gemini returned an empty response")
    return text


def _generate_with_groq(system_instruction: str, prompt: str) -> str:
    if not GROQ_API_KEY:
        raise RuntimeError("Groq is not configured")

    payload = {
        "model": GROQ_MODEL,
        "temperature": 0.2,
        "max_tokens": 900,
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": prompt},
        ],
    }
    with httpx.Client(timeout=GROQ_TIMEOUT_SECONDS) as client:
        response = client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("Groq returned no choices")
    text = ((choices[0].get("message") or {}).get("content") or "").strip()
    if not text:
        raise RuntimeError("Groq returned an empty response")
    return text


def _provider_configured(provider: str) -> bool:
    if provider == "groq":
        return bool(GROQ_API_KEY)
    if provider == "gemini":
        return bool(GEMINI_API_KEY)
    return False


def _provider_order() -> list[str]:
    primary = LLM_PRIMARY if LLM_PRIMARY in _PROVIDER_NAMES else "groq"
    order = [primary]

    if LLM_FALLBACK in _PROVIDER_NAMES and LLM_FALLBACK != primary:
        order.append(LLM_FALLBACK)

    return order


def _circuit_open(provider: str) -> bool:
    now = time.monotonic()
    with _state_lock:
        state = _provider_state[provider]
        open_until = float(state["open_until"] or 0.0)
        if not open_until:
            return False
        if now >= open_until:
            # Half-open: allow the next request to test the provider again.
            state["open_until"] = 0.0
            state["failures"] = 0
            return False
        return True


def _record_success(provider: str) -> None:
    with _state_lock:
        state = _provider_state[provider]
        state["failures"] = 0
        state["open_until"] = 0.0
        state["last_error"] = None


def _record_failure(provider: str, exc: Exception) -> None:
    now = time.monotonic()
    with _state_lock:
        state = _provider_state[provider]
        state["failures"] = int(state["failures"] or 0) + 1
        state["last_error"] = f"{type(exc).__name__}: {str(exc)[:180]}"
        if state["failures"] >= LLM_FAILURE_THRESHOLD:
            state["open_until"] = now + LLM_CIRCUIT_BREAKER_SECONDS


def _seconds_until_retry(provider: str) -> int:
    now = time.monotonic()
    with _state_lock:
        open_until = float(_provider_state[provider]["open_until"] or 0.0)
    return max(0, int(round(open_until - now))) if open_until else 0


def get_llm_status() -> dict[str, Any]:
    providers: dict[str, Any] = {}
    for provider in ("groq", "gemini"):
        providers[provider] = {
            "configured": _provider_configured(provider),
            "circuit_open": _circuit_open(provider),
            "retry_in_seconds": _seconds_until_retry(provider),
        }
    return {
        "primary": LLM_PRIMARY,
        "fallback": LLM_FALLBACK,
        "failure_threshold": LLM_FAILURE_THRESHOLD,
        "circuit_breaker_seconds": LLM_CIRCUIT_BREAKER_SECONDS,
        "providers": providers,
    }


def _provider_function(provider: str) -> Callable[[str, str], str]:
    if provider == "groq":
        return _generate_with_groq
    if provider == "gemini":
        return _generate_with_gemini
    raise RuntimeError(f"Unsupported LLM provider: {provider}")


def generate_answer(
    question: str,
    results: list[dict[str, Any]],
    history: list[dict[str, str]],
) -> tuple[str, str, bool]:
    if not results:
        return "I couldn't find relevant information in the current policy knowledge base.", "none", False

    system_instruction, prompt = _build_prompt(question, results, history)
    order = _provider_order()
    errors: list[tuple[str, Exception]] = []

    for index, provider in enumerate(order):
        if not _provider_configured(provider):
            logger.info("Skipping %s because it is not configured", provider)
            continue

        if _circuit_open(provider):
            logger.warning(
                "Skipping %s because its circuit is open for about %ss",
                provider,
                _seconds_until_retry(provider),
            )
            continue

        try:
            answer = _provider_function(provider)(system_instruction, prompt)
            _record_success(provider)
            return answer, provider, index > 0
        except Exception as exc:
            _record_failure(provider, exc)
            errors.append((provider, exc))
            logger.warning(
                "%s generation failed; trying the next configured provider: %s",
                provider,
                exc,
            )

    if errors:
        logger.error(
            "All available AI providers failed: %s",
            "; ".join(f"{provider}={type(exc).__name__}" for provider, exc in errors),
        )
        raise HTTPException(
            status_code=503,
            detail="The AI providers are temporarily unavailable. Please try again shortly.",
        ) from errors[-1][1]

    raise HTTPException(
        status_code=503,
        detail="No usable AI provider is available. Check the backend LLM configuration.",
    )
