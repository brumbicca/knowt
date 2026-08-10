#!/usr/bin/env python3
"""Gera relatório oficial (7d) + extrai amostra para reconciliar com sales_probe."""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

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
from knowt.discovery_ui import (
    _open_margin_filter_modal,
    _select_multiselect_all,
    evidence_dir,
    has_storage_state,
    storage_state_path,
)
from knowt.sales_probe import load_latest_probe, run_sales_probe
from knowt.tiny_orders import fetch_orders_page
from knowt.vault import resolve_secret
from knowt.period import Period, today_br
from datetime import timedelta

TZ = ZoneInfo("America/Sao_Paulo")


EXTRACT_JS = """() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const headers = Array.from(document.querySelectorAll('th'))
    .map((el) => norm(el.innerText)).filter(Boolean);
  const numIdx = headers.findIndex((h) => /^n[uú]mero$/i.test(h));
  const valorIdx = headers.findIndex((h) => /valor total da venda/i.test(h));
  const rows = Array.from(document.querySelectorAll('table tbody tr'));
  const nums = [];
  let valorSum = 0;
  let valorN = 0;
  for (const tr of rows) {
    const tds = Array.from(tr.querySelectorAll('td')).map((td) => norm(td.innerText));
    if (numIdx >= 0 && tds[numIdx]) nums.push(tds[numIdx]);
    if (valorIdx >= 0 && tds[valorIdx]) {
      const raw = tds[valorIdx].replace(/R\\$\\s?/, '').replace(/\\./g, '').replace(',', '.');
      const v = parseFloat(raw);
      if (!Number.isNaN(v)) { valorSum += v; valorN += 1; }
    }
  }
  const uniq = [...new Set(nums)];
  const hints = [];
  for (const el of Array.from(document.querySelectorAll('a,button,span,div,li,p'))) {
    const t = norm(el.innerText);
    if (!t || t.length > 70) continue;
    if (/registro|resultad|p[aá]gina|de \\d+|mostrar|total|linhas/i.test(t)) hints.push(t);
  }
  return {
    headers,
    row_count: rows.length,
    unique_order_nums: uniq.length,
    sample_order_nums: uniq.slice(0, 25),
    page_valor_sum: Math.round(valorSum * 100) / 100,
    page_valor_rows: valorN,
    ui_hints: [...new Set(hints)].slice(0, 40),
  };
}"""


def _parse_br_float(raw: str | None) -> float | None:
    if raw is None:
        return None
    s = str(raw).strip().replace("R$", "").replace(" ", "")
    if not s:
        return None
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def generate_avaliacao(page) -> dict:
    hub = "https://erp.olist.com/relatorios_sistema?id=3"
    page.goto(hub, wait_until="domcontentloaded", timeout=60_000)
    page.wait_for_timeout(1200)
    page.get_by_text(re.compile("avalia", re.I)).first.click(timeout=8000)
    page.wait_for_timeout(2000)
    opened = _open_margin_filter_modal(page)
    out = {"filter_modal": opened, "steps": []}
    if not opened.get("opened"):
        out["ok"] = False
        out["error"] = "filter_modal_not_opened"
        return out
    modal = page.locator(".modal-content").first
    try:
        modal.locator("button", has_text=re.compile(r"Últimos\s*7\s*dias", re.I)).first.click(
            timeout=4000
        )
        out["steps"].append("chip_7d")
    except Exception as exc:
        out["steps"].append(f"chip_fail:{type(exc).__name__}")
    out["situacoes_all"] = _select_multiselect_all(
        page, label_regex=r"Situa[cç][oõ]es da venda"
    )
    out["steps"].append(f"situacoes_all:{out['situacoes_all']}")
    modal.locator("button.btn-primary", has_text=re.compile(r"gerar relat", re.I)).last.click(
        timeout=5000
    )
    page.wait_for_timeout(8000)
    meta = page.evaluate(EXTRACT_JS)
    out["ok"] = bool((meta or {}).get("row_count"))
    out["url"] = page.url
    out["extract"] = meta
    out["selected_situacoes_text"] = None
    try:
        # already closed modal; ignore
        pass
    except Exception:
        pass
    return out


def main() -> int:
    settings = Settings.from_env()
    data_dir = settings.data_dir
    if not has_storage_state(data_dir):
        print(json.dumps({"ok": False, "error": "storage_state_missing"}, ensure_ascii=False))
        return 2

    # 1) refresh sales probe (API)
    token = resolve_secret("KNOWT_SECRET_TINY_TOKEN", required=False) or ""
    probe = None
    if token:
        probe = run_sales_probe(token, data_dir, detail_samples=8)
    else:
        probe = load_latest_probe(data_dir)

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            locale="pt-BR",
            viewport={"width": 1440, "height": 1000},
            storage_state=str(storage_state_path(data_dir)),
        )
        page = context.new_page()
        report = generate_avaliacao(page)
        shot = evidence_dir(data_dir) / "ui_margin_recon_page.png"
        page.screenshot(path=str(shot), full_page=False)
        browser.close()

    extract = report.get("extract") or {}
    probe_ids = []
    probe_numeros: list[str] = []
    if probe:
        probe_ids = list(((probe.get("page1_sample") or {}).get("order_ids_sample") or []))
        for d in probe.get("detail_samples") or []:
            if d.get("order_id"):
                probe_ids.append(str(d["order_id"]))
    probe_ids = [str(x) for x in probe_ids]

    # Números de pedido (coluna do relatório) via listagem API
    if token:
        try:
            hoje = today_br()
            period = Period(hoje - timedelta(days=6), hoje, "últimos 7 dias")
            d0, d1 = period.tiny_bounds()
            page1 = fetch_orders_page(token, page=1, data_inicial=d0, data_final=d1)
            for prev in page1.order_previews or []:
                if isinstance(prev, dict) and prev.get("numero"):
                    probe_numeros.append(str(prev["numero"]))
                # também ids internos
                if isinstance(prev, dict) and prev.get("id"):
                    probe_ids.append(str(prev["id"]))
        except Exception as exc:
            report.setdefault("steps", []).append(f"probe_numeros_fail:{type(exc).__name__}")

    report_nums = [str(x) for x in (extract.get("sample_order_nums") or [])]
    overlap_ids = sorted(set(probe_ids) & set(report_nums))
    overlap_numeros = sorted(set(probe_numeros) & set(report_nums))
    overlap = overlap_numeros or overlap_ids

    probe_count = ((probe or {}).get("orders_count") or {}).get("total_orders")
    ui_unique = extract.get("unique_order_nums")
    page1_valor = ((probe or {}).get("page1_sample") or {}).get("page_valor_sum")

    evidence = {
        "version": 1,
        "kind": "ui_margin_recon",
        "quality": "observation",
        "at": datetime.now(TZ).isoformat(timespec="seconds"),
        "period": (probe or {}).get("period")
        or {"label": "últimos 7 dias", "note": "sem probe fresco"},
        "report": {
            "key": "avaliacao_margem",
            "ok": report.get("ok"),
            "url": report.get("url"),
            "situacoes_all": report.get("situacoes_all"),
            "steps": report.get("steps"),
            "filter_modal": report.get("filter_modal"),
            "extract": extract,
            "screenshot": str(shot),
        },
        "probe": {
            "orders_total": probe_count,
            "method": ((probe or {}).get("orders_count") or {}).get("method"),
            "page1_valor_sum": page1_valor,
            "page1_order_count": ((probe or {}).get("page1_sample") or {}).get("order_count"),
            "order_ids_sample": probe_ids[:20],
            "order_numeros_sample": probe_numeros[:20],
            "path": (probe or {}).get("path"),
        },
        "comparison": {
            "orders_total_probe": probe_count,
            "orders_unique_on_report_page1": ui_unique,
            "report_page_rows": extract.get("row_count"),
            "report_page_valor_sum": extract.get("page_valor_sum"),
            "probe_page1_valor_sum": page1_valor,
            "sample_numero_overlap": overlap_numeros,
            "sample_id_overlap": overlap_ids,
            "sample_id_overlap_count": len(overlap),
            "notes": [
                "Relatório UI paginado (~100 linhas) — unique_order_nums é da 1ª página, não do período inteiro.",
                "Probe total_orders usa page_bounds da API; comparar magnitude, não igualdade com 100.",
                "Overlap preferencial por Número do pedido (coluna do relatório).",
                "Valor: só soma da 1ª página em ambos os lados (sem extrapolação).",
                "CMV/margem ainda fora — sem cost_field do dono.",
            ],
            "verdict": None,
        },
    }

    # verdict soft
    notes = []
    if probe_count and ui_unique:
        if probe_count >= ui_unique:
            notes.append("probe_total >= unique_na_pagina_relatorio (esperado se paginado)")
        else:
            notes.append("alerta: unique_na_pagina > probe_total")
    if overlap_numeros:
        notes.append(f"overlap números amostra: {len(overlap_numeros)}")
    elif overlap_ids:
        notes.append(f"overlap ids amostra: {len(overlap_ids)}")
    elif report_nums and (probe_ids or probe_numeros):
        notes.append("sem overlap nos primeiros ids/números — ordenação/filtro diferente")
    evidence["comparison"]["verdict"] = (
        "partial_ok"
        if report.get("ok") and probe_count and (overlap_numeros or overlap_ids or True)
        else "weak"
    )
    if report.get("ok") and probe_count and overlap_numeros:
        evidence["comparison"]["verdict"] = "aligned_sample"
    elif report.get("ok") and probe_count:
        evidence["comparison"]["verdict"] = "partial_ok"
    else:
        evidence["comparison"]["verdict"] = "weak"
    evidence["comparison"]["verdict_notes"] = notes

    folder = evidence_dir(data_dir)
    stamp = datetime.now(TZ).strftime("%Y%m%dT%H%M%S")
    path = folder / f"ui_margin_recon_{stamp}.json"
    latest = folder / "ui_margin_recon_latest.json"
    text = json.dumps(evidence, ensure_ascii=False, indent=2) + "\n"
    path.write_text(text, encoding="utf-8")
    latest.write_text(text, encoding="utf-8")
    evidence["path"] = str(path)
    print(json.dumps({
        "ok": bool(report.get("ok")),
        "path": str(path),
        "situacoes_all": report.get("situacoes_all"),
        "probe_orders": probe_count,
        "report_page_rows": extract.get("row_count"),
        "report_unique_orders": ui_unique,
        "report_page_valor_sum": extract.get("page_valor_sum"),
        "probe_page1_valor_sum": page1_valor,
        "overlap_numeros": overlap_numeros[:10],
        "overlap_ids": overlap_ids[:10],
        "verdict": evidence["comparison"]["verdict"],
        "verdict_notes": notes,
        "sample_order_nums": (extract.get("sample_order_nums") or [])[:8],
        "probe_numeros": probe_numeros[:8],
    }, ensure_ascii=False, indent=2))
    return 0 if report.get("ok") else 3


if __name__ == "__main__":
    raise SystemExit(main())
