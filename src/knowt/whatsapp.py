"""WhatsApp Cloud API (Meta) — webhook + reply fino → bridge knowt."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import re
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

log = logging.getLogger("knowt.whatsapp")

GRAPH = "https://graph.facebook.com/v21.0"


def whatsapp_configured(
    token: Optional[str] = None,
    phone_number_id: Optional[str] = None,
) -> bool:
    tok = (token if token is not None else os.environ.get("KNOWT_WHATSAPP_TOKEN") or "").strip()
    pid = (
        phone_number_id
        if phone_number_id is not None
        else os.environ.get("KNOWT_WHATSAPP_PHONE_NUMBER_ID")
        or ""
    ).strip()
    return bool(tok and pid)


def parse_allowlist(raw: str | None) -> Optional[Set[str]]:
    text = (raw or "").strip()
    if not text or text in ("*", "any", "ALL", "all"):
        return None
    ids = {re.sub(r"\D", "", p) for p in text.replace(";", ",").split(",") if p.strip()}
    return {x for x in ids if x} or None


def plain_whatsapp(text: str) -> str:
    """WhatsApp Cloud: texto simples (sem HTML Telegram)."""
    out = text or ""
    out = re.sub(r"</?(?:pre|code|b|i|strong|em)>", "", out, flags=re.I)
    out = out.replace("**", "*")
    out = out.replace("`", "")
    out = re.sub(r"[ \t]+\n", "\n", out)
    return out.strip()[:4000] or "(sem resposta)"


def verify_webhook_challenge(
    *,
    mode: str,
    token: str,
    challenge: str,
    expected_verify_token: str,
) -> Optional[str]:
    if mode != "subscribe":
        return None
    if not expected_verify_token or token != expected_verify_token:
        return None
    return challenge


def verify_signature(raw_body: bytes, header: str | None, app_secret: str) -> bool:
    """X-Hub-Signature-256: sha256=<hex>. Se app_secret vazio, aceita (dev)."""
    secret = (app_secret or "").strip()
    if not secret:
        return True
    if not header or not header.startswith("sha256="):
        return False
    got = header.split("=", 1)[1].strip()
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, got)


def extract_inbound_texts(payload: Dict[str, Any]) -> List[Tuple[str, str]]:
    """[(wa_id, text), ...] — só mensagens de texto."""
    out: List[Tuple[str, str]] = []
    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            for msg in value.get("messages") or []:
                if (msg.get("type") or "") != "text":
                    continue
                wa_id = str(msg.get("from") or "").strip()
                text = ((msg.get("text") or {}).get("body") or "").strip()
                if wa_id and text:
                    out.append((wa_id, text))
    return out


def _http_json(
    url: str,
    *,
    payload: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
    timeout: float = 60.0,
) -> Dict[str, Any]:
    data = None
    hdrs = dict(headers or {})
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=hdrs, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"HTTP {exc.code}: {body}") from exc


def send_text(
    *,
    phone_number_id: str,
    access_token: str,
    to_wa_id: str,
    text: str,
) -> Dict[str, Any]:
    url = f"{GRAPH}/{phone_number_id}/messages"
    body = {
        "messaging_product": "whatsapp",
        "to": re.sub(r"\D", "", str(to_wa_id)),
        "type": "text",
        "text": {"preview_url": False, "body": plain_whatsapp(text)},
    }
    return _http_json(
        url,
        payload=body,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=45.0,
    )


def mark_read(
    *,
    phone_number_id: str,
    access_token: str,
    message_id: str,
) -> None:
    if not message_id:
        return
    url = f"{GRAPH}/{phone_number_id}/messages"
    try:
        _http_json(
            url,
            payload={
                "messaging_product": "whatsapp",
                "status": "read",
                "message_id": message_id,
            },
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=20.0,
        )
    except Exception:
        log.debug("mark_read falhou", exc_info=True)


def handle_webhook_messages(
    payload: Dict[str, Any],
    *,
    allowlist: Optional[Set[str]],
    access_token: str,
    phone_number_id: str,
    reply_fn: Callable[[str, str], str],
) -> int:
    """Processa inbound; reply_fn(wa_id, text) -> reply. Devolve quantas respostas enviadas."""
    sent = 0
    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            for msg in value.get("messages") or []:
                if (msg.get("type") or "") != "text":
                    continue
                wa_id = str(msg.get("from") or "").strip()
                text = ((msg.get("text") or {}).get("body") or "").strip()
                mid = str(msg.get("id") or "")
                if not wa_id or not text:
                    continue
                digits = re.sub(r"\D", "", wa_id)
                if allowlist is not None and digits not in allowlist and wa_id not in allowlist:
                    log.warning("wa_id bloqueado (allowlist): %s", wa_id)
                    try:
                        send_text(
                            phone_number_id=phone_number_id,
                            access_token=access_token,
                            to_wa_id=wa_id,
                            text="Este número não está na allowlist do knowt.",
                        )
                    except Exception:
                        pass
                    continue
                mark_read(
                    phone_number_id=phone_number_id,
                    access_token=access_token,
                    message_id=mid,
                )
                low = text.strip().lower()
                if low in ("/start", "start", "oi", "olá", "ola", "/help", "help"):
                    reply = (
                        "Olá — sou o knowt no WhatsApp.\n"
                        "Pergunta como no site, por exemplo:\n"
                        "· pedidos esta semana\n"
                        "· o que já conhecemos do Tiny?\n"
                        "· o que podes fazer?"
                    )
                elif low in ("/id", "id"):
                    reply = f"wa_id: {wa_id}"
                else:
                    try:
                        reply = reply_fn(wa_id, text) or "(sem resposta)"
                    except Exception as exc:
                        log.exception("reply_fn falhou")
                        reply = f"Falha no knowt: {type(exc).__name__}"
                try:
                    send_text(
                        phone_number_id=phone_number_id,
                        access_token=access_token,
                        to_wa_id=wa_id,
                        text=reply,
                    )
                    sent += 1
                except Exception:
                    log.exception("send WhatsApp falhou wa_id=%s", wa_id)
    return sent
