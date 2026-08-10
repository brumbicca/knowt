"""Agenda knowt — JSON local + Google Calendar quando OAuth ligado."""
from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Sao_Paulo")


def _now() -> datetime:
    return datetime.now(TZ)


def agenda_path(data_dir: Path) -> Path:
    return Path(data_dir) / "agenda.json"


def _ensure_store(data_dir: Path) -> dict:
    path = agenda_path(data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.is_file():
        data = {"version": 1, "source": "knowt_local", "events": []}
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return data
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        data = {"version": 1, "source": "knowt_local", "events": []}
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return data


def _save(data_dir: Path, data: dict) -> None:
    path = agenda_path(data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _event_start_date(ev: dict) -> Optional[date]:
    try:
        start = datetime.fromisoformat(str(ev.get("start", "")).replace("Z", "+00:00"))
        if start.tzinfo is None:
            start = start.replace(tzinfo=TZ)
        return start.astimezone(TZ).date()
    except ValueError:
        return None


def list_events(data_dir: Path, d0: date, d1: date) -> List[dict]:
    data = _ensure_store(data_dir)
    out: List[dict] = []
    for ev in data.get("events") or []:
        start_local = _event_start_date(ev)
        if start_local is None:
            continue
        if d0 <= start_local <= d1:
            out.append(ev)
    out.sort(key=lambda e: str(e.get("start") or ""))
    return out


def google_status() -> Dict[str, Any]:
    from knowt.google_oauth import status as gstatus

    return gstatus()


def list_events_merged(data_dir: Path, d0: date, d1: date) -> List[dict]:
    local = list_events(data_dir, d0, d1)
    try:
        from knowt.google_oauth import list_google_events

        gcal = list_google_events(d0, d1)
    except Exception:
        gcal = []
    merged = list(local) + list(gcal)
    merged.sort(key=lambda e: str(e.get("start") or ""))
    return merged


def add_event(
    data_dir: Path,
    title: str,
    start_iso: str,
    end_iso: str | None = None,
    kind: str = "reuniao",
) -> dict:
    title = (title or "").strip()
    if not title:
        raise ValueError("title_required")
    if len(title) > 500:
        raise ValueError("title_too_long")
    start = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    if start.tzinfo is None:
        start = start.replace(tzinfo=TZ)
    if end_iso:
        end = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
        if end.tzinfo is None:
            end = end.replace(tzinfo=TZ)
    else:
        end = start + timedelta(hours=1)

    # Preferir Google quando ligado; sempre guardar espelho local
    try:
        from knowt.google_oauth import create_google_event, is_connected

        if is_connected():
            gev = create_google_event(
                title,
                start.astimezone(TZ).isoformat(),
                end.astimezone(TZ).isoformat(),
            )
            # espelho local com referência google
            ev = {
                "id": gev.get("id") or str(uuid.uuid4()),
                "title": gev.get("title") or title,
                "start": gev.get("start") or start.astimezone(TZ).isoformat(),
                "end": gev.get("end") or end.astimezone(TZ).isoformat(),
                "kind": "google",
                "source": "google_calendar",
                "html_link": gev.get("html_link"),
            }
            data = _ensure_store(data_dir)
            events = list(data.get("events") or [])
            events.append(ev)
            data["events"] = events
            _save(data_dir, data)
            return ev
    except Exception:
        pass

    ev = {
        "id": str(uuid.uuid4()),
        "title": title,
        "start": start.astimezone(TZ).isoformat(),
        "end": end.astimezone(TZ).isoformat(),
        "kind": kind or "reuniao",
        "source": "knowt_local",
    }
    data = _ensure_store(data_dir)
    events = list(data.get("events") or [])
    events.append(ev)
    data["events"] = events
    _save(data_dir, data)
    return ev
