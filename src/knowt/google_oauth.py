#!/usr/bin/env python3
"""Google Calendar + OAuth (REST, sem SDK). Tokens em ficheiro local knowt."""
from __future__ import annotations

import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Sao_Paulo")
CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"
TASKS_SCOPE = "https://www.googleapis.com/auth/tasks"
SCOPES = (CALENDAR_SCOPE, TASKS_SCOPE)
SCOPE = " ".join(SCOPES)
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
DEFAULT_REDIRECT = "https://knowt.com.br/api/bridge/agenda/google/callback"
DEFAULT_DATA = Path(os.environ.get("KNOWT_DATA_DIR", "/root/knowt-data"))
DEFAULT_TOKEN_PATH = Path(
    os.environ.get("KNOWT_GOOGLE_TOKEN_PATH", str(DEFAULT_DATA / "google_tokens.json"))
)
DEFAULT_STATE_PATH = Path(
    os.environ.get("KNOWT_GOOGLE_STATE_PATH", str(DEFAULT_DATA / "google_oauth_state.json"))
)


def _token_path() -> Path:
    return Path(os.environ.get("KNOWT_GOOGLE_TOKEN_PATH", str(DEFAULT_TOKEN_PATH)))


def _state_path() -> Path:
    return Path(os.environ.get("KNOWT_GOOGLE_STATE_PATH", str(DEFAULT_STATE_PATH)))


def client_id() -> str:
    return (
        os.environ.get("KNOWT_GOOGLE_CLIENT_ID")
        or os.environ.get("GOOGLE_CALENDAR_CLIENT_ID")
        or ""
    ).strip()


def client_secret() -> str:
    return (
        os.environ.get("KNOWT_GOOGLE_CLIENT_SECRET")
        or os.environ.get("GOOGLE_CALENDAR_CLIENT_SECRET")
        or ""
    ).strip()


def redirect_uri() -> str:
    return (
        os.environ.get("KNOWT_GOOGLE_REDIRECT_URI")
        or os.environ.get("GOOGLE_CALENDAR_REDIRECT_URI")
        or DEFAULT_REDIRECT
    ).strip()


def credentials_configured() -> bool:
    return bool(client_id() and client_secret())


def _load_tokens() -> dict:
    p = _token_path()
    if not p.is_file():
        rt = (os.environ.get("KNOWT_GOOGLE_REFRESH_TOKEN") or "").strip()
        if rt:
            return {"refresh_token": rt}
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_tokens(data: dict) -> None:
    p = _token_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        p.chmod(0o600)
    except OSError:
        pass


def refresh_token() -> str:
    return str(
        _load_tokens().get("refresh_token")
        or os.environ.get("KNOWT_GOOGLE_REFRESH_TOKEN")
        or ""
    ).strip()


def is_connected() -> bool:
    return credentials_configured() and bool(refresh_token())


def has_granted_scope(scope: str) -> bool:
    granted = set(str(_load_tokens().get("scope") or "").split())
    return scope in granted


def status() -> dict:
    creds = credentials_configured()
    connected = is_connected()
    if connected:
        msg = "Google Calendar ligado."
        mode = "google"
    elif creds:
        msg = "Credenciais Google prontas — falta autorizar a conta (auth-url)."
        mode = "google_pending_auth"
    else:
        msg = (
            "Agenda local knowt activa. Para Google: criar OAuth Client "
            "e definir KNOWT_GOOGLE_CLIENT_ID / CLIENT_SECRET — ver docs/GOOGLE.md."
        )
        mode = "knowt_local"
    return {
        "google_connected": connected,
        "credentials_configured": creds,
        "mode": mode,
        "message": msg,
        "redirect_uri": redirect_uri() if creds else None,
        "auth_available": creds,
    }


def build_auth_url() -> dict:
    if not credentials_configured():
        raise ValueError("google_credentials_missing")
    state = secrets.token_urlsafe(24)
    sp = _state_path()
    sp.parent.mkdir(parents=True, exist_ok=True)
    sp.write_text(
        json.dumps({"state": state, "created_at": datetime.now(TZ).isoformat()}),
        encoding="utf-8",
    )
    try:
        sp.chmod(0o600)
    except OSError:
        pass
    params = {
        "client_id": client_id(),
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return {
        "auth_url": f"{AUTH_URL}?{urllib.parse.urlencode(params)}",
        "redirect_uri": redirect_uri(),
        "state": state,
    }


def _verify_state(state: str) -> bool:
    expected = ""
    sp = _state_path()
    if sp.is_file():
        try:
            expected = str(json.loads(sp.read_text(encoding="utf-8")).get("state") or "")
        except (json.JSONDecodeError, OSError):
            expected = ""
    return bool(state) and bool(expected) and secrets.compare_digest(state, expected)


def exchange_code(code: str, state: str) -> dict:
    if not credentials_configured():
        raise ValueError("google_credentials_missing")
    if not _verify_state(state):
        raise ValueError("invalid_oauth_state")
    code = (code or "").strip()
    if not code:
        raise ValueError("code_required")
    body = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": client_id(),
            "client_secret": client_secret(),
            "redirect_uri": redirect_uri(),
            "grant_type": "authorization_code",
        }
    ).encode()
    req = urllib.request.Request(
        TOKEN_URL,
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:400] if e.fp else str(e)
        raise ValueError(f"token_exchange_failed:{detail}") from e

    tokens = _load_tokens()
    if payload.get("refresh_token"):
        tokens["refresh_token"] = payload["refresh_token"]
    elif not tokens.get("refresh_token") and not refresh_token():
        raise ValueError("no_refresh_token_returned")
    tokens["access_token"] = payload.get("access_token")
    tokens["expires_at"] = (
        datetime.now(timezone.utc) + timedelta(seconds=int(payload.get("expires_in") or 3600))
    ).isoformat()
    tokens["token_type"] = payload.get("token_type", "Bearer")
    tokens["scope"] = payload.get("scope", SCOPE)
    tokens["updated_at"] = datetime.now(TZ).isoformat()
    _save_tokens(tokens)
    try:
        _state_path().unlink(missing_ok=True)
    except OSError:
        pass
    return {"ok": True, "google_connected": True}


def _refresh_access_token() -> str:
    tokens = _load_tokens()
    cached = str(tokens.get("access_token") or "")
    exp = tokens.get("expires_at")
    if cached and exp:
        try:
            exp_dt = datetime.fromisoformat(str(exp).replace("Z", "+00:00"))
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if exp_dt > datetime.now(timezone.utc) + timedelta(seconds=60):
                return cached
        except ValueError:
            pass
    rt = refresh_token()
    if not rt:
        raise ValueError("not_connected")
    body = urllib.parse.urlencode(
        {
            "client_id": client_id(),
            "client_secret": client_secret(),
            "refresh_token": rt,
            "grant_type": "refresh_token",
        }
    ).encode()
    req = urllib.request.Request(
        TOKEN_URL,
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode())
    tokens["access_token"] = payload["access_token"]
    tokens["expires_at"] = (
        datetime.now(timezone.utc) + timedelta(seconds=int(payload.get("expires_in") or 3600))
    ).isoformat()
    if payload.get("refresh_token"):
        tokens["refresh_token"] = payload["refresh_token"]
    _save_tokens(tokens)
    return str(tokens["access_token"])


def _api_request(method: str, url: str, body: dict | None = None) -> dict:
    token = _refresh_access_token()
    data = None
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:500] if e.fp else str(e)
        raise ValueError(f"google_api_{e.code}:{detail}") from e


def _day_bounds(d0: date, d1: date) -> tuple[str, str]:
    start = datetime(d0.year, d0.month, d0.day, 0, 0, 0, tzinfo=TZ)
    end = datetime(d1.year, d1.month, d1.day, 23, 59, 59, tzinfo=TZ)
    return start.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"), end.astimezone(
        timezone.utc
    ).isoformat().replace("+00:00", "Z")


def _to_sp_iso(raw: str) -> str:
    dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TZ)
    return dt.astimezone(TZ).isoformat()


def list_google_events(d0: date, d1: date) -> list[dict]:
    if not is_connected():
        return []
    time_min, time_max = _day_bounds(d0, d1)
    qs = urllib.parse.urlencode(
        {
            "timeMin": time_min,
            "timeMax": time_max,
            "singleEvents": "true",
            "orderBy": "startTime",
            "maxResults": "50",
            "timeZone": "America/Sao_Paulo",
        }
    )
    payload = _api_request("GET", f"{EVENTS_URL}?{qs}")
    out: list[dict] = []
    for item in payload.get("items") or []:
        start_raw = (item.get("start") or {}).get("dateTime") or (item.get("start") or {}).get("date")
        end_raw = (item.get("end") or {}).get("dateTime") or (item.get("end") or {}).get("date")
        if not start_raw:
            continue
        if "T" not in str(start_raw):
            start_raw = f"{start_raw}T09:00:00-03:00"
        if end_raw and "T" not in str(end_raw):
            end_raw = f"{end_raw}T10:00:00-03:00"
        try:
            start_norm = _to_sp_iso(str(start_raw))
            end_norm = _to_sp_iso(str(end_raw)) if end_raw else None
        except ValueError:
            start_norm, end_norm = str(start_raw), str(end_raw) if end_raw else None
        out.append(
            {
                "id": f"gcal:{item.get('id')}",
                "title": item.get("summary") or "(sem título)",
                "start": start_norm,
                "end": end_norm,
                "kind": "google",
                "source": "google_calendar",
                "html_link": item.get("htmlLink"),
            }
        )
    return out


def create_google_event(title: str, start_iso: str, end_iso: str | None = None) -> dict:
    if not is_connected():
        raise ValueError("not_connected")
    start = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    if start.tzinfo is None:
        start = start.replace(tzinfo=TZ)
    else:
        start = start.astimezone(TZ)
    if end_iso:
        end = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
        if end.tzinfo is None:
            end = end.replace(tzinfo=TZ)
        else:
            end = end.astimezone(TZ)
    else:
        end = start + timedelta(hours=1)
    body = {
        "summary": title,
        "start": {"dateTime": start.isoformat(), "timeZone": "America/Sao_Paulo"},
        "end": {"dateTime": end.isoformat(), "timeZone": "America/Sao_Paulo"},
    }
    created = _api_request("POST", EVENTS_URL, body)
    start_out = (created.get("start") or {}).get("dateTime") or start.isoformat()
    end_out = (created.get("end") or {}).get("dateTime") or end.isoformat()
    try:
        start_out = _to_sp_iso(str(start_out))
        end_out = _to_sp_iso(str(end_out))
    except ValueError:
        pass
    return {
        "id": f"gcal:{created.get('id')}",
        "title": created.get("summary") or title,
        "start": start_out,
        "end": end_out,
        "kind": "google",
        "source": "google_calendar",
        "html_link": created.get("htmlLink"),
    }
