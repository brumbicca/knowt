#!/usr/bin/env python3
import json
import urllib.request

with urllib.request.urlopen("http://127.0.0.1:8766/api/bridge/health", timeout=20) as r:
    d = json.loads(r.read().decode())
print(
    {
        "ok": d.get("ok"),
        "mongo_ok": d.get("mongo_ok"),
        "mongo": d.get("mongo"),
        "assistant_engine": d.get("assistant_engine"),
    }
)
