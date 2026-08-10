"""Org registry (tenancy MVP)."""
from __future__ import annotations

from pathlib import Path

from knowt.app import create_app
from knowt.config import Settings
from knowt.orgs import OrgRegistry, assert_source_in_org, seed_default_org


def _settings(tmp_path: Path) -> Settings:
    return Settings(
        env="test",
        data_dir=tmp_path,
        org_id="default",
        host="127.0.0.1",
        port=8766,
        api_token="tok",
        chat_password="",
        secret_key="x",
        mongo_uri="mongodb://127.0.0.1:27017",
        mongo_db="knowt_test",
    )


def test_seed_default_and_list(tmp_path: Path, monkeypatch):
    monkeypatch.setattr("knowt.mongo.ping_mongo", lambda: {"ok": False})
    from knowt.mongo import reset_client

    reset_client()
    reg = OrgRegistry(tmp_path)
    org = seed_default_org(reg, org_id="default")
    assert org.org_id == "default"
    assert reg.get("default") is not None
    assert (tmp_path / "orgs.json").exists()


def test_assert_source_in_org():
    assert assert_source_in_org("default", "default")
    assert not assert_source_in_org("acme", "default")


def test_organizacoes_api(tmp_path: Path, monkeypatch):
    monkeypatch.setattr("knowt.mongo.ping_mongo", lambda: {"ok": False})
    app = create_app(_settings(tmp_path))
    client = app.test_client()
    r = client.get(
        "/api/bridge/organizacoes",
        headers={"X-Knowt-Token": "tok"},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["ok"] is True
    assert body["total"] >= 1
    assert any(o["org_id"] == "default" for o in body["orgs"])

    h = client.get("/api/bridge/health")
    assert h.get_json()["org_id"] == "default"
    assert h.get_json()["orgs_count"] >= 1
