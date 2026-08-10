#!/usr/bin/env python3
"""Enrich recon: overlap Números da última página API (mais recentes) vs relatório."""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta
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

from knowt.period import Period, today_br
from knowt.tiny_orders import fetch_orders_page
from knowt.vault import resolve_secret

TZ = ZoneInfo("America/Sao_Paulo")


def main() -> int:
    data = Path(os.environ.get("KNOWT_DATA_DIR", "/root/knowt-data")).resolve()
    ev = data / "evidence"
    recon_path = ev / "ui_margin_recon_latest.json"
    probe_path = ev / "sales_probe_latest.json"
    recon = json.loads(recon_path.read_text(encoding="utf-8"))
    probe = json.loads(probe_path.read_text(encoding="utf-8"))
    token = resolve_secret("KNOWT_SECRET_TINY_TOKEN", required=True)

    period_info = probe.get("period") or {}
    if period_info.get("tiny_data_inicial"):
        d0 = period_info["tiny_data_inicial"]
        d1 = period_info["tiny_data_final"]
    else:
        hoje = today_br()
        period = Period(hoje - timedelta(days=6), hoje, "últimos 7 dias")
        d0, d1 = period.tiny_bounds()

    total_pages = int(((probe.get("orders_count") or {}).get("total_pages") or 1))
    last = fetch_orders_page(token, page=total_pages, data_inicial=d0, data_final=d1)
    first = fetch_orders_page(token, page=1, data_inicial=d0, data_final=d1)

    def nums_from(page) -> list[str]:
        out = []
        for prev in page.order_previews or []:
            if isinstance(prev, dict) and prev.get("numero"):
                out.append(str(prev["numero"]))
        return out

    first_n = nums_from(first)
    last_n = nums_from(last)
    report_nums = [
        str(x)
        for x in ((recon.get("report") or {}).get("extract") or {}).get("sample_order_nums")
        or []
    ]
    # também únicos da página se estiverem no extract completo
    report_set = set(report_nums)

    ov_first = sorted(set(first_n) & report_set)
    ov_last = sorted(set(last_n) & report_set)

    # se previews da última página forem poucos, cruzar ids→detalhe sob demanda é caro;
    # tenta também order_ids da última página vs... não ajuda (id≠número).

    # Se last page previews vazios de numero, parse raw via detail first 5 of last page
    if last.ok and not last_n and last.order_ids:
        from knowt.tiny_order_detail import fetch_order_detail

        for oid in last.order_ids[:12]:
            det = fetch_order_detail(token, oid)
            if det.ok and det.numero:
                last_n.append(str(det.numero))
        ov_last = sorted(set(last_n) & report_set)

    if first.ok and not first_n and first.order_ids:
        from knowt.tiny_order_detail import fetch_order_detail

        for oid in first.order_ids[:8]:
            det = fetch_order_detail(token, oid)
            if det.ok and det.numero:
                first_n.append(str(det.numero))
        ov_first = sorted(set(first_n) & report_set)

    best = ov_last or ov_first
    cmp_ = recon.setdefault("comparison", {})
    cmp_["api_page1_numeros"] = first_n[:20]
    cmp_["api_last_page"] = total_pages
    cmp_["api_last_page_numeros"] = last_n[:20]
    cmp_["sample_numero_overlap_page1"] = ov_first
    cmp_["sample_numero_overlap_last_page"] = ov_last
    cmp_["sample_numero_overlap"] = best
    cmp_["sample_id_overlap_count"] = len(best)
    cmp_["probe_page1_valor_sum"] = first.page_valor_sum if first.ok else None
    cmp_["api_last_page_valor_sum"] = last.page_valor_sum if last.ok else None
    cmp_["orders_total_probe"] = ((probe.get("orders_count") or {}).get("total_orders"))

    notes = [
        "Relatório UI 1ª página ≈ pedidos mais recentes (Nº alto).",
        f"API page_bounds: {total_pages} páginas · total "
        f"{(probe.get('orders_count') or {}).get('total_orders')}.",
        f"Situações selecionar todas no relatório: "
        f"{(recon.get('report') or {}).get('situacoes_all')}.",
    ]
    if ov_last:
        notes.append(f"overlap última página API ∩ relatório: {len(ov_last)} → {ov_last[:8]}")
        cmp_["verdict"] = "aligned_sample"
    elif ov_first:
        notes.append(f"overlap 1ª página API ∩ relatório: {len(ov_first)} → {ov_first[:8]}")
        cmp_["verdict"] = "aligned_sample"
    else:
        notes.append(
            "sem overlap nas bordas (página 1 / última) — possível filtro "
            "(situações/natureza) ou atraso entre gerações"
        )
        cmp_["verdict"] = "partial_ok"
    # valor observation
    notes.append(
        f"valor 1ª pág relatório={((recon.get('report') or {}).get('extract') or {}).get('page_valor_sum')} "
        f"· API pág1={first.page_valor_sum} · API última={last.page_valor_sum}"
    )
    cmp_["verdict_notes"] = notes
    cmp_["enriched_at"] = datetime.now(TZ).isoformat(timespec="seconds")

    recon.setdefault("probe", {})
    recon["probe"]["orders_total"] = cmp_["orders_total_probe"]
    recon["probe"]["page1_valor_sum"] = first.page_valor_sum if first.ok else None
    recon["probe"]["last_page_valor_sum"] = last.page_valor_sum if last.ok else None
    recon["probe"]["order_numeros_sample"] = (last_n or first_n)[:25]

    text = json.dumps(recon, ensure_ascii=False, indent=2) + "\n"
    recon_path.write_text(text, encoding="utf-8")
    print(
        json.dumps(
            {
                "ok": True,
                "total_pages": total_pages,
                "first_numeros": first_n[:8],
                "last_numeros": last_n[:8],
                "report_sample": report_nums[:8],
                "overlap_first": ov_first[:10],
                "overlap_last": ov_last[:10],
                "verdict": cmp_["verdict"],
                "first_valor": first.page_valor_sum,
                "last_valor": last.page_valor_sum,
                "report_valor": ((recon.get("report") or {}).get("extract") or {}).get(
                    "page_valor_sum"
                ),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
