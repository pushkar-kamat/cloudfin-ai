from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends

from app.auth import is_admin_user, verify_supabase_token

router = APIRouter(tags=["auth"])


@router.get("/me")
def me(user: dict[str, Any] = Depends(verify_supabase_token)) -> dict[str, Any]:
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "is_admin": is_admin_user(user),
    }
