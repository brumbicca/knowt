#!/usr/bin/env python3
"""Garante KNOWT_CHAT_PASSWORD e KNOWT_SECRET_KEY no .env (não imprime valores completos)."""
from __future__ import annotations

import re
import secrets
import sys
from pathlib import Path


def _ensure(text: str, key: str, generator) -> tuple[str, bool, str]:
    m = re.search(rf"^{re.escape(key)}=(.+)$", text, flags=re.M)
    if m and m.group(1).strip():
        val = m.group(1).strip()
        return text, False, val[-4:]
    val = generator()
    if text and not text.endswith("\n"):
        text += "\n"
    text += f"{key}={val}\n"
    return text, True, val[-4:]


def main() -> int:
    env_path = Path(sys.argv[1] if len(sys.argv) > 1 else "/root/knowt/.env")
    if not env_path.exists():
        print("missing_env", env_path)
        return 2
    text = env_path.read_text(encoding="utf-8")
    text, created_pw, suf_pw = _ensure(
        text, "KNOWT_CHAT_PASSWORD", lambda: secrets.token_urlsafe(12)
    )
    text, created_sk, suf_sk = _ensure(
        text, "KNOWT_SECRET_KEY", lambda: secrets.token_hex(24)
    )
    env_path.write_text(text, encoding="utf-8")
    env_path.chmod(0o600)
    print("chat_password_created", created_pw, "suffix", suf_pw)
    print("secret_key_created", created_sk, "suffix", suf_sk)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
