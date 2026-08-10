#!/usr/bin/env python3
"""Converte logo PDF vetorial → SVG (sem fundo) + PNG preview com alpha."""
from __future__ import annotations

import re
from pathlib import Path

import fitz

DIR = Path(__file__).resolve().parent
PDF = DIR / "logo_bellocopo_colorido.pdf"
SVG_OUT = DIR / "logo_bellocopo_colorido.svg"
PNG_OUT = DIR / "logo_bellocopo_colorido.png"


def main() -> None:
    doc = fitz.open(PDF)
    page = doc[0]
    assert not page.get_images(), "PDF tem imagens raster embutidas"
    assert page.get_drawings(), "PDF sem paths vetoriais"

    svg = page.get_svg_image(text_as_path=True)
    svg = svg.replace(' xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"', "")
    svg = re.sub(r' inkscape:[a-zA-Z\-]+="[^"]*"', "", svg)

    low = svg.lower()
    if 'fill="#fff' in low or 'fill="white' in low or 'fill="#ffffff' in low:
        raise SystemExit("SVG ainda tem fill branco — rever fundo")

    SVG_OUT.write_text(svg, encoding="utf-8")
    fills = sorted(set(re.findall(r'fill="(#[0-9a-fA-F]+)"', svg)))
    print(f"SVG -> {SVG_OUT.name} ({SVG_OUT.stat().st_size} bytes)")
    print(f"fills: {fills}")

    # PNG com canal alpha
    zoom = 3
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=True)
    try:
        from PIL import Image

        mode = "RGBA" if pix.alpha else "RGB"
        img = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
        if img.mode != "RGBA":
            img = img.convert("RGBA")
        pixels = img.load()
        assert pixels is not None
        for y in range(img.height):
            for x in range(img.width):
                r, g, b, a = pixels[x, y]
                if r >= 248 and g >= 248 and b >= 248:
                    pixels[x, y] = (r, g, b, 0)
        img.save(PNG_OUT, "PNG")
    except ImportError:
        pix.save(str(PNG_OUT))
    print(f"PNG -> {PNG_OUT.name} ({PNG_OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
