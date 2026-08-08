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
    with patch("knowt.discovery.probe_tiny_v2_orders", return_value=fake):
        report = run_discovery_stub(reg, "tinyerp")
    assert report.status == "complete"
    assert "CAPABILITIES_NOT_PUBLISHED" in report.blocked_reasons
    # capabilities no registry continuam unavailable
    cap = reg.get_capability("tinyerp", "sales.summary")
    assert cap is not None
    assert cap.status == "unavailable"


def test_probe_empty_token():
    r = probe_tiny_v2_orders("")
    assert r.ok is False
    assert r.reason_code == "SECRET_EMPTY"
