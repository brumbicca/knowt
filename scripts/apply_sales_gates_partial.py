#!/usr/bin/env python3
"""Atualiza sales_summary_gates.json com respostas parciais (sem approve publish)."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

env_path = Path(os.environ.get("KNOWT_ENV_FILE") or ROOT / ".env")
if env_path.is_file():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

from knowt.config import Settings
from knowt.sales_gates import can_publish_sales_summary, load_gates, save_gates


def main() -> int:
    settings = Settings.from_env()
    data = load_gates(settings.data_dir)
    data["answers"] = {
        "cost_field": "defer",
        "matches_official_report": "unknown",
        "missing_cost_policy": "block_metric",
        "cmv_composition_ok": "product_only",
    }
    data["approved_to_publish"] = False
    data["approver"] = None
    data["notes"] = (
        "Respostas 2026-08-09 (piloto): cost_field=defer até Time confirmar "
        "preco_custo vs medio; sem custo → block_metric; CMV product_only; "
        "relatório oficial previsto (matches ainda unknown). "
        "approved_to_publish permanece false até reconciliação + dono."
    )
    save_gates(settings.data_dir, data)
    ok, missing = can_publish_sales_summary(settings.data_dir)
    print(
        json.dumps(
            {
                "path": str(settings.data_dir / "sales_summary_gates.json"),
                "answers": data["answers"],
                "approved_to_publish": data["approved_to_publish"],
                "can_publish": ok,
                "missing": missing,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if (not ok and missing == ["approved_to_publish"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
