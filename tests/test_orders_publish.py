from pathlib import Path
from unittest.mock import patch

from knowt.answers import answer_chat
from knowt.models import Capability
from knowt.publish import publish_orders_list_live
from knowt.sources import SourceRegistry, seed_tiny_draft
from knowt.tiny_orders import TinyOrdersPage


def test_publish_orders_list_live(tmp_path: Path):
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    cap = publish_orders_list_live(reg)
    assert cap.status == "live"
    assert cap.quality == "machine_validated"
    assert reg.get_capability("tinyerp", "orders.list").status == "live"
    # sales continua unavailable
    assert reg.get_capability("tinyerp", "sales.summary").status == "unavailable"


def test_answer_orders_when_live(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("KNOWT_SECRET_TINY_TOKEN", "tok")
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    publish_orders_list_live(reg)
    fake = TinyOrdersPage(
        ok=True,
        reason_code="OK",
        http_status=200,
        tinystatus="OK",
        page=1,
        total_pages=10,
        order_count=2,
        order_ids=["100", "101"],
        detail="page_ok",
    )
    with patch("knowt.answers.fetch_orders_page", return_value=fake):
        out = answer_chat(reg, message="quais os pedidos?", source_id="tinyerp")
    assert out["enforcement"]["mode"] == "fact"
    assert "2 pedido" in out["answer"]
    assert out["data"]["order_count"] == 2


def test_answer_orders_esta_semana(tmp_path: Path, monkeypatch):
    from knowt.tiny_orders import TinyOrdersCount

    monkeypatch.setenv("KNOWT_SECRET_TINY_TOKEN", "tok")
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    publish_orders_list_live(reg)
    fake = TinyOrdersCount(
        ok=True,
        reason_code="OK",
        data_inicial="03/08/2026",
        data_final="08/08/2026",
        total_orders=17,
        pages_fetched=1,
        total_pages=1,
        truncated=False,
        sample_ids=["1"],
        detail="full",
    )
    with patch("knowt.answers.count_orders_in_period", return_value=fake):
        with patch("knowt.period.today_br", return_value=__import__("datetime").date(2026, 8, 8)):
            out = answer_chat(
                reg, message="quantos pedidos esta semana?", source_id="tinyerp"
            )
    assert out["enforcement"]["mode"] == "fact"
    assert "17" in out["answer"]
    assert out["data"]["total_orders"] == 17
