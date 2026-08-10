#!/usr/bin/env python3
"""Set KNOWT_TELEGRAM_BOT_TOKEN in /root/knowt/.env from stdin (one line)."""
from pathlib import Path
import sys

token = sys.stdin.read().strip()
if not token or ":" not in token:
    raise SystemExit("bad_token")
path = Path("/root/knowt/.env")
text = path.read_text(encoding="utf-8") if path.is_file() else ""
lines = [ln for ln in text.splitlines() if not ln.startswith("KNOWT_TELEGRAM_BOT_TOKEN=")]
lines.append(f"KNOWT_TELEGRAM_BOT_TOKEN={token}")
if not any(ln.startswith("KNOWT_TELEGRAM_CHAT_IDS=") for ln in lines):
    lines.append("KNOWT_TELEGRAM_CHAT_IDS=*")
path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
print("ok")
