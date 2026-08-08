"""Respostas determinísticas pós-enforcement (sem LLM no MVP)."""
from __future__ import annotations

from typing import Any, Dict, Optional

from knowt.enforcement import EnforcementResult, enforce
from knowt.order_id import extract_order_id
from knowt.period import parse_period
from knowt.situacao import parse_situacao
from knowt.sources import SourceRegistry
from knowt.tiny_order_detail import fetch_order_detail
from knowt.tiny_orders import count_orders_in_period, fetch_orders_page
from knowt.vault import resolve_secret


def _token_for(registry: SourceRegistry, source_id: str) -> str:
    src = registry.get(source_id)
    ref = (src.secret_refs or {}).get("api_token") if src else None
    return resolve_secret(ref or "KNOWT_SECRET_TINY_TOKEN", required=True)


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

    if enf.mode == "catalog":
        out["answer"] = enf.message
        return out

    if enf.capability_id == "orders.detail" and enf.mode in ("fact", "estimate"):
        oid = extract_order_id(message)
        if not oid:
            out["answer"] = (
                "Para detalhe preciso do id Tiny do pedido "
                "(ex.: «pedido 752095868»)."
            )
            return out
        token = _token_for(registry, source_id)
        detail = fetch_order_detail(token, oid)
        out["data"] = detail.to_dict()
        if not detail.ok:
            out["answer"] = (
                f"Não consegui obter o pedido `{oid}` na Tiny "
                f"({detail.reason_code}). Não invento dados."
            )
            return out
        skus = ", ".join(detail.item_skus) if detail.item_skus else "(sem sku na amostra)"
        valor = (
            f" Total Tiny: **{detail.valor_total}**."
            if detail.valor_total is not None
            else ""
        )
        out["answer"] = (
            f"Fonte `{source_id}` · `orders.detail` ({enf.mode}). "
            f"Pedido id `{detail.order_id}`"
            + (f" nº {detail.numero}" if detail.numero else "")
            + f": situação **{detail.situacao or '—'}**, "
            f"data {detail.data_pedido or '—'}, "
            f"cliente {detail.cliente_nome or '—'}, "
            f"{detail.itens_count} item(ns) (skus: {skus})."
            f"{valor} "
            "Valor é o da Tiny; sem CMV/margem recalculada pelo knowt."
        )
        return out

    if enf.capability_id == "orders.list" and enf.mode in ("fact", "estimate"):
        token = _token_for(registry, source_id)
        period = parse_period(message)
        sit = parse_situacao(message)
        sit_label: Optional[str] = sit[0] if sit else None
        sit_api: Optional[str] = sit[1] if sit else None
        sit_txt = f" · situação **{sit_label}**" if sit_label else ""

        if period:
            d0, d1 = period.tiny_bounds()
            counted = count_orders_in_period(
                token,
                data_inicial=d0,
                data_final=d1,
                situacao=sit_api,
            )
            out["data"] = {
                "period": period.label,
                "situacao": sit_label,
                **counted.to_dict(),
            }
            if not counted.ok:
                out["answer"] = (
                    f"Não consegui contar pedidos na Tiny para {period.label}"
                    f"{sit_txt} ({counted.reason_code}). Não invento números."
                )
                return out
            how = (
                "1ª+última página Tiny"
                if counted.method == "page_bounds"
                else "página única"
            )
            out["answer"] = (
                f"Fonte `{source_id}` · `orders.list` ({enf.mode}) · período "
                f"**{period.label}** ({d0} a {d1}){sit_txt}: "
                f"**{counted.total_orders}** pedido(s) "
                f"({how}; {counted.total_pages} página(s) no intervalo). "
                "Sem valor/margem. Para um pedido: «pedido 752095868»."
            )
            return out

        page = fetch_orders_page(token, page=1, situacao=sit_api)
        out["data"] = {"situacao": sit_label, **page.to_dict()}
        if not page.ok:
            out["answer"] = (
                f"Não consegui ler pedidos na Tiny ({page.reason_code}). "
                "Não invento números."
            )
            return out
        ids_preview = (
            ", ".join(page.order_ids[:5]) if page.order_ids else "(nenhum nesta página)"
        )
        out["answer"] = (
            f"Fonte `{source_id}` · capability `orders.list` ({enf.mode})"
            f"{sit_txt}. "
            f"Página {page.page} de {page.total_pages}: "
            f"{page.order_count} pedido(s) nesta página. "
            f"Ids (amostra): {ids_preview}. "
            "Sem valor/margem — só o que a API de listagem confirmou. "
            "Pode perguntar por período (ex.: pedidos cancelados esta semana) "
            "ou «pedido 752095868»."
        )
        return out

    out["answer"] = (
        enf.message
        + " Ainda não há resposta determinística para esta capability no MVP."
    )
    return out
