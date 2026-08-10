"""Testes do bot Telegram fino (sem rede)."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

from knowt.telegram_bot import KnowtTelegramBot, parse_allowlist


def test_parse_allowlist_any():
    assert parse_allowlist(None) is None
    assert parse_allowlist("*") is None
    assert parse_allowlist("any") is None


def test_parse_allowlist_ids():
    assert parse_allowlist("1, 2;3") == {"1", "2", "3"}


def test_plain_telegram_strips_markdown():
    from knowt.telegram_bot import _plain_telegram

    assert _plain_telegram("Há **10** pedidos e `id`") == "Há 10 pedidos e id"


def test_handle_start_and_ask():
    bot = KnowtTelegramBot(
        bot_token="t",
        bridge_url="http://127.0.0.1:8766",
        bridge_token="k",
        allowlist=None,
    )
    bot.send_message = MagicMock()
    bot.send_chat_action = MagicMock()
    bot.get_me = MagicMock(return_value={"username": "knowt_bot"})
    bot.ask_knowt = MagicMock(
        return_value={"reply": "Há 10 pedidos.", "reply_html": "<b>Há 10 pedidos.</b>"}
    )

    bot.handle_update({"message": {"chat": {"id": 99}, "text": "/start"}})
    assert bot.send_message.called
    assert "knowt" in bot.send_message.call_args[0][1].lower()

    bot.send_message.reset_mock()
    bot.handle_update({"message": {"chat": {"id": 99}, "text": "pedidos esta semana"}})
    bot.ask_knowt.assert_called_once()
    bot.send_message.assert_called_once_with(
        "99", "<b>Há 10 pedidos.</b>", parse_mode="HTML"
    )


def test_handle_ask_plain_fallback():
    bot = KnowtTelegramBot(
        bot_token="t",
        bridge_url="http://127.0.0.1:8766",
        bridge_token="k",
        allowlist=None,
    )
    bot.send_message = MagicMock()
    bot.send_chat_action = MagicMock()
    bot.ask_knowt = MagicMock(return_value={"reply": "texto simples", "reply_html": ""})
    bot.handle_update({"message": {"chat": {"id": 99}, "text": "oi"}})
    bot.send_message.assert_called_once_with("99", "texto simples")


def test_allowlist_blocks():
    bot = KnowtTelegramBot(
        bot_token="t",
        bridge_url="http://127.0.0.1:8766",
        bridge_token="k",
        allowlist={"1"},
    )
    bot.send_message = MagicMock()
    bot.handle_update({"message": {"chat": {"id": 99}, "text": "ola"}})
    assert "allowlist" in bot.send_message.call_args[0][1].lower()


def test_ask_knowt_calls_bridge():
    bot = KnowtTelegramBot(
        bot_token="t",
        bridge_url="http://127.0.0.1:8766",
        bridge_token="secret",
    )
    with patch("knowt.telegram_bot._http_json") as http:
        http.return_value = {
            "ok": True,
            "reply": "ok reply",
            "reply_html": "<pre>ok</pre>",
            "engine": "deterministic",
        }
        out = bot.ask_knowt("ping", chat_id="7")
    assert out["reply"] == "ok reply"
    assert out["reply_html"] == "<pre>ok</pre>"
    args, kwargs = http.call_args
    assert args[0].endswith("/api/bridge/assistant/chat")
    assert kwargs["headers"]["X-Knowt-Token"] == "secret"
    assert kwargs["payload"]["message"] == "ping"


def test_ask_knowt_hermes_builds_html(monkeypatch):
    bot = KnowtTelegramBot(
        bot_token="t",
        bridge_url="http://127.0.0.1:8766",
        bridge_token="secret",
    )
    monkeypatch.setenv("KNOWT_TELEGRAM_ENGINE", "hermes")
    with patch("knowt.telegram_bot._http_json") as http:
        http.return_value = {
            "ok": True,
            "reply": "Indicador | Valor\n---|---\nPedidos | 3\n\nSão **3** pedidos.",
            "engine": "hermes",
        }
        out = bot.ask_knowt("ping", chat_id="7")
    assert out["engine"] == "hermes"
    assert "<pre>" in out["reply_html"]
    assert http.call_args.kwargs["payload"]["context"]["engine"] == "hermes"


def test_handle_ask_sends_typing():
    bot = KnowtTelegramBot(
        bot_token="t",
        bridge_url="http://127.0.0.1:8766",
        bridge_token="k",
    )
    bot.send_message = MagicMock()
    bot.send_chat_action = MagicMock()
    bot.ask_knowt = MagicMock(return_value={"reply": "ok", "reply_html": ""})
    bot.handle_update({"message": {"chat": {"id": 1}, "text": "oi"}})
    bot.send_chat_action.assert_called_once_with("1", "typing")

