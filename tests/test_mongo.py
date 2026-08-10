"""Mongo ping (mocked)."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

from knowt.mongo import ping_mongo, reset_client


def test_ping_ok():
    reset_client()
    client = MagicMock()
    client.admin.command.return_value = {"ok": 1}
    with patch("knowt.mongo.get_client", return_value=client):
        out = ping_mongo()
    assert out["ok"] is True
    assert out["db"] == "knowt" or out.get("configured")


def test_ping_missing_pymongo():
    reset_client()
    with patch("knowt.mongo.get_client", return_value=None):
        out = ping_mongo()
    assert out["ok"] is False
    assert out["error"] == "pymongo_missing"
