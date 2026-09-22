# Viva Change Map

Common changes can be demonstrated without searching the whole codebase.

| Professor asks to change... | File / setting |
|---|---|
| Number of retrieved chunks | `backend/app/config.py` -> `TOP_K` |
| Minimum retrieval score | `backend/app/config.py` -> `MIN_RELEVANCE` |
| Word vs character retrieval weight | `WORD_TFIDF_WEIGHT`, `CHAR_TFIDF_WEIGHT` |
| Chunk size | `CHUNK_SIZE` |
| Chunk overlap | `CHUNK_OVERLAP` |
| Recent conversation context | `MAX_HISTORY_MESSAGES` |
| Cache duration | `CACHE_TTL_SECONDS` |
| Maximum upload size | `MAX_UPLOAD_MB` |
| Allowed upload formats | `ALLOWED_UPLOAD_EXTENSIONS` |
| Primary AI provider | `LLM_PRIMARY` environment variable (`groq` or `gemini`) |
| Fallback AI provider | `LLM_FALLBACK` environment variable |
| Provider failure threshold | `LLM_FAILURE_THRESHOLD` |
| Circuit-breaker cooldown | `LLM_CIRCUIT_BREAKER_SECONDS` |
| Gemini model | `GEMINI_MODEL` environment variable |
| Groq model | `GROQ_MODEL` environment variable |
| Quick questions | `frontend/src/App.jsx` -> `quickQuestions` |
| Frontend API URL | `VITE_API_URL` |
| Allowed frontend production domain | Render `FRONTEND_URL` |

Recommended viva exercises are prepared later, after the final hosted build is stable.
