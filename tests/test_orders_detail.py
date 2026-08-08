from pathlib import Path
from unittest.mock import patch

from knowt.answers import answer_chat
from knowt.enforcement import classify_intent, enforce
from knowt.order_id import extract_order_id
from knowt.publish import publish_orders_detail_live, publish_orders_list_live
from knowt.sources import SourceRegistry, seed_tiny_draft
from knowt.tiny_order_detail import TinyOrderDetail


def test_extract_order_id():
    assert extract_order_id("pedido 752095868") == "752095868"
    assert extract_order_id("mostra o pedido #660561833") == "660561833"
    assert extract_order_id("quantos pedidos esta semana?") is None


def test_classify_prefers_detail_when_id():
    assert classify_intent("pedido 752095868") == "orders.detail"
    assert classify_intent("pedidos esta semana") == "orders.list"


def test_catalog_lists_caps(tmp_path: Path):
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    publish_orders_list_live(reg)
    out = enforce(reg, message="o que podes responder?", source_id="tinyerp")
    assert out.mode == "catalog"
    assert "orders.list" in out.message
    assert "live" in out.message


def test_answer_order_detail(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("KNOWT_SECRET_TINY_TOKEN", "tok")
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    publish_orders_detail_live(reg)
    fake = TinyOrderDetail(
        ok=True,
        reason_code="OK",
        order_id="752095868",
        numero="123",
        data_pedido="08/08/2026",
        situacao="aprovado",
        cliente_nome="Cliente X",
        itens_count=2,
        item_skus=["SKU1", "SKU2"],
        valor_total="199.90",
    )
    with patch("knowt.answers.fetch_order_detail", return_value=fake):
        out = answer_chat(reg, message="pedido 752095868", source_id="tinyerp")
    assert out["enforcement"]["mode"] == "fact"
    assert "aprovado" in out["answer"]
    assert "199.90" in out["answer"]
    assert "margem" in out["answer"].lower()
