"""Testes WhatsApp Cloud (sem rede)."""
from __future__ import annotations

import hashlib
import hmac
from pathlib import Path

from knowt.app import create_app
from knowt.config import Settings
from knowt.whatsapp import (
    extract_inbound_texts,
    parse_allowlist,
    plain_whatsapp,
    verify_signature,
    verify_webhook_challenge,
    whatsapp_configured,
)


def _settings(tmp_path: Path) -> Settings:
    return Settings(
        env="test",
        data_dir=tmp_path,
        org_id="t",
        host="127.0.0.1",
        port=8766,
        api_token="tok",
        chat_password="",
        secret_key="x",
        mongo_uri="mongodb://127.0.0.1:27017",
        mongo_db="knowt_test",
    )


def test_whatsapp_configured():
    assert whatsapp_configured(token="t", phone_number_id="1")
    assert not whatsapp_configured(token="", phone_number_id="1")
    assert not whatsapp_configured(token="t", phone_number_id="")


def test_parse_allowlist():
    assert parse_allowlist("*") is None
    assert parse_allowlist("+55 11 99999-8888, 5511888777666") == {
        "5511999998888",
        "5511888777666",
    }


def test_plain_whatsapp_strips_html():
    assert "ok" in plain_whatsapp("<pre>ok</pre> **x**")
    assert "<pre>" not in plain_whatsapp("<pre>ok</pre>")


def test_verify_challenge():
    assert (
        verify_webhook_challenge(
            mode="subscribe",
            token="segredo",
            challenge="123",
            expected_verify_token="segredo",
        )
        == "123"
    )
    assert (
        verify_webhook_challenge(
            mode="subscribe",
            token="errado",
            challenge="123",
            expected_verify_token="segredo",
        )
        is None
    )


def test_verify_signature():
    body = b'{"ok":true}'
    secret = "appsecret"
    sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert verify_signature(body, sig, secret)
    assert not verify_signature(body, "sha256=dead", secret)
    assert verify_signature(body, None, "")


def test_extract_inbound():
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {
                                    "from": "5511999998888",
                                    "type": "text",
                                    "text": {"body": "pedidos esta semana"},
                                },
                                {"from": "1", "type": "image"},
                            ]
                        }
                    }
                ]
            }
        ]
    }
    assert extract_inbound_texts(payload) == [
        ("5511999998888", "pedidos esta semana")
    ]


def test_webhook_verify_route(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("KNOWT_WHATSAPP_VERIFY_TOKEN", "verify-me")
    app = create_app(_settings(tmp_path))
    client = app.test_client()
    r = client.get(
        "/api/bridge/whatsapp/webhook",
        query_string={
            "hub.mode": "subscribe",
            "hub.verify_token": "verify-me",
            "hub.challenge": "42",
        },
    )
    assert r.status_code == 200
    assert r.data == b"42"


def test_webhook_post_not_configured(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("KNOWT_WHATSAPP_TOKEN", raising=False)
    monkeypatch.delenv("KNOWT_WHATSAPP_PHONE_NUMBER_ID", raising=False)
    app = create_app(_settings(tmp_path))
    client = app.test_client()
    r = client.post(
        "/api/bridge/whatsapp/webhook",
        data=b'{"object":"whatsapp_business_account"}',
        content_type="application/json",
    )
    assert r.status_code == 503


def test_health_lists_whatsapp(tmp_path: Path):
    app = create_app(_settings(tmp_path))
    h = app.test_client().get("/api/bridge/health")
    assert h.status_code == 200
    body = h.get_json()
    assert "whatsapp_configured" in body
    assert body["whatsapp_webhook"] == "/api/bridge/whatsapp/webhook"
