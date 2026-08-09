#!/usr/bin/env python3
"""Smoke local/VPS: probe latest + plano + caps (não imprime secrets)."""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
env_path = Path(os.environ.get("KNOWT_ENV_FILE") or ROOT / ".env")
if env_path.is_file():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

base = (os.environ.get("KNOWT_SMOKE_BASE") or "http://127.0.0.1:8766").rstrip("/")
tok = (os.environ.get("KNOWT_API_TOKEN") or "").strip()
headers = {"Authorization": f"Bearer {tok}"} if tok else {}


def get(path: str) -> dict:
    req = urllib.request.Request(base + path, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    probe = get("/api/bridge/sales/probe/latest")
    plano = get("/api/bridge/insights/plano")
    print(
        json.dumps(
            {
                "probe_ok": probe.get("ok"),
                "can_publish_sales_summary": probe.get("can_publish_sales_summary"),
                "missing_gates": probe.get("missing_gates"),
                "orders_total": ((probe.get("probe") or {}).get("orders_count") or {}).get(
                    "total_orders"
                ),
                "page1_valor_sum": ((probe.get("probe") or {}).get("page1_sample") or {}).get(
                    "page_valor_sum"
                ),
                "plano_acoes": [a.get("titulo") for a in (plano.get("acoes") or [])],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    data = Path(os.environ.get("KNOWT_DATA_DIR") or "/root/knowt-data")
    src = json.loads((data / "sources.json").read_text(encoding="utf-8"))
    for s in src.get("sources") or []:
        for c in s.get("capabilities") or []:
            if c.get("id") in ("sales.summary", "margins.summary", "orders.list"):
                print(f"cap {c.get('id')}={c.get('status')}/{c.get('quality')}")
    if not probe.get("ok") or probe.get("can_publish_sales_summary"):
        return 2
    if ((probe.get("probe") or {}).get("orders_count") or {}).get("total_orders") is None:
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
