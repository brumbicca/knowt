#!/usr/bin/env python3
"""Gera SVG mono (preto) para mask CSS + copia para public/logos."""
from __future__ import annotations

import re
import shutil
from pathlib import Path

DIR = Path(__file__).resolve().parent
ROOT = DIR.parent
SRC = DIR / "logo_bellocopo_colorido.svg"
MONO = DIR / "logo_bellocopo_mono.svg"
PUBLIC = ROOT / "public" / "logos" / "logo_bellocopo.svg"


def main() -> None:
    svg = SRC.read_text(encoding="utf-8")
    mono = re.sub(r'fill="#[0-9a-fA-F]+"', 'fill="#000000"', svg)
    MONO.write_text(mono, encoding="utf-8")
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(MONO, PUBLIC)
    fills = sorted(set(re.findall(r'fill="(#[0-9a-fA-F]+)"', mono)))
    print(f"mono -> {MONO.name} fills={fills}")
    print(f"public -> {PUBLIC.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
