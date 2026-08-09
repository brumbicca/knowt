#!/usr/bin/env python3
"""CLI Discovery UI knowt — login interactivo e probe aba Custos Tiny."""
from __future__ import annotations

import argparse
import json
import os
import sys
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

from knowt.config import Settings  # noqa: E402
from knowt.discovery_ui import (  # noqa: E402
    has_storage_state,
    login_interactive,
    probe_product_costs,
    storage_state_path,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="knowt Discovery UI (Playwright)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_login = sub.add_parser("login", help="Login headed → grava storage_state")
    p_login.add_argument("--url", default="https://erp.olist.com/")

    p_probe = sub.add_parser("probe-cost", help="Abre produto → aba Custos → evidence")
    p_probe.add_argument(
        "--product-id",
        default=None,
        help="Id Tiny do produto (default CCRCHP-200 / env KNOWT_DISCOVERY_PRODUCT_ID)",
    )
    p_probe.add_argument("--headed", action="store_true", help="Mostrar browser")

    args = parser.parse_args()
    settings = Settings.from_env()
    settings.data_dir.mkdir(parents=True, exist_ok=True)

    if args.cmd == "login":
        path = login_interactive(settings.data_dir, base_url=args.url)
        print(json.dumps({"ok": True, "state": str(path)}, ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "probe-cost":
        if not has_storage_state(settings.data_dir):
            print(
                json.dumps(
                    {
                        "ok": False,
                        "error": "storage_state_missing",
                        "state": str(storage_state_path(settings.data_dir)),
                        "hint": "python scripts/run_discovery_ui.py login",
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 2
        evidence = probe_product_costs(
            settings.data_dir,
            product_id=args.product_id,
            headless=not args.headed,
        )
        print(
            json.dumps(
                {
                    "ok": evidence.get("ok"),
                    "path": evidence.get("path"),
                    "product": evidence.get("product"),
                    "tab": evidence.get("tab"),
                    "fields": evidence.get("fields"),
                    "error": evidence.get("error"),
                    "login_wall": evidence.get("login_wall"),
                    "gates_note": evidence.get("gates_note"),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0 if evidence.get("ok") else 3

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
