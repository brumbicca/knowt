#!/usr/bin/env python3
"""Cron de drift knowt (piloto Tiny) — Fase 9 / T8.

Corre `run_drift_check`, grava evento, alerta Telegram se suggest_kill_switch
(nunca auto-kill).

Uso na VPS:
  /root/knowt/.venv/bin/python /root/knowt/scripts/run_drift_cron.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


def _load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def main() -> int:
    env_path = Path(os.environ.get("KNOWT_ENV_FILE") or "/root/knowt/.env")
    if not env_path.is_file():
        env_path = ROOT / ".env"
    _load_dotenv(env_path)

    data_dir = Path(os.environ.get("KNOWT_DATA_DIR") or "/root/knowt-data")
    source_id = (os.environ.get("KNOWT_DRIFT_SOURCE_ID") or "tinyerp").strip() or "tinyerp"
    actor = (os.environ.get("KNOWT_DRIFT_ACTOR") or "cron").strip() or "cron"

    from knowt.drift import run_drift_check
    from knowt.drift_ops import maybe_alert
    from knowt.publish import ensure_tiny_capability_slots
    from knowt.sources import SourceRegistry, seed_tiny_draft

    registry = SourceRegistry(data_dir / "sources.json")
    seed_tiny_draft(registry)
    ensure_tiny_capability_slots(registry, source_id)

    event = run_drift_check(
        data_dir,
        registry,
        source_id=source_id,
        actor=actor,
    )
    alert_out = maybe_alert(event)

    summary = {
        "ok": True,
        "source_id": source_id,
        "event_id": event.get("id"),
        "alert_count": event.get("alert_count"),
        "suggest_kill_switch": bool(event.get("suggest_kill_switch")),
        "auto_kill": False,
        "alert": alert_out,
        "codes": [a.get("code") for a in (event.get("alerts") or [])],
    }
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
