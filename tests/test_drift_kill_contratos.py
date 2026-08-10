"""Contratos, kill switch e drift (Fase 2/9 do plano)."""
from __future__ import annotations

from pathlib import Path

from knowt.app import create_app
from knowt.config import Settings
from knowt.contracts import (
    compute_hash,
    ensure_seed_contracts,
    get_published,
    set_contract_status,
)
from knowt.drift import detect_contract_alerts, detect_schema_alerts, run_drift_check
from knowt.enforcement import enforce
from knowt.kill_switch import set_kill_switch
from knowt.publish import publish_orders_list_live
from knowt.sources import SourceRegistry, seed_tiny_draft


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


def test_seed_contracts_and_hash(tmp_path: Path):
    created = ensure_seed_contracts(tmp_path)
    assert len(created) >= 2
    pub = get_published(tmp_path, "orders.v1")
    assert pub is not None
    assert pub["status"] == "published"
    assert pub["hash"] == compute_hash(pub)
    sales = get_published(tmp_path, "sales.v1")
    assert sales is None  # draft


def test_contract_status_transition(tmp_path: Path):
    ensure_seed_contracts(tmp_path)
    doc = set_contract_status(
        tmp_path,
        "sales.v1",
        "1.0.0",
        status="approved",
        actor="test",
        note="ok",
    )
    assert doc["status"] == "approved"
    assert doc["approvals"]


def test_schema_and_contract_alerts():
    baseline = {"fields": ["id", "situacao"]}
    alerts = detect_schema_alerts(
        baseline=baseline, current_fields={"id", "valor"}, sample_n=2
    )
    assert any(a["code"] == "FIELD_SET_CHANGED" for a in alerts)

    # contrato precisa de data_dir com seed
    from tempfile import TemporaryDirectory

    with TemporaryDirectory() as td:
        p = Path(td)
        ensure_seed_contracts(p)
        miss = detect_contract_alerts(p, current_fields=set())
        assert any(a["code"] == "CONTRACT_FIELD_MISSING" for a in miss)
        ok = detect_contract_alerts(p, current_fields={"id", "situacao"})
        assert ok == []


def test_kill_switch_blocks_enforce(tmp_path: Path, monkeypatch):
    monkeypatch.setattr("knowt.mongo.ping_mongo", lambda: {"ok": False})
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    publish_orders_list_live(reg, "tinyerp")
    set_kill_switch(reg, "tinyerp", suspended=True, reason="teste", actor="unit")
    enf = enforce(reg, message="pedidos esta semana", source_id="tinyerp")
    assert enf.reason_code == "SOURCE_SUSPENDED"
    assert enf.mode == "refuse"

    set_kill_switch(reg, "tinyerp", suspended=False, actor="unit")
    enf2 = enforce(reg, message="pedidos esta semana", source_id="tinyerp")
    assert enf2.reason_code == "OK"


def test_bridge_contratos_kill_drift(tmp_path: Path, monkeypatch):
    monkeypatch.setattr("knowt.mongo.ping_mongo", lambda: {"ok": False})
    monkeypatch.delenv("KNOWT_SECRET_TINY_TOKEN", raising=False)
    app = create_app(_settings(tmp_path))
    client = app.test_client()
    hdr = {"X-Knowt-Token": "tok"}

    c = client.get("/api/bridge/contratos", headers=hdr)
    assert c.status_code == 200
    body = c.get_json()
    assert body["summary"]["count"] >= 2

    kill = client.post(
        "/api/bridge/fontes/tinyerp/kill-switch",
        headers=hdr,
        json={"suspended": True, "reason": "smoke", "actor": "test"},
    )
    assert kill.status_code == 200
    assert kill.get_json()["fonte"]["status"] == "suspended"

    st = client.get("/api/bridge/fonte/status?source_id=tinyerp", headers=hdr)
    assert st.status_code == 200
    sj = st.get_json()
    assert sj["health"] == "suspended"
    assert sj["kill_switch"]["suspended"] is True

    chat = client.post(
        "/api/bridge/assistant/chat",
        headers=hdr,
        json={"message": "pedidos esta semana", "context": {"engine": "deterministic"}},
    )
    assert chat.status_code == 200
    assert chat.get_json()["enforcement"]["reason_code"] == "SOURCE_SUSPENDED"

    # restore
    client.post(
        "/api/bridge/fontes/tinyerp/kill-switch",
        headers=hdr,
        json={"suspended": False, "actor": "test"},
    )

    drift = client.post(
        "/api/bridge/drift/check",
        headers=hdr,
        json={"source_id": "tinyerp", "actor": "test"},
    )
    assert drift.status_code == 200
    ev = drift.get_json()["event"]
    assert ev["auto_kill"] is False
    assert isinstance(ev["alerts"], list)

    hist = client.get("/api/bridge/drift/events?limite=5", headers=hdr)
    assert hist.status_code == 200
    assert hist.get_json()["count"] >= 1


def test_drift_run_without_token(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("KNOWT_SECRET_TINY_TOKEN", raising=False)
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    ev = run_drift_check(tmp_path, reg, source_id="tinyerp", actor="unit")
    assert ev["auto_kill"] is False
    codes = {a.get("code") for a in ev["alerts"]}
    assert "API_UNREACHABLE" in codes
