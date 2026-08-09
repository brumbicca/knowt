#!/usr/bin/env python3
"""CLI Discovery UI knowt — login, mapa do sistema, aba Custos."""
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
from knowt.discovery_ui import (
    has_storage_state,
    login_interactive,
    probe_margin_reports,
    probe_product_costs,
    probe_system,
    probe_system_expand,
    storage_state_path,
)


def _need_state(data_dir: Path) -> int:
    print(
        json.dumps(
            {
                "ok": False,
                "error": "storage_state_missing",
                "state": str(storage_state_path(data_dir)),
                "hint": "python scripts/run_discovery_ui.py login",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 2


def main() -> int:
    parser = argparse.ArgumentParser(description="knowt Discovery UI (Playwright)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_login = sub.add_parser("login", help="Login headed → grava storage_state")
    p_login.add_argument("--url", default="https://erp.olist.com/")

    p_sys = sub.add_parser(
        "probe-system",
        help="Mapa do ERP: navegação + páginas-chave (conhecer o sistema)",
    )
    p_sys.add_argument("--headed", action="store_true")
    p_sys.add_argument(
        "--shallow",
        action="store_true",
        help="Só as primeiras 3 páginas (smoke rápido)",
    )

    p_exp = sub.add_parser(
        "probe-system-expand",
        help="Abre menus laterais e visita sublinks ainda não mapeados",
    )
    p_exp.add_argument("--headed", action="store_true")
    p_exp.add_argument("--max-pages", type=int, default=35)

    p_marg = sub.add_parser(
        "probe-margin-reports",
        help="Abre relatórios Tiny de margem (Avaliação + Contribuição)",
    )
    p_marg.add_argument("--headed", action="store_true")

    p_probe = sub.add_parser("probe-cost", help="Produto → aba Custos → evidence")
    p_probe.add_argument("--product-id", default=None)
    p_probe.add_argument("--headed", action="store_true")

    args = parser.parse_args()
    settings = Settings.from_env()
    settings.data_dir.mkdir(parents=True, exist_ok=True)

    if args.cmd == "login":
        path = login_interactive(settings.data_dir, base_url=args.url)
        print(json.dumps({"ok": True, "state": str(path)}, ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "probe-system":
        if not has_storage_state(settings.data_dir):
            return _need_state(settings.data_dir)
        evidence = probe_system(
            settings.data_dir,
            headless=not args.headed,
            shallow=args.shallow,
        )
        pages = evidence.get("pages") or []
        print(
            json.dumps(
                {
                    "ok": evidence.get("ok"),
                    "path": evidence.get("path"),
                    "nav_count": len(evidence.get("nav_labels") or []),
                    "nav_links": len(evidence.get("nav_links") or []),
                    "pages_ok": evidence.get("pages_ok"),
                    "pages_total": evidence.get("pages_total"),
                    "domains_seen": evidence.get("domains_seen"),
                    "pages": [
                        {
                            "key": p.get("key"),
                            "ok": p.get("ok"),
                            "title": p.get("page_title"),
                            "tabs": (p.get("tabs") or [])[:8],
                            "table_headers": (p.get("table_headers") or [])[:10],
                        }
                        for p in pages
                    ],
                    "error": evidence.get("error"),
                    "login_wall": evidence.get("login_wall"),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0 if evidence.get("ok") else 3

    if args.cmd == "probe-system-expand":
        if not has_storage_state(settings.data_dir):
            return _need_state(settings.data_dir)
        evidence = probe_system_expand(
            settings.data_dir,
            headless=not args.headed,
            max_pages=args.max_pages,
        )
        pages = evidence.get("pages") or []
        print(
            json.dumps(
                {
                    "ok": evidence.get("ok"),
                    "path": evidence.get("path"),
                    "menus_opened": evidence.get("menus_opened"),
                    "discovered_total": evidence.get("discovered_total"),
                    "pages_ok": evidence.get("pages_ok"),
                    "pages_total": evidence.get("pages_total"),
                    "pages": [
                        {
                            "key": p.get("key"),
                            "ok": p.get("ok"),
                            "label": p.get("label"),
                            "via": p.get("via"),
                            "title": p.get("page_title"),
                            "url": p.get("url"),
                        }
                        for p in pages
                    ],
                    "error": evidence.get("error"),
                    "login_wall": evidence.get("login_wall"),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0 if evidence.get("ok") else 3

    if args.cmd == "probe-margin-reports":
        if not has_storage_state(settings.data_dir):
            return _need_state(settings.data_dir)
        evidence = probe_margin_reports(
            settings.data_dir,
            headless=not args.headed,
        )
        print(
            json.dumps(
                {
                    "ok": evidence.get("ok"),
                    "path": evidence.get("path"),
                    "hub_report_names": (evidence.get("hub_report_names") or [])[:20],
                    "reports_ok": evidence.get("reports_ok"),
                    "reports": [
                        {
                            "key": r.get("key"),
                            "ok": r.get("ok"),
                            "clicked": r.get("clicked"),
                            "customized": r.get("customized"),
                            "title": r.get("page_title"),
                            "url": r.get("url"),
                            "columns": (r.get("columns") or [])[:20],
                            "costish": (r.get("available_columns_sample") or [])[:15],
                            "hints": r.get("hints"),
                            "error": r.get("error"),
                        }
                        for r in (evidence.get("reports") or [])
                    ],
                    "findings": evidence.get("findings"),
                    "error": evidence.get("error"),
                    "login_wall": evidence.get("login_wall"),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0 if evidence.get("ok") else 3

    if args.cmd == "probe-cost":
        if not has_storage_state(settings.data_dir):
            return _need_state(settings.data_dir)
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
