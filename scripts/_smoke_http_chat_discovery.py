#!/usr/bin/env python3
from __future__ import annotations

import json
import urllib.request
from pathlib import Path


def main() -> None:
    env = Path("/root/knowt/.env").read_text(encoding="utf-8")
    token = next(
        line.split("=", 1)[1].strip()
        for line in env.splitlines()
        if line.startswith("KNOWT_API_TOKEN=")
    )
    payload = {"message": "O que ja conhecemos do Tiny?", "source_id": "tinyerp"}
    req = urllib.request.Request(
        "http://127.0.0.1:8766/api/bridge/assistant/chat",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.load(resp)
    enf = body.get("enforcement") or {}
    print("capability", enf.get("capability_id"), "status", enf.get("status"))
    print("keys", sorted(body.keys()))
    for key in ("answer", "reply", "message", "text", "content"):
        val = body.get(key)
        if val:
            print(key, str(val)[:500])
            break
    else:
        print("sample", json.dumps(body, ensure_ascii=False)[:900])

    index = Path("/var/www/knowt/index.html").read_text(encoding="utf-8")
    print("index_snippet")
    for line in index.splitlines():
        if "assets/" in line:
            print(line.strip())


if __name__ == "__main__":
    main()
