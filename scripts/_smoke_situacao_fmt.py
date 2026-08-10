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
req = urllib.request.Request(
    "http://127.0.0.1:8766/api/bridge/assistant/chat",
    data=json.dumps(
        {
            "message": "Ok, por situação",
            "session_id": "smoke-sit",
            "context": {"source_id": "tinyerp", "channel": "telegram"},
        }
    ).encode(),
    headers={"Content-Type": "application/json", "X-Knowt-Token": token},
    method="POST",
)
with urllib.request.urlopen(req, timeout=120) as resp:
    d = json.loads(resp.read().decode())
print("engine", d.get("engine"))
print("has_pre", "<pre>" in (d.get("reply_html") or ""))
print("has_situacao_col", "Situação" in (d.get("reply_html") or d.get("reply") or ""))
print("no_wall_id_sample", "Amostra:" not in (d.get("reply") or ""))
print("---html---")
print((d.get("reply_html") or d.get("reply") or "")[:900])
