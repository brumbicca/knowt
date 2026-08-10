"""Cliente Mongo próprio do knowt (opcional; pedidos piloto continuam via Tiny API)."""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

_client = None


def mongo_uri() -> str:
    return (
        os.environ.get("KNOWT_MONGO_URI")
        or os.environ.get("MONGO_URI")
        or "mongodb://127.0.0.1:27017"
    ).strip()


def mongo_db_name() -> str:
    return (
        os.environ.get("KNOWT_MONGO_DB")
        or os.environ.get("MONGO_DB_NAME")
        or "knowt"
    ).strip() or "knowt"


def get_client():
    """Lazy pymongo client; None se pymongo ausente."""
    global _client
    if _client is not None:
        return _client
    try:
        from pymongo import MongoClient
    except ImportError:
        return None
    _client = MongoClient(
        mongo_uri(),
        serverSelectionTimeoutMS=int(os.environ.get("KNOWT_MONGO_TIMEOUT_MS") or "2500"),
    )
    return _client


def ping_mongo() -> Dict[str, Any]:
    """Probe rápido para health — sem dados de negócio."""
    uri = mongo_uri()
    dbn = mongo_db_name()
    try:
        client = get_client()
    except Exception as exc:
        return {
            "ok": False,
            "configured": True,
            "db": dbn,
            "error": type(exc).__name__,
            "detail": str(exc)[:200],
        }
    if client is None:
        return {
            "ok": False,
            "configured": bool(uri),
            "db": dbn,
            "error": "pymongo_missing",
            "detail": "pip install pymongo",
        }
    try:
        client.admin.command("ping")
        # marca de boot (idempotente)
        client[dbn]["_meta"].update_one(
            {"_id": "knowt"},
            {"$set": {"product": "knowt", "role": "own_mongo"}, "$setOnInsert": {"created": True}},
            upsert=True,
        )
        return {"ok": True, "configured": True, "db": dbn, "host": "127.0.0.1"}
    except Exception as exc:
        return {
            "ok": False,
            "configured": True,
            "db": dbn,
            "error": type(exc).__name__,
            "detail": str(exc)[:200],
        }


def reset_client() -> None:
    global _client
    if _client is not None:
        try:
            _client.close()
        except Exception:
            pass
    _client = None
