from pathlib import Path
from unittest.mock import patch

from knowt.discovery import run_discovery_stub
from knowt.sources import SourceRegistry, seed_tiny_draft
from knowt.tiny_probe import TinyProbeResult, probe_tiny_v2_orders


def test_discovery_blocked_without_secret(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("KNOWT_SECRET_TINY_TOKEN", raising=False)
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    report = run_discovery_stub(reg, "tinyerp")
    assert report.status == "blocked"
    assert any(r.startswith("SECRET_MISSING") for r in report.blocked_reasons)


def test_discovery_complete_after_probe_ok_still_not_live(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("KNOWT_SECRET_TINY_TOKEN", "x")
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    fake = TinyProbeResult(
        ok=True, http_status=200, tinystatus="OK", reason_code="OK", detail="reachable"
    )
    from knowt.tiny_orders import TinyOrdersPage
    from knowt.tiny_order_detail import TinyOrderDetail

    page = TinyOrdersPage(
        ok=True,
        reason_code="OK",
        page=1,
        total_pages=1,
        order_count=1,
        order_ids=["99"],
    )
    detail = TinyOrderDetail(
        ok=True, reason_code="OK", order_id="99", situacao="aprovado"
    )
    with patch("knowt.discovery.probe_tiny_v2_orders", return_value=fake):
        with patch("knowt.tiny_orders.fetch_orders_page", return_value=page):
            with patch("knowt.tiny_order_detail.fetch_order_detail", return_value=detail):
                report = run_discovery_stub(reg, "tinyerp")
    assert report.status == "complete"
    assert "CAPABILITIES_NOT_PUBLISHED" in report.blocked_reasons
    assert any("tiny_pedido_obter:ok=True" in e for e in report.evidence)
    cap = reg.get_capability("tinyerp", "sales.summary")
    assert cap is not None
    assert cap.status == "unavailable"
    assert reg.get_capability("tinyerp", "orders.detail").status == "unavailable"


def test_probe_empty_token():
    r = probe_tiny_v2_orders("")
    assert r.ok is False
    assert r.reason_code == "SECRET_EMPTY"
