#!/usr/bin/env python3
"""Define/actualiza chaves knowt no .env sem imprimir valores."""
from pathlib import Path
import sys

env_path = Path("/root/knowt/.env")
updates = {
    "KNOWT_ASSISTANT_ENGINE": "hermes",
    "KNOWT_TELEGRAM_ENGINE": "hermes",
    "KNOWT_HERMES_CHAT_TIMEOUT": "120",
    "KNOWT_TELEGRAM_BRIDGE_TIMEOUT": "150",
}
text = env_path.read_text(encoding="utf-8", errors="replace") if env_path.exists() else ""
lines = [ln.rstrip("\r") for ln in text.splitlines()]
keys_seen = set()
out = []
for ln in lines:
    if "=" in ln and not ln.strip().startswith("#"):
        k = ln.split("=", 1)[0].strip()
        if k in updates:
            out.append(f"{k}={updates[k]}")
            keys_seen.add(k)
            continue
    out.append(ln)
for k, v in updates.items():
    if k not in keys_seen:
        out.append(f"{k}={v}")
env_path.write_text("\n".join(out) + "\n", encoding="utf-8")
print("updated", ",".join(sorted(updates)))
