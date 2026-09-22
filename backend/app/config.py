from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
KNOWLEDGE_DIR = PROJECT_DIR / "knowledge"
RUNTIME_UPLOAD_DIR = BACKEND_DIR / "runtime_uploads"
RUNTIME_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

APP_NAME = "CloudFin AI API"
APP_VERSION = "2.0.0"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
GEMINI_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "8"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b").strip()
GROQ_TIMEOUT_SECONDS = float(os.getenv("GROQ_TIMEOUT_SECONDS", "15"))

# LLM routing: keep provider choice deploy-time configurable.
LLM_PRIMARY = os.getenv("LLM_PRIMARY", "groq").strip().lower()
LLM_FALLBACK = os.getenv("LLM_FALLBACK", "gemini").strip().lower()
LLM_FAILURE_THRESHOLD = max(1, int(os.getenv("LLM_FAILURE_THRESHOLD", "1")))
LLM_CIRCUIT_BREAKER_SECONDS = max(10, int(os.getenv("LLM_CIRCUIT_BREAKER_SECONDS", "180")))
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
ADMIN_EMAILS = {item.strip().lower() for item in os.getenv("ADMIN_EMAILS", "").split(",") if item.strip()}
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173,http://127.0.0.1:5173",
).strip()

# Retrieval settings are deliberately centralized for viva/demo changes.
TOP_K = int(os.getenv("TOP_K", "5"))
MIN_RELEVANCE = float(os.getenv("MIN_RELEVANCE", "0.055"))
WORD_TFIDF_WEIGHT = float(os.getenv("WORD_TFIDF_WEIGHT", "0.75"))
CHAR_TFIDF_WEIGHT = float(os.getenv("CHAR_TFIDF_WEIGHT", "0.25"))
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1400"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "180"))
MAX_HISTORY_MESSAGES = int(os.getenv("MAX_HISTORY_MESSAGES", "4"))

CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "900"))
CACHE_MAX_ENTRIES = int(os.getenv("CACHE_MAX_ENTRIES", "100"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "8"))
ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".xlsx", ".xls"}
