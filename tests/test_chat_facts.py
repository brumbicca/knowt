from pathlib import Path
from unittest.mock import patch

from knowt.answers import answer_chat
from knowt.publish import publish_orders_detail_live, publish_orders_list_live
from knowt.situacao import wants_situacao_breakdown
from knowt.sources import SourceRegistry, seed_tiny_draft
from knowt.tiny_order_detail import TinyOrderDetail
from knowt.tiny_orders import TinyOrdersCount


def test_answer_breakdown_esta_semana(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("KNOWT_SECRET_TINY_TOKEN", "tok")
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    publish_orders_list_live(reg)

    total = TinyOrdersCount(
        ok=True,
        reason_code="OK",
        data_inicial="03/08/2026",
        data_final="08/08/2026",
        total_orders=100,
        pages_fetched=1,
        total_pages=1,
        sample_ids=["10", "11"],
        detail="full",
        method="single_page",
    )

    def fake_count(token, *, data_inicial, data_final, situacao=None, timeout=60.0):
        if situacao is None:
            return total
        n = {"aprovado": 40, "cancelado": 5, "aberto": 10}.get(situacao, 0)
        return TinyOrdersCount(
            ok=True,
            reason_code="OK",
            data_inicial=data_inicial,
            data_final=data_final,
            total_orders=n,
            pages_fetched=1,
            total_pages=1,
            method="single_page",
        )

    with patch("knowt.answers.count_orders_in_period", side_effect=fake_count):
        with patch(
            "knowt.period.today_br",
            return_value=__import__("datetime").date(2026, 8, 8),
        ):
            out = answer_chat(
                reg,
                message="resumo de pedidos esta semana",
                source_id="tinyerp",
            )
    assert out["enforcement"]["mode"] == "fact"
    assert "100" in out["answer"]
    assert "aprovado" in out["answer"]
    assert "40" in out["answer"]
    assert out["data"]["breakdown"]["by_situacao"]


def test_answer_detail_shows_ecommerce(tmp_path: Path, monkeypatch):
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
        ecommerce_numero="SHP-99",
        itens_count=1,
        item_skus=["SKU1"],
        valor_total="10.00",
    )
    with patch("knowt.answers.fetch_order_detail", return_value=fake):
        out = answer_chat(reg, message="pedido 752095868", source_id="tinyerp")
    assert "SHP-99" in out["answer"]
