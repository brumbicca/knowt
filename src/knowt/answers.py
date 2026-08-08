"""Respostas determinísticas pós-enforcement (sem LLM no MVP)."""
from __future__ import annotations

from typing import Any, Dict

from knowt.enforcement import EnforcementResult, enforce
from knowt.sources import SourceRegistry
from knowt.tiny_orders import fetch_orders_page
from knowt.vault import resolve_secret


def answer_chat(
    registry: SourceRegistry,
    *,
    message: str,
    source_id: str = "tinyerp",
) -> Dict[str, Any]:
    enf: EnforcementResult = enforce(registry, message=message, source_id=source_id)
    out: Dict[str, Any] = {"enforcement": enf.to_dict(), "answer": None, "data": None}

    if enf.mode == "refuse":
        out["answer"] = enf.message
        return out

    if enf.capability_id == "orders.list" and enf.mode in ("fact", "estimate"):
        src = registry.get(source_id)
        ref = (src.secret_refs or {}).get("api_token") if src else None
        token = resolve_secret(ref or "KNOWT_SECRET_TINY_TOKEN", required=True)
        page = fetch_orders_page(token, page=1)
        out["data"] = page.to_dict()
        if not page.ok:
            out["answer"] = (
                f"Não consegui ler pedidos na Tiny ({page.reason_code}). "
                "Não invento números."
            )
            return out
        ids_preview = ", ".join(page.order_ids[:5]) if page.order_ids else "(nenhum nesta página)"
        out["answer"] = (
            f"Fonte `{source_id}` · capability `orders.list` ({enf.mode}). "
            f"Página {page.page} de {page.total_pages}: "
            f"{page.order_count} pedido(s) nesta página. "
            f"Ids (amostra): {ids_preview}. "
            "Sem valor/margem — só o que a API de listagem confirmou."
        )
        return out

    if enf.mode == "catalog":
        out["answer"] = enf.message
        return out

    out["answer"] = (
        enf.message
        + " Ainda não há resposta determinística para esta capability no MVP."
    )
    return out
