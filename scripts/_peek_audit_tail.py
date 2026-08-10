#!/usr/bin/env python3
import json
from pathlib import Path

path = Path("/root/knowt-data/audit/answers.jsonl")
if not path.is_file():
    print("no_audit")
    raise SystemExit(0)
lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
for line in lines[-8:]:
    try:
        o = json.loads(line)
    except json.JSONDecodeError:
        continue
    msg = o.get("message") or ""
    result = o.get("result") or {}
    reply = result.get("answer") or o.get("answer") or ""
    enf = result.get("enforcement") or o.get("enforcement") or {}
    print("msg:", msg[:100])
    print("cap:", enf.get("capability_id"), "mode:", enf.get("mode"))
    print("reply:", str(reply)[:500])
    print("---")
