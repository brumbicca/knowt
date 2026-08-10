from pathlib import Path

import pytest

from knowt.publish import publish_sales_summary_live
from knowt.sales_gates import (
    can_publish_sales_summary,
    default_gates,
    load_gates,
    save_gates,
)
from knowt.sales_probe import run_sales_probe
from knowt.sources import SourceRegistry, seed_tiny_draft
from knowt.tiny_orders import TinyOrdersCount, TinyOrdersPage
from unittest.mock import patch


def test_gates_block_publish(tmp_path: Path):
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    ok, missing = can_publish_sales_summary(tmp_path)
    assert ok is False
    assert "approved_to_publish" in missing
    with pytest.raises(PermissionError):
        publish_sales_summary_live(reg, tmp_path)


def test_gates_allow_when_complete(tmp_path: Path):
    gates = default_gates()
    gates["answers"] = {
        "cost_field": "preco_custo",
        "matches_official_report": "yes",
        "missing_cost_policy": "block_metric",
        "cmv_composition_ok": "product_only",
    }
    gates["approved_to_publish"] = True
    gates["approver"] = "negocio@knowt"
    save_gates(tmp_path, gates)
    ok, missing = can_publish_sales_summary(tmp_path)
    assert ok is True
    assert missing == []
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    cap = publish_sales_summary_live(reg, tmp_path)
    assert cap.status == "live"


def test_gates_block_when_cost_field_defer(tmp_path: Path):
    gates = default_gates()
    gates["answers"] = {
        "cost_field": "defer",
        "matches_official_report": "yes",
        "missing_cost_policy": "block_metric",
        "cmv_composition_ok": "product_only",
    }
    gates["approved_to_publish"] = True
    gates["approver"] = "negocio@knowt"
    save_gates(tmp_path, gates)
    ok, missing = can_publish_sales_summary(tmp_path)
    assert ok is False
    assert "cost_field=defer" in missing


def test_sales_probe_writes_evidence(tmp_path: Path):
    load_gates(tmp_path)  # seed gates file
    counted = TinyOrdersCount(
        ok=True,
        reason_code="OK",
        data_inicial="03/08/2026",
        data_final="09/08/2026",
        total_orders=100,
        pages_fetched=1,
        total_pages=1,
        method="single_page",
        sample_ids=["1", "2"],
    )
    page = TinyOrdersPage(
        ok=True,
        reason_code="OK",
        page=1,
        total_pages=1,
        order_count=2,
        order_ids=["1", "2"],
        page_valor_sum=199.9,
        page_valor_parsed=2,
    )

    with patch("knowt.sales_probe.count_orders_in_period", return_value=counted):
        with patch("knowt.sales_probe.fetch_orders_page", return_value=page):
            with patch(
                "knowt.sales_probe.fetch_order_detail",
                side_effect=lambda *_a, **_k: type(
                    "D",
                    (),
                    {
                        "ok": True,
                        "valor_total": "99.95",
                        "situacao": "aprovado",
                        "reason_code": "OK",
                    },
                )(),
            ):
                ev = run_sales_probe("tok", tmp_path, detail_samples=1)
    assert ev["can_publish"] is False
    assert ev["page1_sample"]["page_valor_sum"] == 199.9
    assert (tmp_path / "evidence" / "sales_probe_latest.json").is_file()
    assert "não extrapolar" in (ev["page1_sample"]["warning"] or "").lower() or "Não extrapolar" in ev[
        "page1_sample"
    ]["warning"]
