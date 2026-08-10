#!/usr/bin/env python3
"""Diagnóstico: estrutura do ecrã Filtrar dos relatórios de margem Tiny."""
from __future__ import annotations

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

from knowt.config import Settings
from knowt.discovery_ui import has_storage_state, storage_state_path


DUMP_JS = """() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const items = [];
  for (const el of Array.from(document.querySelectorAll(
    'button, a, label, span, div, li, input, select, [role="button"], [role="option"], [role="radio"], [role="checkbox"]'
  ))) {
    if (!visible(el)) continue;
    const text = norm(el.innerText || el.value || el.placeholder || '');
    if (!text || text.length > 80) continue;
    if (!/hoje|ontem|dias|per[ií]odo|situa|marcador|natureza|e-?commerce|gerar|filtr|data|venda|envio|entrega|selecion/i.test(text)
        && el.tagName !== 'INPUT' && el.tagName !== 'SELECT') continue;
    const r = el.getBoundingClientRect();
    items.push({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      type: el.getAttribute('type') || '',
      text,
      cls: (el.className && String(el.className).slice(0, 80)) || '',
      name: el.getAttribute('name') || '',
      id: el.id || '',
      x: Math.round(r.x), y: Math.round(r.y),
    });
  }
  // dedupe
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = `${it.tag}|${it.text}|${it.x}|${it.y}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return {
    url: location.href,
    title: document.title,
    body_slice: norm(document.body.innerText).slice(0, 900),
    items: out.slice(0, 120),
  };
}"""


def main() -> int:
    settings = Settings.from_env()
    data_dir = settings.data_dir
    if not has_storage_state(data_dir):
        print(json.dumps({"ok": False, "error": "storage_state_missing"}, ensure_ascii=False))
        return 2

    from playwright.sync_api import sync_playwright

    hub = "https://erp.olist.com/relatorios_sistema?id=3"
    report_url = "https://erp.olist.com/relatorios_personalizados#/view/27"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            locale="pt-BR",
            storage_state=str(storage_state_path(data_dir)),
        )
        page = context.new_page()
        page.goto(report_url, wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(2500)
        dump1 = page.evaluate(DUMP_JS)

        # tentar clicar "últimos 7 dias" via JS
        clicked = page.evaluate(
            """() => {
              const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
              const wanted = ['últimos 7 dias', 'ultimos 7 dias', 'período', 'periodo'];
              for (const el of Array.from(document.querySelectorAll('*'))) {
                const t = norm(el.innerText);
                if (!t || t.length > 40) continue;
                if (!wanted.includes(t)) continue;
                const r = el.getBoundingClientRect();
                if (r.width < 4 || r.height < 4) continue;
                el.click();
                return { text: t, tag: el.tagName, cls: String(el.className||'').slice(0,80) };
              }
              return null;
            }"""
        )
        page.wait_for_timeout(1200)
        dump2 = page.evaluate(DUMP_JS)

        # abrir Situações se possível
        sit = page.evaluate(
            """() => {
              const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
              for (const el of Array.from(document.querySelectorAll('*'))) {
                const t = norm(el.innerText);
                if (!t || t.length > 60) continue;
                if (!t.includes('situa')) continue;
                if (!(t.includes('venda') || t.includes('nenhuma') || t.includes('op'))) continue;
                const r = el.getBoundingClientRect();
                if (r.width < 4 || r.height < 4) continue;
                el.click();
                return { text: t.slice(0,80), tag: el.tagName };
              }
              return null;
            }"""
        )
        page.wait_for_timeout(1200)
        dump3 = page.evaluate(DUMP_JS)

        out = {
            "ok": True,
            "storage": str(storage_state_path(data_dir)),
            "clicked_chip": clicked,
            "clicked_situacoes": sit,
            "after_open": dump1,
            "after_chip": dump2,
            "after_situacoes": dump3,
        }
        dest = data_dir / "evidence" / "ui_margin_filter_diag.json"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({
            "ok": True,
            "path": str(dest),
            "clicked_chip": clicked,
            "clicked_situacoes": sit,
            "items_after_open": len((dump1 or {}).get("items") or []),
            "items_after_chip": len((dump2 or {}).get("items") or []),
            "body_after_chip": ((dump2 or {}).get("body_slice") or "")[:280],
            "sample_items": ((dump2 or {}).get("items") or [])[:25],
        }, ensure_ascii=False, indent=2))
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
