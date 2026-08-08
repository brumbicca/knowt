#!/usr/bin/env python3
"""Publica orders.detail no knowt após pedido.obter real."""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
env_path = Path(os.environ.get("KNOWT_ENV_FILE") or ROOT / ".env")
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

from knowt.publish import (
    ensure_tiny_capability_slots,
    publish_orders_detail_live,
)
from knowt.sources import SourceRegistry, seed_tiny_draft
from knowt.tiny_order_detail import fetch_order_detail
from knowt.tiny_orders import fetch_orders_page
from knowt.vault import resolve_secret

data = Path(os.environ.get("KNOWT_DATA_DIR") or "/root/knowt-data")
reg = SourceRegistry(data / "sources.json")
seed_tiny_draft(reg, org_id=os.environ.get("KNOWT_ORG_ID") or "default")
ensure_tiny_capability_slots(reg, "tinyerp")
token = resolve_secret("KNOWT_SECRET_TINY_TOKEN", required=True)
page = fetch_orders_page(token, page=1, timeout=60.0)
print("page_ok", page.ok, "ids", page.order_ids[:3])
if not page.ok or not page.order_ids:
    raise SystemExit(2)
oid = page.order_ids[0]
detail = fetch_order_detail(token, oid, timeout=60.0)
print("detail_ok", detail.ok, "reason", detail.reason_code, "situacao", detail.situacao)
if not detail.ok:
    raise SystemExit(2)
cap = publish_orders_detail_live(reg, "tinyerp")
print("published", cap.id, cap.status, cap.quality)
from knowt.answers import answer_chat

out = answer_chat(reg, message=f"pedido {oid}", source_id="tinyerp")
print("enforce_mode", out["enforcement"]["mode"])
print("answer", out["answer"])
