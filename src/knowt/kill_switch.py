"""Kill switch por fonte (plano Gate 10 / Fase 9) — nunca automático no check."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from knowt.sources import SourceRegistry


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_suspended(registry: SourceRegistry, source_id: str) -> bool:
    src = registry.get(source_id)
    if not src:
        return False
    return str(getattr(src, "status", "") or "").lower() == "suspended"


def kill_switch_status(registry: SourceRegistry, source_id: str) -> Dict[str, Any]:
    src = registry.get(source_id)
    if not src:
        return {
            "suspended": False,
            "reason": None,
            "at": None,
            "source_missing": True,
        }
    suspended = str(src.status or "").lower() == "suspended"
    return {
        "suspended": suspended,
        "reason": getattr(src, "kill_switch_reason", None) if suspended else None,
        "at": getattr(src, "kill_switch_at", None) if suspended else None,
        "source_status": src.status,
        "resume_hint": (
            f'POST /api/bridge/fontes/{source_id}/kill-switch {{"suspended": false}}'
            if suspended
            else f'POST /api/bridge/fontes/{source_id}/kill-switch {{"suspended": true, "reason": "..."}}'
        ),
    }


def set_kill_switch(
    registry: SourceRegistry,
    source_id: str,
    *,
    suspended: bool,
    reason: str = "",
    actor: str = "operator",
) -> Dict[str, Any]:
    src = registry.get(source_id)
    if not src:
        raise KeyError(source_id)
    reason = (reason or "").strip()
    if suspended and not reason:
        raise ValueError("reason_required")
    if suspended:
        src.status = "suspended"
        src.kill_switch_reason = reason
        src.kill_switch_at = _now_iso()
        src.kill_switch_actor = actor
    else:
        src.status = "active"
        src.kill_switch_reason = None
        src.kill_switch_at = None
        src.kill_switch_actor = actor
        # marca reactivação na nota sem apagar histórico operacional
        note = (src.notes or "").strip()
        stamp = f"[kill_switch_off {_now_iso()} by {actor}]"
        src.notes = f"{note} {stamp}".strip() if note else stamp
    registry.upsert(src)
    return {
        "source_id": source_id,
        "status": src.status,
        "kill_switch": kill_switch_status(registry, source_id),
        "actor": actor,
    }
