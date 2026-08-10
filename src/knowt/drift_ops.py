"""Operações de cron/alerta de drift (T8) — sem auto-kill."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, List


def alert_chat_ids() -> List[str]:
    raw = (
        os.environ.get("KNOWT_DRIFT_ALERT_CHAT_IDS")
        or os.environ.get("KNOWT_TELEGRAM_CHAT_IDS")
        or ""
    ).strip()
    if not raw or raw == "*":
        return []
    return [p.strip() for p in raw.split(",") if p.strip() and p.strip() != "*"]


def format_alert(event: dict) -> str:
    sid = event.get("source_id") or "tinyerp"
    codes = [a.get("code") for a in (event.get("alerts") or []) if a.get("code")]
    sev = event.get("severities") or []
    lines = [
        "knowt · alerta drift",
        f"fonte: {sid}",
        f"suggest_kill_switch: {bool(event.get('suggest_kill_switch'))}",
        f"auto_kill: {bool(event.get('auto_kill'))}",
        f"severidades: {', '.join(sev) if sev else 'n/d'}",
        f"codes: {', '.join(codes) if codes else 'nenhum'}",
        f"event_id: {event.get('id')}",
        "Kill switch continua manual: POST /fontes/{id}/kill-switch",
    ]
    return "\n".join(lines)


def send_telegram(text: str) -> Dict[str, Any]:
    token = (os.environ.get("KNOWT_TELEGRAM_BOT_TOKEN") or "").strip()
    chats = alert_chat_ids()
    if not token or not chats:
        return {"ok": False, "skipped": True, "reason": "no_token_or_chat_ids"}
    sent = 0
    errors: List[str] = []
    for chat_id in chats:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        body = json.dumps(
            {"chat_id": chat_id, "text": text[:3900], "disable_web_page_preview": True}
        ).encode()
        req = urllib.request.Request(
            url,
            data=body,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = json.loads(resp.read().decode())
            if raw.get("ok"):
                sent += 1
            else:
                errors.append(str(raw.get("description") or "tg_error")[:120])
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            errors.append(str(exc)[:120])
    return {"ok": sent > 0, "sent": sent, "errors": errors}


def maybe_alert(event: dict) -> Dict[str, Any]:
    always = (os.environ.get("KNOWT_DRIFT_ALERT_ALWAYS") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    if event.get("suggest_kill_switch") or always:
        return send_telegram(format_alert(event))
    return {"ok": False, "skipped": True, "reason": "no_suggest"}
