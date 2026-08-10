"""Chat: dossiê Discovery."""
from __future__ import annotations

from knowt.answers import answer_chat
from knowt.enforcement import wants_discovery_dossier
from knowt.sources import SourceRegistry, seed_tiny_draft


def test_wants_discovery_dossier():
    assert wants_discovery_dossier("O que já conhecemos do Tiny?")
    assert wants_discovery_dossier("mostra o dossiê discovery")
    assert wants_discovery_dossier("inventário do sistema")
    assert not wants_discovery_dossier("o que podes fazer?")
    assert not wants_discovery_dossier("pedidos esta semana")


def test_answer_discovery_dossier(tmp_path, monkeypatch):
    monkeypatch.setenv("KNOWT_DATA_DIR", str(tmp_path))
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg, org_id="default")
    # sem evidence ainda — persiste dossiê vazio/default
    out = answer_chat(
        reg,
        message="O que já conhecemos do Tiny?",
        source_id="tinyerp",
        data_dir=tmp_path,
    )
    assert out["enforcement"]["capability_id"] == "discovery.dossier"
    assert out["enforcement"]["reason_code"] == "DISCOVERY_OBSERVATION"
    assert "Dossiê Discovery" in (out["answer"] or "")
    assert "cost_field" in (out["answer"] or "")

    casual = answer_chat(
        reg,
        message="O que já conhecemos do Tiny?",
        source_id="tinyerp",
        data_dir=tmp_path,
        tone="casual",
    )
    assert casual["enforcement"]["capability_id"] == "discovery.dossier"
    assert "mapeámos" in (casual["answer"] or "") or "mapeamos" in (casual["answer"] or "")
    assert "orders.list" not in (casual["answer"] or "")
    assert "`" not in (casual["answer"] or "")