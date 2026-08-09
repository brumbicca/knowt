"""Dossiê de Discovery Tiny — inventário consolidado a partir das evidências UI.

Não publica capabilities; só sintetiza o que o Playwright já observou.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from knowt.discovery_ui import (
    evidence_dir,
    load_latest_margin_reports,
    load_latest_product_cost_probe,
    load_latest_system_map,
    load_latest_system_map_expand,
)
from knowt.sales_gates import load_gates
from knowt.sales_probe import load_latest_probe


def _page_summary(pages: List[Dict[str, Any]], *, limit: int = 40) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for p in pages[:limit]:
        out.append(
            {
                "key": p.get("key"),
                "label": p.get("label"),
                "url": p.get("url"),
                "ok": p.get("ok"),
                "via": p.get("via") or p.get("domain"),
                "title": p.get("page_title"),
            }
        )
    return out


def build_discovery_dossier(data_dir: Path) -> Dict[str, Any]:
    """Consolida evidências locais num inventário estável para API/docs."""
    system = load_latest_system_map(data_dir) or {}
    expand = load_latest_system_map_expand(data_dir) or {}
    margins = load_latest_margin_reports(data_dir) or {}
    costs = load_latest_product_cost_probe(data_dir) or {}
    sales = load_latest_probe(data_dir) or {}
    gates = load_gates(data_dir)

    margin_reports = []
    for r in margins.get("reports") or []:
        margin_reports.append(
            {
                "key": r.get("key"),
                "label": r.get("label"),
                "url": r.get("url"),
                "ok": r.get("ok"),
                "columns_selected": (r.get("columns") or [])[:20],
                "cost_fields_in_catalog": (r.get("available_columns_sample") or [])[:10],
                "hints": r.get("hints"),
            }
        )

    cost_fields = []
    for f in costs.get("fields") or []:
        if f.get("found"):
            cost_fields.append(
                {
                    "api_key": f.get("api_key"),
                    "ui_label": f.get("ui_label"),
                    "raw_value": f.get("raw_value"),
                    "parsed": f.get("parsed"),
                }
            )

    dossier: Dict[str, Any] = {
        "version": 1,
        "kind": "discovery_dossier",
        "source_id": "tinyerp",
        "quality": "observation",
        "summary": {
            "system_map_pages": len(system.get("pages") or []),
            "expand_discovered": expand.get("discovered_total"),
            "expand_pages_ok": expand.get("pages_ok"),
            "expand_pages_total": expand.get("pages_total"),
            "margin_reports_ok": margins.get("reports_ok"),
            "product_cost_ok": costs.get("ok"),
            "sales_probe_orders": ((sales.get("orders_count") or {}).get("total_orders")),
            "cost_field_gate": (gates.get("answers") or {}).get("cost_field"),
            "approved_to_publish": gates.get("approved_to_publish"),
        },
        "system_map": {
            "at": system.get("at"),
            "domains_seen": system.get("domains_seen") or [],
            "pages": _page_summary(list(system.get("pages") or [])),
        },
        "system_expand": {
            "at": expand.get("at"),
            "menus_opened": expand.get("menus_opened") or [],
            "discovered_total": expand.get("discovered_total"),
            "pages": _page_summary(list(expand.get("pages") or []), limit=50),
        },
        "margin_official_reports": {
            "at": margins.get("at"),
            "hub_url": margins.get("hub_url"),
            "findings": margins.get("findings") or [],
            "reports": margin_reports,
        },
        "product_cost_sample": {
            "at": costs.get("at"),
            "product": costs.get("product"),
            "fields": cost_fields,
            "note": costs.get("gates_note"),
        },
        "sales_probe": {
            "at": sales.get("at"),
            "period": sales.get("period"),
            "orders_total": ((sales.get("orders_count") or {}).get("total_orders")),
            "page1_valor_sum": ((sales.get("page1_sample") or {}).get("page_valor_sum")),
        },
        "gates": {
            "answers": gates.get("answers"),
            "approved_to_publish": gates.get("approved_to_publish"),
            "approver": gates.get("approver"),
            "notes": gates.get("notes"),
        },
        "blocked_for_publish": [
            x
            for x in [
                None
                if (gates.get("answers") or {}).get("cost_field")
                not in (None, "defer")
                else "cost_field=defer (aguardar dono)",
                None if gates.get("approved_to_publish") else "approved_to_publish=false",
            ]
            if x
        ],
        "next_human_questions": [
            "No CMV do piloto: usar Preço de custo ou Custo médio "
            "(ambos existem na aba Custos e no catálogo dos relatórios oficiais)?",
        ],
    }
    return dossier


def persist_discovery_dossier(data_dir: Path) -> Dict[str, Any]:
    dossier = build_discovery_dossier(data_dir)
    folder = evidence_dir(data_dir)
    path = folder / "discovery_dossier_latest.json"
    path.write_text(
        json.dumps(dossier, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    dossier["path"] = str(path)
    return dossier


def render_dossier_markdown(dossier: Dict[str, Any]) -> str:
    s = dossier.get("summary") or {}
    lines = [
        "# Dossiê Discovery — Tiny / Olist (knowt)",
        "",
        "**Fonte:** `tinyerp` · evidências Playwright + probe API (sem publish cego)",
        "",
        "## Resumo",
        "",
        f"- Mapa base: **{s.get('system_map_pages')}** páginas",
        f"- Expand menus: **{s.get('expand_discovered')}** links · "
        f"**{s.get('expand_pages_ok')}/{s.get('expand_pages_total')}** visitadas OK",
        f"- Relatórios oficiais de margem: **{s.get('margin_reports_ok')}** OK",
        f"- Amostra aba Custos: **{'ok' if s.get('product_cost_ok') else 'n/d'}**",
        f"- Probe vendas (7d): **{s.get('sales_probe_orders')}** pedidos",
        f"- Gate `cost_field`: **`{s.get('cost_field_gate')}`**",
        f"- `approved_to_publish`: **{s.get('approved_to_publish')}**",
        "",
        "## Bloqueios para publish",
        "",
    ]
    blocked = dossier.get("blocked_for_publish") or []
    if blocked:
        for b in blocked:
            lines.append(f"- {b}")
    else:
        lines.append("- (nenhum)")
    lines += ["", "## Relatórios oficiais de margem", ""]
    for r in ((dossier.get("margin_official_reports") or {}).get("reports") or []):
        lines.append(f"### {r.get('label')}")
        lines.append(f"- URL: `{r.get('url')}`")
        cols = r.get("columns_selected") or []
        if cols:
            lines.append(f"- Colunas seleccionadas (amostra): {', '.join(cols[:12])}")
        costish = r.get("cost_fields_in_catalog") or []
        if costish:
            lines.append(f"- No catálogo «adicionar colunas»: **{', '.join(costish)}**")
        lines.append("")
    pc = dossier.get("product_cost_sample") or {}
    lines += [
        "## Amostra aba Custos (produto)",
        "",
        f"- Produto: {(pc.get('product') or {}).get('name')}",
        f"- URL: `{(pc.get('product') or {}).get('url')}`",
        "",
    ]
    for f in pc.get("fields") or []:
        lines.append(
            f"- **{f.get('ui_label')}** (`{f.get('api_key')}`) = {f.get('raw_value')}"
        )
    lines += ["", "## Módulos / páginas observadas (expand)", ""]
    for p in ((dossier.get("system_expand") or {}).get("pages") or [])[:40]:
        if not p.get("ok"):
            continue
        lines.append(f"- {p.get('label')} — `{p.get('url')}`")
    lines += [
        "",
        "## Perguntas humanas em aberto",
        "",
    ]
    for q in dossier.get("next_human_questions") or []:
        lines.append(f"- {q}")
    lines += [
        "",
        "---",
        "",
        "Gerado a partir de `evidence/*_latest.json`. "
        "Regenerar: `python scripts/build_discovery_dossier.py`.",
        "",
    ]
    return "\n".join(lines)


def load_latest_dossier(data_dir: Path) -> Optional[Dict[str, Any]]:
    path = evidence_dir(data_dir) / "discovery_dossier_latest.json"
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
