#!/usr/bin/env python3
import json
import os
import urllib.request

def load_env(path="/root/knowt/.env"):
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

load_env()
token = os.environ.get("KNOWT_API_TOKEN") or ""
req = urllib.request.Request(
    "http://127.0.0.1:8766/api/bridge/assistant/chat",
    data=json.dumps(
        {
            "message": "Pedidos esta semana",
            "session_id": "smoke-fmt",
            "context": {"source_id": "tinyerp", "channel": "telegram"},
        }
    ).encode(),
    headers={
        "Content-Type": "application/json",
        "X-Knowt-Token": token,
    },
    method="POST",
)
with urllib.request.urlopen(req, timeout=90) as resp:
    d = json.loads(resp.read().decode())
h = d.get("reply_html") or ""
print("ok", d.get("ok"))
print("has_pre", "<pre>" in h)
print("has_table", "Total de pedidos" in h)
print("has_nd", "n/d" in h)
print("---html---")
print(h[:900])
print("---reply---")
print((d.get("reply") or "")[:400])
