#!/usr/bin/env python3
"""Entrypoint: bot Telegram knowt (long poll → bridge local)."""
from __future__ import annotations

import logging
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

env_path = Path(os.environ.get("KNOWT_ENV_FILE") or ROOT / ".env")
if env_path.is_file():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("knowt.telegram.runner")


def main() -> int:
    from knowt.telegram_bot import bot_from_env, telegram_configured

    token = (os.environ.get("KNOWT_TELEGRAM_BOT_TOKEN") or "").strip()
    if not telegram_configured(token):
        log.error(
            "KNOWT_TELEGRAM_BOT_TOKEN em falta. "
            "Cria o bot no BotFather, põe o token em /root/knowt/.env e: "
            "systemctl restart knowt-telegram"
        )
        # Exit 2 → systemd RestartPreventExitStatus (não faz spam de restarts)
        return 2
    try:
        bot = bot_from_env()
        bot.run_forever()
    except SystemExit as exc:
        code = int(exc.code) if isinstance(exc.code, int) else 2
        return code
    except KeyboardInterrupt:
        log.info("parado")
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
