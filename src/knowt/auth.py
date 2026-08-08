"""Auth simples Bearer / X-Knowt-Token para rotas /v1/*."""
from __future__ import annotations

from functools import wraps
from typing import Any, Callable

from flask import Request, jsonify, request


def extract_bearer(req: Request) -> str:
    auth = (req.headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return (req.headers.get("X-Knowt-Token") or "").strip()


def require_api_token(expected: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Se expected vazio, não exige token (dev). Health fica fora do decorator."""

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(fn)
        def wrapped(*args: Any, **kwargs: Any):
            if not (expected or "").strip():
                return fn(*args, **kwargs)
            got = extract_bearer(request)
            if not got or got != expected.strip():
                return (
                    jsonify(
                        {
                            "ok": False,
                            "reason_code": "UNAUTHORIZED",
                            "message": "Token knowt em falta ou inválido.",
                        }
                    ),
                    401,
                )
            return fn(*args, **kwargs)

        return wrapped

    return decorator
