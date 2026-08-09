#!/usr/bin/env python3
"""Corre probe sales Tiny → evidence JSON (não publica sales.summary)."""
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

from knowt.config import Settings  # noqa: E402
from knowt.publish import ensure_tiny_capability_slots  # noqa: E402
from knowt.sales_probe import run_sales_probe  # noqa: E402
from knowt.sources import SourceRegistry, seed_tiny_draft  # noqa: E402
from knowt.vault import resolve_secret  # noqa: E402


def main() -> int:
    settings = Settings.from_env()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    reg = SourceRegistry(settings.data_dir / "sources.json")
    seed_tiny_draft(reg, org_id=settings.org_id)
    ensure_tiny_capability_slots(reg, "tinyerp")
    token = resolve_secret("KNOWT_SECRET_TINY_TOKEN", required=True)
    evidence = run_sales_probe(token, settings.data_dir)
    print(json.dumps(
        {
            "path": evidence.get("path"),
            "period": evidence.get("period"),
            "orders_total": (evidence.get("orders_count") or {}).get("total_orders"),
            "page1_valor_sum": (evidence.get("page1_sample") or {}).get("page_valor_sum"),
            "page1_orders": (evidence.get("page1_sample") or {}).get("order_count"),
            "can_publish": evidence.get("can_publish"),
            "missing_gates": (evidence.get("gates") or {}).get("missing_for_publish"),
            "sales_summary": "unavailable",
        },
        ensure_ascii=False,
        indent=2,
    ))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
