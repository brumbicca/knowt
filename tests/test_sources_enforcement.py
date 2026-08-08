from pathlib import Path

from knowt.enforcement import enforce
from knowt.models import Capability
from knowt.sources import SourceRegistry, seed_tiny_draft


def test_seed_and_list(tmp_path: Path):
    reg = SourceRegistry(tmp_path / "sources.json")
    src = seed_tiny_draft(reg, org_id="default")
    assert src.source_id == "tinyerp"
    assert reg.get("tinyerp") is not None
    assert len(reg.list()) == 1
    # reload
    reg2 = SourceRegistry(tmp_path / "sources.json")
    assert reg2.get("tinyerp").system == "tiny-erp"


def test_enforce_refuses_unavailable_sales(tmp_path: Path):
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    out = enforce(reg, message="quanto foram as vendas este mês?", source_id="tinyerp")
    assert out.allow_llm is False
    assert out.reason_code == "CAPABILITY_UNAVAILABLE"
    assert out.mode == "refuse"


def test_enforce_allows_fact_when_live(tmp_path: Path):
    reg = SourceRegistry(tmp_path / "sources.json")
    src = seed_tiny_draft(reg)
    src.capabilities = [
        Capability(
            id="sales.summary",
            domain="sales",
            status="live",
            quality="machine_validated",
            description="ok",
        )
    ]
    reg.upsert(src)
    out = enforce(reg, message="vendas da semana", source_id="tinyerp")
    assert out.allow_llm is True
    assert out.mode == "fact"
    assert out.reason_code == "OK"
