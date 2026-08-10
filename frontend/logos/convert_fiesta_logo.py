#!/usr/bin/env python3
"""Converte logo Fiesta Party PDF → SVG mono croado (silhueta) + public/logos.

O PDF traz o «F» como raster; paths soltos + canvas 1080² deixavam o logo
minúsculo no card. Gera silhueta preta no bbox real e embute num SVG apertado.
"""
from __future__ import annotations

import base64
import io
import re
import shutil
from pathlib import Path

import fitz
from PIL import Image

DIR = Path(__file__).resolve().parent
ROOT = DIR.parent
PDF = DIR / "logo_fiestaparty2024_principal.pdf"
SVG_COLOR = DIR / "logo_fiesta_colorido.svg"
SVG_MONO = DIR / "logo_fiesta_mono.svg"
PNG_OUT = DIR / "logo_fiesta.png"
PUBLIC = ROOT / "public" / "logos" / "logo_fiesta.svg"

# margem no viewBox (unidades PDF)
PAD = 12
ZOOM = 3


def _silhueta(page: fitz.Page) -> tuple[Image.Image, tuple[int, int, int, int]]:
    pix = page.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), alpha=True)
    mode = "RGBA" if pix.alpha else "RGB"
    img = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    pixels = img.load()
    assert pixels is not None
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = pixels[x, y]
            # fundo branco → transparente; resto → preto opaco (mask CSS)
            if a < 8 or (r >= 248 and g >= 248 and b >= 248):
                pixels[x, y] = (0, 0, 0, 0)
            else:
                pixels[x, y] = (0, 0, 0, 255)
    bbox = img.getbbox()
    if not bbox:
        raise RuntimeError("silhueta vazia")
    return img, bbox


def main() -> None:
    doc = fitz.open(PDF)
    page = doc[0]
    print(f"pages={doc.page_count} size={page.rect}")

    svg = page.get_svg_image(text_as_path=True)
    svg = svg.replace(' xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"', "")
    svg = re.sub(r' inkscape:[a-zA-Z\-]+="[^"]*"', "", svg)
    SVG_COLOR.write_text(svg, encoding="utf-8")
    fills = sorted(set(re.findall(r'fill="(#[0-9a-fA-F]+)"', svg)))
    print(f"color SVG fills={fills} bytes={SVG_COLOR.stat().st_size}")

    full, bbox = _silhueta(page)
    cropped = full.crop(bbox)
    cropped.save(PNG_OUT, "PNG")
    print(f"PNG -> {PNG_OUT.name} size={cropped.size} from_bbox={bbox}")

    # viewBox em coords do PDF (zoom inverso) + padding
    x0 = max(0.0, bbox[0] / ZOOM - PAD)
    y0 = max(0.0, bbox[1] / ZOOM - PAD)
    x1 = min(page.rect.width, bbox[2] / ZOOM + PAD)
    y1 = min(page.rect.height, bbox[3] / ZOOM + PAD)
    vw, vh = x1 - x0, y1 - y0

    buf = io.BytesIO()
    cropped.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    mono = (
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'version="1.1" width="{vw:.3f}" height="{vh:.3f}" viewBox="0 0 {vw:.3f} {vh:.3f}">\n'
        f'<image x="0" y="0" width="{vw:.3f}" height="{vh:.3f}" '
        f'xlink:href="data:image/png;base64,{b64}"/>\n'
        f"</svg>\n"
    )
    SVG_MONO.write_text(mono, encoding="utf-8")
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SVG_MONO, PUBLIC)
    print(f"mono -> {PUBLIC.relative_to(ROOT)} viewBox=0 0 {vw:.1f} {vh:.1f} bytes={PUBLIC.stat().st_size}")


if __name__ == "__main__":
    main()
