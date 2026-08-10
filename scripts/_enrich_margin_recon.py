#!/usr/bin/env python3
"""Actualiza ui_margin_recon_latest.json com overlap por Número (precisa probe fresco)."""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

TZ = ZoneInfo("America/Sao_Paulo")


def main() -> int:
    data = Path(os.environ.get("KNOWT_DATA_DIR", ROOT / "data")).expanduser().resolve()
    ev = data / "evidence"
    recon_path = ev / "ui_margin_recon_latest.json"
    probe_path = ev / "sales_probe_latest.json"
    if not recon_path.is_file() or not probe_path.is_file():
        print(json.dumps({"ok": False, "error": "missing_recon_or_probe"}, ensure_ascii=False))
        return 2
    recon = json.loads(recon_path.read_text(encoding="utf-8"))
    probe = json.loads(probe_path.read_text(encoding="utf-8"))
    p1 = probe.get("page1_sample") or {}
    numeros = [str(x) for x in (p1.get("order_numeros_sample") or [])]
    for d in probe.get("detail_samples") or []:
        if d.get("numero"):
            numeros.append(str(d["numero"]))
    # dedupe
    seen = set()
    numeros_u = []
    for n in numeros:
        if n in seen:
            continue
        seen.add(n)
        numeros_u.append(n)

    report_nums = [
        str(x)
        for x in ((recon.get("report") or {}).get("extract") or {}).get("sample_order_nums")
        or []
    ]
    # Also load unique set from extract if we expand later
    overlap = sorted(set(numeros_u) & set(report_nums))

    recon.setdefault("probe", {})
    recon["probe"]["orders_total"] = ((probe.get("orders_count") or {}).get("total_orders"))
    recon["probe"]["method"] = ((probe.get("orders_count") or {}).get("method"))
    recon["probe"]["page1_valor_sum"] = p1.get("page_valor_sum")
    recon["probe"]["page1_order_count"] = p1.get("order_count")
    recon["probe"]["order_ids_sample"] = list(p1.get("order_ids_sample") or [])[:20]
    recon["probe"]["order_numeros_sample"] = numeros_u[:25]
    recon["probe"]["path"] = str(probe_path)
    recon["probe"]["at"] = probe.get("at")
    recon["period"] = probe.get("period") or recon.get("period")

    cmp_ = recon.setdefault("comparison", {})
    cmp_["orders_total_probe"] = recon["probe"]["orders_total"]
    cmp_["probe_page1_valor_sum"] = recon["probe"]["page1_valor_sum"]
    cmp_["sample_numero_overlap"] = overlap
    cmp_["sample_id_overlap_count"] = len(overlap)
    notes = list(cmp_.get("verdict_notes") or [])
    # refresh notes
    notes = [
        n
        for n in notes
        if "overlap" not in n.lower() and "sem overlap" not in n.lower()
    ]
    if overlap:
        notes.append(f"overlap números amostra: {len(overlap)} → {overlap[:8]}")
        cmp_["verdict"] = "aligned_sample"
    elif numeros_u and report_nums:
        notes.append(
            "sem overlap numeros página1 API vs amostra relatório "
            "(ordenação/filtro Situações pode divergir)"
        )
        cmp_["verdict"] = "partial_ok"
    cmp_["verdict_notes"] = notes
    cmp_["enriched_at"] = datetime.now(TZ).isoformat(timespec="seconds")

    text = json.dumps(recon, ensure_ascii=False, indent=2) + "\n"
    recon_path.write_text(text, encoding="utf-8")
    stamp = ev / f"ui_margin_recon_{datetime.now(TZ).strftime('%Y%m%dT%H%M%S')}_enriched.json"
    stamp.write_text(text, encoding="utf-8")
    print(
        json.dumps(
            {
                "ok": True,
                "path": str(recon_path),
                "probe_numeros": numeros_u[:10],
                "report_sample": report_nums[:10],
                "overlap": overlap[:15],
                "overlap_count": len(overlap),
                "verdict": cmp_.get("verdict"),
                "probe_orders": recon["probe"]["orders_total"],
                "report_page_valor": ((recon.get("report") or {}).get("extract") or {}).get(
                    "page_valor_sum"
                ),
                "probe_page1_valor": recon["probe"]["page1_valor_sum"],
                "situacoes_all": (recon.get("report") or {}).get("situacoes_all"),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
