#!/usr/bin/env python3
"""Live Tiny probe on knowt VPS — no secret printed."""
import os
import sys
from pathlib import Path

sys.path.insert(0, "/root/knowt/src")

for line in Path("/root/knowt/.env").read_text(encoding="utf-8").splitlines():
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    os.environ[k.strip()] = v.strip()

from knowt.discovery import run_discovery_stub
from knowt.sources import SourceRegistry, seed_tiny_draft
from knowt.tiny_probe import probe_tiny_v2_orders
from knowt.vault import resolve_secret

token = resolve_secret("KNOWT_SECRET_TINY_TOKEN", required=True)
print("token_len", len(token))
probe = probe_tiny_v2_orders(token, timeout=60.0)
print("probe_ok", probe.ok)
print("http", probe.http_status)
print("tinystatus", probe.tinystatus)
print("reason", probe.reason_code)
print("detail", (probe.detail or "")[:120])

reg = SourceRegistry(Path("/root/knowt-data/sources.json"))
seed_tiny_draft(reg, org_id="default")
report = run_discovery_stub(reg, "tinyerp")
print("discovery_status", report.status)
print("blocked", report.blocked_reasons)
cap = reg.get_capability("tinyerp", "sales.summary")
print("sales.summary", cap.status if cap else None)
