"""Configuração de ambiente (single-tenant no MVP)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    env: str
    data_dir: Path
    org_id: str
    host: str
    port: int

    @classmethod
    def from_env(cls) -> "Settings":
        data = os.getenv("KNOWT_DATA_DIR", "./data").strip() or "./data"
        return cls(
            env=(os.getenv("KNOWT_ENV") or "development").strip(),
            data_dir=Path(data).expanduser().resolve(),
            org_id=(os.getenv("KNOWT_ORG_ID") or "default").strip() or "default",
            host=(os.getenv("KNOWT_HOST") or "127.0.0.1").strip(),
            port=int(os.getenv("KNOWT_PORT") or "8766"),
        )
