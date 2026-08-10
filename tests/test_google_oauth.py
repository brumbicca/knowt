"""Testes OAuth Google sem rede."""
from __future__ import annotations

from pathlib import Path

import pytest

from knowt.google_oauth import build_auth_url, exchange_code, status


def test_status_without_credentials(monkeypatch, tmp_path: Path):
    monkeypatch.delenv("KNOWT_GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("KNOWT_GOOGLE_CLIENT_SECRET", raising=False)
    monkeypatch.delenv("GOOGLE_CALENDAR_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_CALENDAR_CLIENT_SECRET", raising=False)
    monkeypatch.setenv("KNOWT_GOOGLE_TOKEN_PATH", str(tmp_path / "tokens.json"))
    st = status()
    assert st["google_connected"] is False
    assert st["credentials_configured"] is False
    assert st["mode"] == "knowt_local"


def test_build_auth_url_requires_credentials(monkeypatch, tmp_path: Path):
    monkeypatch.delenv("KNOWT_GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("KNOWT_GOOGLE_CLIENT_SECRET", raising=False)
    monkeypatch.delenv("GOOGLE_CALENDAR_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_CALENDAR_CLIENT_SECRET", raising=False)
    with pytest.raises(ValueError, match="google_credentials_missing"):
        build_auth_url()


def test_build_auth_url_writes_state(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("KNOWT_GOOGLE_CLIENT_ID", "cid-test")
    monkeypatch.setenv("KNOWT_GOOGLE_CLIENT_SECRET", "csec-test")
    monkeypatch.setenv(
        "KNOWT_GOOGLE_REDIRECT_URI",
        "https://knowt.com.br/api/bridge/agenda/google/callback",
    )
    state_path = tmp_path / "state.json"
    monkeypatch.setenv("KNOWT_GOOGLE_STATE_PATH", str(state_path))
    monkeypatch.setenv("KNOWT_GOOGLE_TOKEN_PATH", str(tmp_path / "tokens.json"))
    out = build_auth_url()
    assert "accounts.google.com" in out["auth_url"]
    assert out["state"]
    assert state_path.is_file()
    assert out["state"] in state_path.read_text(encoding="utf-8")


def test_exchange_code_rejects_bad_state(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("KNOWT_GOOGLE_CLIENT_ID", "cid-test")
    monkeypatch.setenv("KNOWT_GOOGLE_CLIENT_SECRET", "csec-test")
    monkeypatch.setenv("KNOWT_GOOGLE_STATE_PATH", str(tmp_path / "state.json"))
    monkeypatch.setenv("KNOWT_GOOGLE_TOKEN_PATH", str(tmp_path / "tokens.json"))
    build_auth_url()
    with pytest.raises(ValueError, match="invalid_oauth_state"):
        exchange_code("fake-code", "wrong-state")
