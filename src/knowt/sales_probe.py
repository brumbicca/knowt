"""Probe de evidência sales — amostra Tiny, sem publicar capability."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from knowt.period import Period, today_br
from knowt.sales_gates import can_publish_sales_summary, load_gates
from knowt.tiny_order_detail import fetch_order_detail
from knowt.tiny_orders import count_orders_in_period, fetch_orders_page

TZ = ZoneInfo("America/Sao_Paulo")


def evidence_dir(data_dir: Path) -> Path:
    path = Path(data_dir) / "evidence"
    path.mkdir(parents=True, exist_ok=True)
    return path


def run_sales_probe(
    token: str,
    data_dir: Path,
    *,
    period: Optional[Period] = None,
    detail_samples: int = 5,
) -> Dict[str, Any]:
    """Corre amostra factual e grava evidência. Nunca muda capability para live."""
    hoje = today_br()
    if period is None:
        period = Period(hoje - __import__("datetime").timedelta(days=6), hoje, "últimos 7 dias")
    d0, d1 = period.tiny_bounds()

    counted = count_orders_in_period(token, data_inicial=d0, data_final=d1)
    page = fetch_orders_page(
        token,
        page=1,
        data_inicial=d0,
        data_final=d1,
    )

    detail_rows: List[Dict[str, Any]] = []
    for oid in (page.order_ids if page.ok else [])[: max(0, int(detail_samples))]:
        det = fetch_order_detail(token, oid)
        detail_rows.append(
            {
                "order_id": oid,
                "ok": det.ok,
                "numero": getattr(det, "numero", None),
                "valor_total": det.valor_total,
                "situacao": det.situacao,
                "reason_code": det.reason_code,
            }
        )

    order_numeros: List[str] = []
    for prev in page.order_previews if page.ok else []:
        if isinstance(prev, dict) and prev.get("numero"):
            order_numeros.append(str(prev["numero"]))
    for row in detail_rows:
        if row.get("numero"):
            order_numeros.append(str(row["numero"]))
    # dedupe preservando ordem
    seen_n: set[str] = set()
    order_numeros_u: List[str] = []
    for n in order_numeros:
        if n in seen_n:
            continue
        seen_n.add(n)
        order_numeros_u.append(n)

    gates = load_gates(data_dir)
    ok_publish, missing = can_publish_sales_summary(data_dir)

    evidence: Dict[str, Any] = {
        "version": 1,
        "kind": "sales_probe",
        "quality": "estimate",
        "at": datetime.now(TZ).isoformat(),
        "period": {
            "label": period.label,
            "inicio": period.start.isoformat(),
            "fim": period.end.isoformat(),
            "tiny_data_inicial": d0,
            "tiny_data_final": d1,
        },
        "orders_count": {
            "ok": counted.ok,
            "total_orders": counted.total_orders if counted.ok else None,
            "method": counted.method,
            "reason_code": counted.reason_code,
            "total_pages": counted.total_pages,
        },
        "page1_sample": {
            "ok": page.ok,
            "order_count": page.order_count if page.ok else None,
            "page_valor_sum": page.page_valor_sum if page.ok else None,
            "page_valor_parsed": page.page_valor_parsed if page.ok else 0,
            "order_ids_sample": list(page.order_ids[:10]) if page.ok else [],
            "order_numeros_sample": order_numeros_u[:25],
            "order_previews": list(page.order_previews[:8]) if page.ok else [],
            "reason_code": page.reason_code,
            "warning": (
                "Soma de `valor` só da 1ª página — não extrapolar para o período inteiro."
            ),
        },
        "detail_samples": detail_rows,
        "margin": {
            "status": "not_computed",
            "reason": (
                "CMV/margem exigem decisão de negócio (cost_field) — ver sales_summary_gates.json"
            ),
        },
        "gates": {
            "approved_to_publish": gates.get("approved_to_publish"),
            "missing_for_publish": missing,
            "answers": gates.get("answers"),
        },
        "capability_recommendation": {
            "sales.summary": "unavailable",
            "note": "Probe não publica. Só publish_sales_summary_live após gates.",
        },
    }

    stamp = datetime.now(TZ).strftime("%Y%m%dT%H%M%S")
    out_path = evidence_dir(data_dir) / f"sales_probe_{stamp}.json"
    out_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    latest = evidence_dir(data_dir) / "sales_probe_latest.json"
    latest.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    evidence["path"] = str(out_path)
    evidence["can_publish"] = ok_publish
    return evidence


def load_latest_probe(data_dir: Path) -> Optional[Dict[str, Any]]:
    path = evidence_dir(data_dir) / "sales_probe_latest.json"
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
