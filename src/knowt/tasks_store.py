"""Tarefas locais knowt — JSON em KNOWT_DATA_DIR (sem Google Tasks no MVP)."""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Sao_Paulo")


def tasks_path(data_dir: Path) -> Path:
    return Path(data_dir) / "tasks.json"


def _now_iso() -> str:
    return datetime.now(TZ).isoformat()


def _ensure_store(data_dir: Path) -> dict:
    path = tasks_path(data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.is_file():
        data = {"version": 1, "source": "knowt_local", "tasks": []}
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return data
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        data = {"version": 1, "source": "knowt_local", "tasks": []}
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return data


def _save(data_dir: Path, data: dict) -> None:
    path = tasks_path(data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def list_tasks(data_dir: Path, status: str | None = "open") -> List[dict]:
    data = _ensure_store(data_dir)
    tasks = list(data.get("tasks") or [])
    if status and status != "all":
        tasks = [t for t in tasks if str(t.get("status") or "open") == status]
    tasks.sort(
        key=lambda t: (
            0 if t.get("priority") == "high" else 1,
            str(t.get("created_at") or ""),
        )
    )
    return tasks


def add_task(
    data_dir: Path,
    title: str,
    priority: str = "medium",
    due: str | None = None,
    notes: str | None = None,
) -> dict:
    title = (title or "").strip()
    if not title:
        raise ValueError("title_required")
    if len(title) > 500:
        raise ValueError("title_too_long")
    pr = (priority or "medium").strip().lower()
    if pr not in ("low", "medium", "high"):
        pr = "medium"
    now = _now_iso()
    task = {
        "id": str(uuid.uuid4()),
        "title": title,
        "status": "open",
        "priority": pr,
        "created_at": now,
        "updated_at": now,
        "due": due,
        "notes": notes,
        "source": "knowt_local",
    }
    data = _ensure_store(data_dir)
    tasks = list(data.get("tasks") or [])
    tasks.insert(0, task)
    data["tasks"] = tasks
    _save(data_dir, data)
    return task


def complete_task(data_dir: Path, task_id: str) -> dict:
    tid = (task_id or "").strip()
    if not tid:
        raise ValueError("id_required")
    data = _ensure_store(data_dir)
    tasks = list(data.get("tasks") or [])
    for t in tasks:
        if str(t.get("id")) == tid:
            t["status"] = "done"
            t["updated_at"] = _now_iso()
            _save(data_dir, {**data, "tasks": tasks})
            return t
    raise ValueError("not_found")


def google_status() -> Dict[str, Any]:
    return {
        "google_tasks_connected": False,
        "credentials_configured": False,
        "auth_available": False,
        "mode": "knowt_local",
        "message": "Tarefas locais knowt activas. Google Tasks ainda não ligado neste piloto.",
    }
