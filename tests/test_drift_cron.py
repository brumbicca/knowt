"""Testes alerta/cron drift (sem rede)."""
from __future__ import annotations

from knowt.drift_ops import alert_chat_ids, format_alert, maybe_alert, send_telegram


def test_format_alert_contains_flags():
    text = format_alert(
        {
            "id": "abc",
            "source_id": "tinyerp",
            "suggest_kill_switch": True,
            "auto_kill": False,
            "severities": ["error"],
            "alerts": [{"code": "CONTRACT_FIELD_MISSING"}],
        }
    )
    assert "suggest_kill_switch: True" in text
    assert "CONTRACT_FIELD_MISSING" in text
    assert "auto_kill: False" in text


def test_alert_chat_ids_ignores_star(monkeypatch):
    monkeypatch.setenv("KNOWT_TELEGRAM_CHAT_IDS", "*")
    monkeypatch.delenv("KNOWT_DRIFT_ALERT_CHAT_IDS", raising=False)
    assert alert_chat_ids() == []
    monkeypatch.setenv("KNOWT_DRIFT_ALERT_CHAT_IDS", "111,222")
    assert alert_chat_ids() == ["111", "222"]


def test_send_telegram_skips_without_config(monkeypatch):
    monkeypatch.delenv("KNOWT_TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("KNOWT_DRIFT_ALERT_CHAT_IDS", raising=False)
    monkeypatch.setenv("KNOWT_TELEGRAM_CHAT_IDS", "*")
    out = send_telegram("hello")
    assert out.get("skipped") is True


def test_maybe_alert_skips_without_suggest(monkeypatch):
    monkeypatch.delenv("KNOWT_DRIFT_ALERT_ALWAYS", raising=False)
    out = maybe_alert({"suggest_kill_switch": False, "alerts": []})
    assert out.get("reason") == "no_suggest"
