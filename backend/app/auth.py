from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

from fastapi import Depends, HTTPException, Request, status

from app.config import ADMIN_EMAILS, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL


def _extract_bearer(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = auth.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    return token


def verify_supabase_token(request: Request) -> dict[str, Any]:
    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(status_code=503, detail="Supabase Auth is not configured")

    token = _extract_bearer(request)
    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": SUPABASE_PUBLISHABLE_KEY,
            "Accept": "application/json",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            user = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
        raise HTTPException(status_code=503, detail="Supabase authentication service is unavailable") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Unable to verify Supabase session") from exc

    if not user.get("id"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def is_admin_user(user: dict[str, Any]) -> bool:
    email = str(user.get("email") or "").strip().lower()
    return bool(email and email in ADMIN_EMAILS)


def require_admin(user: dict[str, Any] = Depends(verify_supabase_token)) -> dict[str, Any]:
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user
