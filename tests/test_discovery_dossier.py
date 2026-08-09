"""Testes do dossiê Discovery (sem browser)."""
from __future__ import annotations

import json
from pathlib import Path

from knowt.discovery_dossier import build_discovery_dossier, render_dossier_markdown


def test_build_dossier_empty_dir(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("KNOWT_DATA_DIR", str(tmp_path))
    # gates default será criado
    d = build_discovery_dossier(tmp_path)
    assert d["kind"] == "discovery_dossier"
    assert d["source_id"] == "tinyerp"
    assert "summary" in d
    md = render_dossier_markdown(d)
    assert "Dossiê Discovery" in md
    assert "cost_field" in md


def test_build_dossier_with_stub_evidence(tmp_path: Path):
    ev = tmp_path / "evidence"
    ev.mkdir()
    (ev / "ui_system_map_latest.json").write_text(
        json.dumps(
            {
                "at": "t",
                "domains_seen": ["vendas"],
                "pages": [{"key": "home", "label": "Home", "url": "u", "ok": True}],
            }
        ),
        encoding="utf-8",
    )
    (ev / "ui_margin_reports_latest.json").write_text(
        json.dumps(
            {
                "at": "t",
                "reports_ok": 1,
                "reports": [
                    {
                        "key": "avaliacao_margem",
                        "label": "Avaliação",
                        "url": "https://erp.olist.com/x",
                        "ok": True,
                        "columns": ["Valor total da venda"],
                        "available_columns_sample": ["Preço de custo atual"],
                        "hints": {},
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    d = build_discovery_dossier(tmp_path)
    assert d["summary"]["system_map_pages"] == 1
    assert d["summary"]["margin_reports_ok"] == 1
    assert "Preço de custo atual" in (
        d["margin_official_reports"]["reports"][0]["cost_fields_in_catalog"]
    )
