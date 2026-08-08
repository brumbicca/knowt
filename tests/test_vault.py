from pathlib import Path

import pytest

from knowt.vault import VaultError, has_secret, public_ref_status, resolve_secret


def test_normalize_and_resolve(monkeypatch):
    monkeypatch.setenv("KNOWT_SECRET_TINY_TOKEN", "abc")
    assert resolve_secret("KNOWT_SECRET_TINY_TOKEN") == "abc"
    assert resolve_secret("ENV:KNOWT_SECRET_TINY_TOKEN") == "abc"
    assert has_secret("KNOWT_SECRET_TINY_TOKEN") is True


def test_missing_required(monkeypatch):
    monkeypatch.delenv("KNOWT_SECRET_TINY_TOKEN", raising=False)
    with pytest.raises(VaultError):
        resolve_secret("KNOWT_SECRET_TINY_TOKEN")
    assert has_secret("KNOWT_SECRET_TINY_TOKEN") is False


def test_public_ref_status_never_leaks(monkeypatch):
    monkeypatch.setenv("KNOWT_SECRET_TINY_TOKEN", "super-secret")
    st = public_ref_status("KNOWT_SECRET_TINY_TOKEN")
    assert st["present"] is True
    assert "super-secret" not in str(st)


def test_invalid_ref():
    with pytest.raises(VaultError):
        resolve_secret("../etc/passwd")
