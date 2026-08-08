#!/usr/bin/env python3
"""Garante KNOWT_API_TOKEN no .env (não imprime o valor completo)."""
from __future__ import annotations

import re
import secrets
import sys
from pathlib import Path


def main() -> int:
    env_path = Path(sys.argv[1] if len(sys.argv) > 1 else "/root/knowt/.env")
    if not env_path.exists():
        print("missing_env", env_path)
        return 2
    text = env_path.read_text(encoding="utf-8")
    m = re.search(r"^KNOWT_API_TOKEN=(.+)$", text, flags=re.M)
    if m and m.group(1).strip():
        val = m.group(1).strip()
        print("token_present", True, "suffix", val[-4:])
        return 0
    token = secrets.token_urlsafe(32)
    if text and not text.endswith("\n"):
        text += "\n"
    text += f"KNOWT_API_TOKEN={token}\n"
    env_path.write_text(text, encoding="utf-8")
    env_path.chmod(0o600)
    print("token_created", True, "suffix", token[-4:])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
