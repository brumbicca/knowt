"""Google Tasks API — mesmo OAuth do Calendar (`knowt.google_oauth`)."""
from __future__ import annotations

import urllib.parse
from datetime import datetime

from knowt.google_oauth import (
    TASKS_SCOPE,
    _api_request,
    credentials_configured,
    has_granted_scope,
    is_connected,
)

TASKLISTS_URL = "https://tasks.googleapis.com/tasks/v1/users/@me/lists"
TASKS_URL = "https://tasks.googleapis.com/tasks/v1/lists"


def is_tasks_connected() -> bool:
    return is_connected() and has_granted_scope(TASKS_SCOPE)


def status() -> dict:
    creds = credentials_configured()
    oauth = is_connected()
    connected = is_tasks_connected()
    if connected:
        message = "Google Tasks ligado."
        mode = "google_tasks"
    elif oauth:
        message = "Google ligado — autorize novamente para incluir Google Tasks."
        mode = "google_tasks_pending_scope"
    elif creds:
        message = "Credenciais Google prontas — falta autorizar Calendar e Tasks."
        mode = "google_tasks_pending_auth"
    else:
        message = "Tarefas locais knowt activas. Google Tasks: ver docs/GOOGLE.md."
        mode = "knowt_local"
    return {
        "google_tasks_connected": connected,
        "credentials_configured": creds,
        "auth_available": creds,
        "mode": mode,
        "message": message,
    }


def _default_tasklist_id() -> str:
    payload = _api_request("GET", f"{TASKLISTS_URL}?maxResults=100")
    items = payload.get("items") or []
    if not items:
        raise ValueError("google_tasks_list_missing")
    preferred = next(
        (
            item
            for item in items
            if str(item.get("title") or "").strip().casefold()
            in {"my tasks", "minhas tarefas"}
        ),
        items[0],
    )
    tasklist_id = str(preferred.get("id") or "").strip()
    if not tasklist_id:
        raise ValueError("google_tasks_list_missing")
    return tasklist_id


def _task_url(tasklist_id: str, task_id: str | None = None) -> str:
    base = f"{TASKS_URL}/{urllib.parse.quote(tasklist_id, safe='')}/tasks"
    if task_id:
        return f"{base}/{urllib.parse.quote(task_id, safe='')}"
    return base


def _normalize_task(item: dict) -> dict:
    status_value = "done" if item.get("status") == "completed" else "open"
    updated = str(item.get("updated") or "")
    return {
        "id": f"gtask:{item.get('id')}",
        "title": item.get("title") or "(sem título)",
        "status": status_value,
        "priority": "medium",
        "created_at": updated,
        "updated_at": updated,
        "due": item.get("due"),
        "notes": item.get("notes"),
        "source": "google_tasks",
        "web_view_link": item.get("webViewLink"),
    }


def list_google_tasks(status_filter: str | None = "open") -> list[dict]:
    if not is_tasks_connected():
        return []
    params = {
        "maxResults": "100",
        "showCompleted": "true" if status_filter in {"done", "all"} else "false",
        "showHidden": "false",
    }
    payload = _api_request(
        "GET",
        f"{_task_url(_default_tasklist_id())}?{urllib.parse.urlencode(params)}",
    )
    tasks = [_normalize_task(item) for item in (payload.get("items") or [])]
    if status_filter and status_filter != "all":
        tasks = [task for task in tasks if task["status"] == status_filter]
    return tasks


def create_google_task(
    title: str,
    *,
    due: str | None = None,
    notes: str | None = None,
) -> dict:
    if not is_tasks_connected():
        raise ValueError("google_tasks_not_connected")
    body: dict[str, str] = {"title": title}
    if notes:
        body["notes"] = notes
    if due:
        parsed = datetime.fromisoformat(str(due).replace("Z", "+00:00"))
        body["due"] = parsed.isoformat()
    created = _api_request("POST", _task_url(_default_tasklist_id()), body)
    return _normalize_task(created)


def complete_google_task(task_id: str) -> dict:
    if not is_tasks_connected():
        raise ValueError("google_tasks_not_connected")
    raw_id = str(task_id or "").removeprefix("gtask:").strip()
    if not raw_id:
        raise ValueError("id_required")
    updated = _api_request(
        "PATCH",
        _task_url(_default_tasklist_id(), raw_id),
        {"status": "completed"},
    )
    return _normalize_task(updated)
