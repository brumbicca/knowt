"""Configuração de ambiente (single-tenant no MVP)."""
from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    env: str
    data_dir: Path
    org_id: str
    host: str
    port: int
    api_token: str
    chat_password: str
    secret_key: str
    mongo_uri: str
    mongo_db: str

    @classmethod
    def from_env(cls) -> "Settings":
        data = os.getenv("KNOWT_DATA_DIR", "./data").strip() or "./data"
        secret = (os.getenv("KNOWT_SECRET_KEY") or "").strip()
        if not secret:
            secret = secrets.token_hex(16)
        return cls(
            env=(os.getenv("KNOWT_ENV") or "development").strip(),
            data_dir=Path(data).expanduser().resolve(),
            org_id=(os.getenv("KNOWT_ORG_ID") or "default").strip() or "default",
            host=(os.getenv("KNOWT_HOST") or "127.0.0.1").strip(),
            port=int(os.getenv("KNOWT_PORT") or "8766"),
            api_token=(os.getenv("KNOWT_API_TOKEN") or "").strip(),
            chat_password=(os.getenv("KNOWT_CHAT_PASSWORD") or "").strip(),
            secret_key=secret,
            mongo_uri=(
                os.getenv("KNOWT_MONGO_URI") or os.getenv("MONGO_URI") or "mongodb://127.0.0.1:27017"
            ).strip(),
            mongo_db=(
                os.getenv("KNOWT_MONGO_DB") or os.getenv("MONGO_DB_NAME") or "knowt"
            ).strip()
            or "knowt",
        )
