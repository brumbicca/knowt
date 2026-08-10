#!/usr/bin/env python3
import json
import os
import urllib.request
from pathlib import Path


def load_env(path="/root/knowt/.env"):
    for line in Path(path).read_text(encoding="utf-8", errors="replace").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
token = os.environ.get("KNOWT_API_TOKEN") or ""

req = urllib.request.Request("http://127.0.0.1:8766/api/bridge/health")
with urllib.request.urlopen(req, timeout=20) as resp:
    h = json.loads(resp.read().decode())
print("health", {k: h.get(k) for k in ("ok", "hermes_bin", "assistant_engine", "telegram_configured")})

req2 = urllib.request.Request(
    "http://127.0.0.1:8766/api/bridge/assistant/chat",
    data=json.dumps(
        {
            "message": "Pedidos esta semana",
            "session_id": "smoke-hermes-tg",
            "context": {
                "source_id": "tinyerp",
                "channel": "telegram",
                "engine": "hermes",
            },
        }
    ).encode(),
    headers={
        "Content-Type": "application/json",
        "X-Knowt-Token": token,
    },
    method="POST",
)
with urllib.request.urlopen(req2, timeout=160) as resp:
    d = json.loads(resp.read().decode())
print("engine", d.get("engine"), "fallback", d.get("hermes_fallback"))
print("reply_head:")
print((d.get("reply") or "")[:700])
