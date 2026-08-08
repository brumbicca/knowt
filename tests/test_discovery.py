from pathlib import Path

from knowt.discovery import run_discovery_stub
from knowt.sources import SourceRegistry, seed_tiny_draft


def test_discovery_blocked_without_secret(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("KNOWT_SECRET_TINY_TOKEN", raising=False)
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    report = run_discovery_stub(reg, "tinyerp")
    assert report.status == "blocked"
    assert any(r.startswith("SECRET_MISSING") for r in report.blocked_reasons)


def test_discovery_stub_not_silent_truth(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("KNOWT_SECRET_TINY_TOKEN", "x")
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    report = run_discovery_stub(reg, "tinyerp")
    assert report.status == "stub"
    assert "DISCOVERY_PIPELINE_NOT_IMPLEMENTED" in report.blocked_reasons
    assert report.hypotheses  # hipóteses explícitas, não fatos
