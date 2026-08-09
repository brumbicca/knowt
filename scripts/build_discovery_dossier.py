#!/usr/bin/env python3
"""Gera discovery_dossier_latest.json + docs/TINY_DISCOVERY_DOSSIER.md."""
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
from knowt.discovery_dossier import (  # noqa: E402
    persist_discovery_dossier,
    render_dossier_markdown,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--md",
        default=str(ROOT / "docs" / "TINY_DISCOVERY_DOSSIER.md"),
        help="Caminho do markdown de saída",
    )
    args = parser.parse_args()
    settings = Settings.from_env()
    dossier = persist_discovery_dossier(settings.data_dir)
    md_path = Path(args.md)
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text(render_dossier_markdown(dossier), encoding="utf-8")
    print(
        json.dumps(
            {
                "ok": True,
                "json": dossier.get("path"),
                "md": str(md_path),
                "summary": dossier.get("summary"),
                "blocked_for_publish": dossier.get("blocked_for_publish"),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
