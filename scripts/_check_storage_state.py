#!/usr/bin/env python3
from pathlib import Path
import json
p = Path("/root/knowt-data/discovery/tinyerp/storage_state.json")
print("exists", p.is_file(), "size", p.stat().st_size if p.is_file() else 0)
if p.is_file():
    d = json.loads(p.read_text(encoding="utf-8"))
    print("cookies", len(d.get("cookies") or []))
