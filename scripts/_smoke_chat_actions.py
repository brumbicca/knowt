#!/usr/bin/env python3
import json
import urllib.request
from pathlib import Path

env = Path("/root/knowt/.env").read_text(encoding="utf-8")
tok = next(
    line.split("=", 1)[1].strip()
    for line in env.splitlines()
    if line.startswith("KNOWT_API_TOKEN=")
)


def ask(msg: str):
    req = urllib.request.Request(
        "http://127.0.0.1:8766/v1/chat/answer",
        data=json.dumps({"message": msg, "source_id": "tinyerp"}).encode(),
        headers={
            "Authorization": f"Bearer {tok}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


for msg in (
    "cria uma tarefa Smoke via chat NL",
    "agenda review Tiny amanhã às 16h",
):
    out = ask(msg)
    print("MSG", msg)
    print("mode", (out.get("enforcement") or {}).get("mode"))
    print((out.get("answer") or "")[:240])
    print("---")
