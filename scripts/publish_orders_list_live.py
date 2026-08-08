#!/usr/bin/env python3
"""Publica orders.list no knowt após fetch real da página 1."""
import os
import sys
from pathlib import Path

sys.path.insert(0, "/root/knowt/src")
for line in Path("/root/knowt/.env").read_text(encoding="utf-8").splitlines():
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    os.environ[k.strip()] = v.strip()

from knowt.publish import publish_orders_list_live
from knowt.sources import SourceRegistry, seed_tiny_draft
from knowt.tiny_orders import fetch_orders_page
from knowt.vault import resolve_secret

data = Path(os.environ.get("KNOWT_DATA_DIR") or "/root/knowt-data")
reg = SourceRegistry(data / "sources.json")
seed_tiny_draft(reg, org_id=os.environ.get("KNOWT_ORG_ID") or "default")
token = resolve_secret("KNOWT_SECRET_TINY_TOKEN", required=True)
page = fetch_orders_page(token, page=1, timeout=60.0)
print("page_ok", page.ok, "reason", page.reason_code)
print("page", page.page, "total_pages", page.total_pages, "count", page.order_count)
print("ids_sample", page.order_ids[:5])
if not page.ok:
    raise SystemExit(2)
cap = publish_orders_list_live(reg, "tinyerp")
print("published", cap.id, cap.status, cap.quality)
from knowt.answers import answer_chat

out = answer_chat(reg, message="quantos pedidos na primeira pagina?", source_id="tinyerp")
print("enforce_mode", out["enforcement"]["mode"])
print("answer", out["answer"])
