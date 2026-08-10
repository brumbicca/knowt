"""Respostas determinísticas pós-enforcement (sem LLM no MVP)."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from knowt.chat_actions import try_chat_action
from knowt.discovery_dossier import (
    load_latest_dossier,
    persist_discovery_dossier,
    render_dossier_chat,
)
from knowt.enforcement import EnforcementResult, enforce, wants_discovery_dossier
from knowt.order_id import extract_order_id
from knowt.order_breakdown import breakdown_por_situacao, format_breakdown_short
from knowt.period import parse_period, period_esta_semana
from knowt.situacao import parse_situacao, wants_situacao_breakdown
from knowt.sources import SourceRegistry
from knowt.telegram_format import (
    format_dossier_html,
    format_orders_period_html,
    format_orders_period_plain,
    format_situacao_breakdown_html,
    format_situacao_breakdown_plain,
)
from knowt.tiny_order_detail import fetch_order_detail
from knowt.tiny_orders import count_orders_in_period, fetch_orders_page
from knowt.vault import resolve_secret


def _token_for(registry: SourceRegistry, source_id: str) -> str:
    src = registry.get(source_id)
    ref = (src.secret_refs or {}).get("api_token") if src else None
    return resolve_secret(ref or "KNOWT_SECRET_TINY_TOKEN", required=True)


def _format_previews(previews: List[Dict[str, Any]], *, limit: int = 5) -> str:
    parts: List[str] = []
    for row in (previews or [])[:limit]:
        oid = row.get("id") or "?"
        bits = [f"`{oid}`"]
        if row.get("numero"):
            bits.append(f"nº {row['numero']}")
        if row.get("situacao"):
            bits.append(str(row["situacao"]))
        if row.get("data_pedido"):
            bits.append(str(row["data_pedido"]))
        parts.append(" · ".join(bits))
    return "; ".join(parts) if parts else "(nenhum nesta página)"


def answer_chat(
    registry: SourceRegistry,
    *,
    message: str,
    source_id: str = "tinyerp",
    data_dir: Path | str | None = None,
    tone: str = "default",
) -> Dict[str, Any]:
    casual = (tone or "").strip().lower() in ("casual", "telegram", "human")
    if data_dir is not None:
        action = try_chat_action(Path(data_dir), message)
        if action is not None:
            return action

    if data_dir is not None and wants_discovery_dossier(message):
        root = Path(data_dir)
        dossier = load_latest_dossier(root) or persist_discovery_dossier(root)
        plain = render_dossier_chat(dossier, tone=tone)
        out_disc: Dict[str, Any] = {
            "enforcement": {
                "allow_llm": False,
                "mode": "fact",
                "message": "discovery observation",
                "capability_id": "discovery.dossier",
                "reason_code": "DISCOVERY_OBSERVATION",
                "source_id": source_id,
            },
            "answer": plain,
            "data": {
                "summary": dossier.get("summary"),
                "blocked_for_publish": dossier.get("blocked_for_publish"),
                "path": dossier.get("path"),
            },
        }
        if casual:
            # linhas do corpo sem o título
            body_lines = [
                ln
                for ln in plain.splitlines()[1:]
                if ln.strip() and not ln.startswith("Exemplos:")
            ]
            out_disc["answer_html"] = format_dossier_html(
                body_lines,
                title="O que já conhecemos do Tiny",
            )
        return out_disc

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
        ecom = (
            f" ecommerce **{detail.ecommerce_numero}**,"
            if detail.ecommerce_numero
            else ""
        )
        if casual:
            itens_bit = f"{detail.itens_count} item(ns)"
            if detail.item_skus:
                itens_bit += f" ({skus})"
            out["answer"] = (
                f"Pedido {detail.numero or detail.order_id}: "
                f"situação {detail.situacao or '—'}, "
                f"data {detail.data_pedido or '—'}, "
                f"cliente {detail.cliente_nome or '—'}."
                f"{ecom} {itens_bit}."
                f"{valor} "
                "Ainda sem margem recalculada no knowt."
            )
        else:
            out["answer"] = (
                f"Fonte `{source_id}` · `orders.detail` ({enf.mode}). "
                f"Pedido id `{detail.order_id}`"
                + (f" nº {detail.numero}" if detail.numero else "")
                + f": situação **{detail.situacao or '—'}**, "
                f"data {detail.data_pedido or '—'}, "
                f"cliente {detail.cliente_nome or '—'},"
                f"{ecom} "
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
        sit_txt = (
            f" · situação {sit_label}"
            if sit_label and casual
            else (f" · situação **{sit_label}**" if sit_label else "")
        )
        want_break = wants_situacao_breakdown(message) and not sit_api
        # Follow-up «por situação» sem período → semana corrente
        if want_break and period is None:
            period = period_esta_semana()

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
                "contagem pela 1ª e última página"
                if counted.method == "page_bounds"
                else "página única"
            )
            sample = (
                ", ".join(f"`{x}`" for x in counted.sample_ids[:5])
                if counted.sample_ids
                else ""
            )
            sample_txt = f" Amostra de ids: {sample}." if sample else ""

            if want_break:
                br = breakdown_por_situacao(token, data_inicial=d0, data_final=d1)
                out["data"]["breakdown"] = br
                br_txt = format_breakdown_short(br, max_items=10)
                fails = [
                    f"{row['situacao']} (falhou: {row['reason_code']})"
                    for row in br.get("by_situacao") or []
                    if not row.get("ok")
                ]
                if fails:
                    br_txt = f"{br_txt}; " + "; ".join(fails) if br_txt else "; ".join(fails)
                br_rows: List[Tuple[str, str]] = []
                for row in br.get("by_situacao") or []:
                    if not row.get("ok"):
                        continue
                    n = int(row.get("total_orders") or 0)
                    if n <= 0:
                        continue
                    br_rows.append(
                        (
                            str(row.get("situacao") or "—"),
                            f"{n:,}".replace(",", ".") + " pedidos",
                        )
                    )
                if casual:
                    out["answer"] = format_situacao_breakdown_plain(
                        label=period.label,
                        d0=d0,
                        d1=d1,
                        total_orders=int(counted.total_orders or 0),
                        breakdown_lines=br_rows or [("—", "0 pedidos")],
                    )
                    out["answer_html"] = format_situacao_breakdown_html(
                        label=period.label,
                        d0=d0,
                        d1=d1,
                        total_orders=int(counted.total_orders or 0),
                        breakdown_lines=br_rows or [("—", "0 pedidos")],
                    )
                else:
                    out["answer"] = (
                        f"Fonte `{source_id}` · `orders.list` ({enf.mode}) · período "
                        f"**{period.label}** ({d0} a {d1}): "
                        f"**{counted.total_orders}** pedido(s) no total "
                        f"({how}; {counted.total_pages} página(s)). "
                        f"Por situação: {br_txt}. "
                        "Contagens por filtro Tiny (não inventamos receita/margem). "
                        "Detalhe: «pedido <id>»."
                    )
                return out

            if casual:
                out["answer"] = format_orders_period_plain(
                    label=period.label,
                    d0=d0,
                    d1=d1,
                    total_orders=int(counted.total_orders or 0),
                    situacao=sit_label,
                )
                out["answer_html"] = format_orders_period_html(
                    label=period.label,
                    d0=d0,
                    d1=d1,
                    total_orders=int(counted.total_orders or 0),
                    situacao=sit_label,
                )
            else:
                out["answer"] = (
                    f"Fonte `{source_id}` · `orders.list` ({enf.mode}) · período "
                    f"**{period.label}** ({d0} a {d1}){sit_txt}: "
                    f"**{counted.total_orders}** pedido(s) "
                    f"({how}; {counted.total_pages} página(s) no intervalo)."
                    f"{sample_txt} "
                    "Sem valor/margem. Experimente «resumo de pedidos esta semana» "
                    "ou «pedido 752095868»."
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
        preview_txt = _format_previews(page.order_previews)
        if preview_txt == "(nenhum nesta página)" and page.order_ids:
            preview_txt = ", ".join(page.order_ids[:5])
        if casual:
            out["answer"] = (
                f"Pedidos na Tiny{sit_txt}: "
                f"página {page.page} de {page.total_pages}, "
                f"{page.order_count} nesta página.\n"
                f"Amostra: {preview_txt}.\n"
                "Ainda sem valor/margem. Experimenta pedir por período "
                "(ex.: pedidos esta semana) ou «pedido <id>»."
            )
        else:
            out["answer"] = (
                f"Fonte `{source_id}` · capability `orders.list` ({enf.mode})"
                f"{sit_txt}. "
                f"Página {page.page} de {page.total_pages}: "
                f"{page.order_count} pedido(s) nesta página. "
                f"Amostra: {preview_txt}. "
                "Sem valor/margem — só o que a API de listagem confirmou. "
                "Pode perguntar por período (ex.: pedidos cancelados esta semana), "
                "«resumo de pedidos esta semana» ou «pedido 752095868»."
            )
        return out

    out["answer"] = (
        enf.message
        + " Ainda não há resposta determinística para esta capability no MVP."
    )
    return out
