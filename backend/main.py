"""Compatibility entry point.

Existing demo commands using `uvicorn main:app` continue to work, while the
real application now lives in the modular `app/` package.
"""
from app.main import app

__all__ = ["app"]
