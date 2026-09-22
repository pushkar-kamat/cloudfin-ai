from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import APP_NAME, APP_VERSION, FRONTEND_URL
from app.routes import admin, chat, health, profile

app = FastAPI(title=APP_NAME, version=APP_VERSION)

allowed_origins = [item.strip().rstrip("/") for item in FRONTEND_URL.split(",") if item.strip()]
local_dev_enabled = any(
    origin.startswith("http://localhost")
    or origin.startswith("https://localhost")
    or origin.startswith("http://127.0.0.1")
    or origin.startswith("https://127.0.0.1")
    for origin in allowed_origins
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$" if local_dev_enabled else None),
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(health.router)
app.include_router(chat.router)
app.include_router(profile.router)
app.include_router(admin.router)
