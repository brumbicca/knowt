"""Bot Telegram fino → knowt bridge (sem Hermes Fiesta).

Long-polling Bot API → POST /api/bridge/assistant/chat em loopback.
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Set

log = logging.getLogger("knowt.telegram")

TG_API = "https://api.telegram.org"


def _plain_telegram(text: str) -> str:
    """Remove marcadores markdown leves (Telegram sem parse_mode)."""
    out = (text or "").replace("**", "").replace("`", "")
    out = re.sub(r"[ \t]+\n", "\n", out)
    return out.strip()


def _http_json(
    url: str,
    *,
    payload: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
    timeout: float = 60.0,
    method: Optional[str] = None,
) -> Dict[str, Any]:
    data = None
    hdrs = dict(headers or {})
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
        method = method or "POST"
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method or "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"HTTP {exc.code}: {body}") from exc


def parse_allowlist(raw: str | None) -> Optional[Set[str]]:
    """None = permitir qualquer chat; set = só estes chat_id."""
    text = (raw or "").strip()
    if not text or text in ("*", "any", "ALL", "all"):
        return None
    ids = {p.strip() for p in text.replace(";", ",").split(",") if p.strip()}
    return ids or None


def telegram_configured(token: str | None) -> bool:
    return bool((token or "").strip())


class KnowtTelegramBot:
    def __init__(
        self,
        *,
        bot_token: str,
        bridge_url: str,
        bridge_token: str,
        allowlist: Optional[Set[str]] = None,
        source_id: str = "tinyerp",
        poll_timeout: int = 25,
    ) -> None:
        self.bot_token = bot_token.strip()
        self.bridge_url = bridge_url.rstrip("/")
        self.bridge_token = bridge_token.strip()
        self.allowlist = allowlist
        self.source_id = source_id
        self.poll_timeout = max(5, int(poll_timeout))
        self.offset = 0
        self._me: Optional[Dict[str, Any]] = None

    def _tg(self, method: str, payload: Optional[Dict[str, Any]] = None, *, timeout: float = 60.0) -> Dict[str, Any]:
        url = f"{TG_API}/bot{self.bot_token}/{method}"
        return _http_json(url, payload=payload, timeout=timeout)

    def get_me(self) -> Dict[str, Any]:
        if self._me is None:
            out = self._tg("getMe", timeout=30.0)
            if not out.get("ok"):
                raise RuntimeError(f"getMe failed: {out}")
            self._me = out.get("result") or {}
        return self._me

    def send_message(
        self,
        chat_id: int | str,
        text: str,
        *,
        parse_mode: Optional[str] = None,
    ) -> None:
        # Telegram limita ~4096 chars
        if parse_mode == "HTML":
            chunk = (text or "").strip() or "(sem resposta)"
        else:
            chunk = _plain_telegram(text) or "(sem resposta)"
        for i in range(0, len(chunk), 3500):
            part = chunk[i : i + 3500]
            payload: Dict[str, Any] = {
                "chat_id": chat_id,
                "text": part,
                "disable_web_page_preview": True,
            }
            if parse_mode:
                payload["parse_mode"] = parse_mode
            self._tg("sendMessage", payload, timeout=45.0)

    def send_chat_action(self, chat_id: int | str, action: str = "typing") -> None:
        try:
            self._tg(
                "sendChatAction",
                {"chat_id": chat_id, "action": action},
                timeout=15.0,
            )
        except Exception:
            log.debug("sendChatAction falhou", exc_info=True)

    def ask_knowt(self, message: str, *, chat_id: str) -> Dict[str, str]:
        url = f"{self.bridge_url}/api/bridge/assistant/chat"
        ctx: Dict[str, Any] = {
            "source_id": self.source_id,
            "channel": "telegram",
        }
        tg_engine = (os.environ.get("KNOWT_TELEGRAM_ENGINE") or "").strip().lower()
        if tg_engine in ("hermes", "deterministic"):
            ctx["engine"] = tg_engine
        body = _http_json(
            url,
            payload={
                "message": message,
                "session_id": f"tg-{chat_id}",
                "context": ctx,
            },
            headers={
                "X-Knowt-Token": self.bridge_token,
                "Authorization": f"Bearer {self.bridge_token}",
            },
            timeout=float(os.environ.get("KNOWT_TELEGRAM_BRIDGE_TIMEOUT") or "150"),
        )
        if not body.get("ok"):
            err = body.get("message") or body.get("error") or "knowt não respondeu."
            return {"reply": str(err), "reply_html": "", "engine": ""}
        reply = (body.get("reply") or "").strip() or "(sem texto)"
        reply_html = (body.get("reply_html") or "").strip()
        engine = str(body.get("engine") or "")
        if not reply_html and engine == "hermes":
            from knowt.telegram_format import hermes_reply_to_html

            reply_html = hermes_reply_to_html(reply)
        return {"reply": reply, "reply_html": reply_html, "engine": engine}

    def _allowed(self, chat_id: str) -> bool:
        if self.allowlist is None:
            return True
        return chat_id in self.allowlist

    def handle_update(self, update: Dict[str, Any]) -> None:
        msg = update.get("message") or update.get("edited_message") or {}
        chat = msg.get("chat") or {}
        chat_id = str(chat.get("id") or "")
        text = (msg.get("text") or "").strip()
        if not chat_id or not text:
            return
        if not self._allowed(chat_id):
            log.warning("chat_id bloqueado (allowlist): %s", chat_id)
            try:
                self.send_message(
                    chat_id,
                    "Este chat não está na allowlist do knowt. Peça para adicionar o teu chat_id.",
                )
            except Exception:
                pass
            return

        if text.startswith("/start"):
            me = self.get_me()
            uname = me.get("username") or "knowt"
            self.send_message(
                chat_id,
                (
                    f"Olá — sou o knowt (@{uname}).\n"
                    "Pergunta como no site, por exemplo:\n"
                    "· pedidos esta semana\n"
                    "· resumo de pedidos\n"
                    "· o que já conhecemos do Tiny?\n"
                    "· o que podes fazer?"
                ),
            )
            return
        if text.startswith("/help"):
            self.send_message(
                chat_id,
                "Comandos: /start · /help · /id\nOu escreve a pergunta em texto livre.",
            )
            return
        if text.startswith("/id"):
            self.send_message(chat_id, f"chat_id: `{chat_id}`")
            return

        try:
            self.send_chat_action(chat_id, "typing")
            out = self.ask_knowt(text, chat_id=chat_id)
        except Exception as exc:
            log.exception("bridge falhou")
            out = {
                "reply": f"Falha ao contactar o knowt: {type(exc).__name__}",
                "reply_html": "",
            }
        try:
            html = (out.get("reply_html") or "").strip()
            if html:
                self.send_message(chat_id, html, parse_mode="HTML")
            else:
                self.send_message(chat_id, out.get("reply") or "")
        except Exception:
            log.exception("sendMessage falhou chat_id=%s", chat_id)
            # fallback sem HTML se o Telegram rejeitar o markup
            try:
                self.send_message(chat_id, out.get("reply") or "(sem resposta)")
            except Exception:
                log.exception("sendMessage fallback falhou chat_id=%s", chat_id)

    def poll_once(self) -> int:
        payload = {
            "offset": self.offset,
            "timeout": self.poll_timeout,
            "allowed_updates": ["message", "edited_message"],
        }
        # long poll: timeout HTTP > timeout Telegram
        out = self._tg("getUpdates", payload, timeout=float(self.poll_timeout + 15))
        if not out.get("ok"):
            raise RuntimeError(f"getUpdates failed: {out}")
        updates: List[Dict[str, Any]] = list(out.get("result") or [])
        for upd in updates:
            uid = int(upd.get("update_id") or 0)
            self.offset = max(self.offset, uid + 1)
            try:
                self.handle_update(upd)
            except Exception:
                log.exception("update %s", uid)
        return len(updates)

    def run_forever(self) -> None:
        me = self.get_me()
        log.info(
            "Telegram bot @%s a escutar → %s (allowlist=%s)",
            me.get("username"),
            self.bridge_url,
            "any" if self.allowlist is None else ",".join(sorted(self.allowlist)),
        )
        backoff = 2.0
        while True:
            try:
                self.poll_once()
                backoff = 2.0
            except Exception:
                log.exception("poll erro — retry em %.0fs", backoff)
                time.sleep(backoff)
                backoff = min(backoff * 1.5, 60.0)


def bot_from_env() -> KnowtTelegramBot:
    token = (os.environ.get("KNOWT_TELEGRAM_BOT_TOKEN") or "").strip()
    if not token:
        raise SystemExit(2)  # RestartPreventExitStatus=2
    bridge = (
        os.environ.get("KNOWT_TELEGRAM_BRIDGE_URL")
        or os.environ.get("KNOWT_BRIDGE_URL")
        or "http://127.0.0.1:8766"
    ).strip()
    bridge_token = (
        os.environ.get("KNOWT_API_TOKEN")
        or os.environ.get("KNOWT_TELEGRAM_BRIDGE_TOKEN")
        or ""
    ).strip()
    if not bridge_token:
        raise SystemExit("KNOWT_API_TOKEN em falta para o bot Telegram")
    allow = parse_allowlist(os.environ.get("KNOWT_TELEGRAM_CHAT_IDS"))
    source = (os.environ.get("KNOWT_TELEGRAM_SOURCE_ID") or "tinyerp").strip() or "tinyerp"
    return KnowtTelegramBot(
        bot_token=token,
        bridge_url=bridge,
        bridge_token=bridge_token,
        allowlist=allow,
        source_id=source,
        poll_timeout=int(os.environ.get("KNOWT_TELEGRAM_POLL_TIMEOUT") or "25"),
    )
