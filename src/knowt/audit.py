"""Append-only audit de respostas (sem secrets)."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional


def append_answer_audit(
    path: Path,
    *,
    message: str,
    source_id: str,
    result: Dict[str, Any],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    enf = result.get("enforcement") or {}
    row = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "source_id": source_id,
        "message": (message or "")[:500],
        "mode": enf.get("mode"),
        "capability_id": enf.get("capability_id"),
        "reason_code": enf.get("reason_code"),
        "answer_preview": ((result.get("answer") or "")[:400]),
        "data_ok": (result.get("data") or {}).get("ok")
        if isinstance(result.get("data"), dict)
        else None,
    }
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def audit_path_for(data_dir: Path) -> Path:
    return data_dir / "audit" / "answers.jsonl"
