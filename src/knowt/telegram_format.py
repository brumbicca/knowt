"""Formatação de mensagens Telegram (HTML) — aparência tipo carta/tabela."""
from __future__ import annotations

import html
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple


_MESES = (
    "",
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
)


def escape(text: Any) -> str:
    return html.escape("" if text is None else str(text), quote=False)


def fmt_int_br(n: int | float | None) -> str:
    if n is None:
        return "n/d"
    try:
        return f"{int(n):,}".replace(",", ".")
    except (TypeError, ValueError):
        return str(n)


def _parse_tiny_date(s: str) -> Optional[Tuple[int, int, int]]:
    parts = (s or "").strip().split("/")
    if len(parts) != 3:
        return None
    try:
        d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
        return d, m, y
    except ValueError:
        return None


def human_period_span(d0: str, d1: str, *, label: str = "") -> str:
    """Ex.: 'nesta semana (de 3 a 9 de agosto de 2026)'."""
    a = _parse_tiny_date(d0)
    b = _parse_tiny_date(d1)
    if not a or not b:
        return label or f"{d0} a {d1}"
    d0i, m0, y0 = a
    d1i, m1, y1 = b
    if m0 == m1 and y0 == y1:
        span = f"de {d0i} a {d1i} de {_MESES[m0]} de {y0}"
    else:
        span = (
            f"de {d0i} de {_MESES[m0]} de {y0} a {d1i} de {_MESES[m1]} de {y1}"
        )
    lab = (label or "").strip().lower()
    if "semana" in lab:
        return f"nesta semana ({span})"
    if lab in ("hoje",):
        return f"hoje ({span})"
    if "mês" in lab or "mes" in lab:
        return f"neste mês ({span})"
    return f"no período ({span})"


def html_table(rows: Sequence[Tuple[str, str]], *, col1: str = "Indicador", col2: str = "Valor") -> str:
    """Tabela monoespaçada dentro de <pre> (Telegram HTML)."""
    w1 = max(len(col1), *(len(a) for a, _ in rows)) if rows else len(col1)
    w1 = min(max(w1, 12), 28)
    lines = [f"{col1:<{w1}}  {col2}", "─" * (w1 + 2 + max(len(col2), 8))]
    for a, b in rows:
        lines.append(f"{a:<{w1}}  {b}")
    body = "\n".join(lines)
    return f"<pre>{escape(body)}</pre>"


def format_orders_period_html(
    *,
    label: str,
    d0: str,
    d1: str,
    total_orders: int,
    situacao: Optional[str] = None,
    breakdown_lines: Optional[List[Tuple[str, str]]] = None,
) -> str:
    when = human_period_span(d0, d1, label=label)
    sit = f" (situação {situacao})" if situacao else ""
    intro = (
        f"Aqui estão os pedidos feitos até agora {escape(when)}{escape(sit)}:"
    )
    rows: List[Tuple[str, str]] = [
        ("Total de pedidos", f"{fmt_int_br(total_orders)} pedidos"),
        ("Receita", "n/d"),
        ("Margem", "n/d"),
    ]
    if breakdown_lines:
        rows.extend(breakdown_lines[:8])
    table = html_table(rows)
    footer = (
        "Receita e margem ainda não estão publicadas no knowt. "
        "Quer o detalhe por situação ou de um pedido?"
    )
    return f"{intro}\n\n{table}\n\n{escape(footer)}"


def format_orders_period_plain(
    *,
    label: str,
    d0: str,
    d1: str,
    total_orders: int,
    situacao: Optional[str] = None,
    breakdown_lines: Optional[List[Tuple[str, str]]] = None,
) -> str:
    """Versão texto (chat web) com a mesma estrutura."""
    when = human_period_span(d0, d1, label=label)
    sit = f" (situação {situacao})" if situacao else ""
    lines = [
        f"Aqui estão os pedidos feitos até agora {when}{sit}:",
        "",
        "Indicador             Valor",
        "────────────────────────────",
        f"Total de pedidos     {fmt_int_br(total_orders)} pedidos",
        "Receita              n/d",
        "Margem               n/d",
    ]
    for a, b in breakdown_lines or []:
        lines.append(f"{a:<20} {b}")
    lines += [
        "",
        "Receita e margem ainda não estão publicadas no knowt. "
        "Quer o detalhe por situação ou de um pedido?",
    ]
    return "\n".join(lines)


def format_situacao_breakdown_html(
    *,
    label: str,
    d0: str,
    d1: str,
    total_orders: int,
    breakdown_lines: List[Tuple[str, str]],
) -> str:
    when = human_period_span(d0, d1, label=label)
    intro = f"Pedidos por situação {escape(when)}:"
    rows: List[Tuple[str, str]] = [
        ("Total", f"{fmt_int_br(total_orders)} pedidos"),
    ]
    rows.extend(breakdown_lines[:12])
    table = html_table(rows, col1="Situação", col2="Pedidos")
    footer = (
        "Só contagens Tiny (sem receita/margem). "
        "Quer filtrar uma situação (ex. «cancelados esta semana») ou um pedido?"
    )
    return f"{intro}\n\n{table}\n\n{escape(footer)}"


def format_situacao_breakdown_plain(
    *,
    label: str,
    d0: str,
    d1: str,
    total_orders: int,
    breakdown_lines: List[Tuple[str, str]],
) -> str:
    when = human_period_span(d0, d1, label=label)
    lines = [
        f"Pedidos por situação {when}:",
        "",
        "Situação              Pedidos",
        "────────────────────────────",
        f"{'Total':<20} {fmt_int_br(total_orders)} pedidos",
    ]
    for a, b in breakdown_lines[:12]:
        lines.append(f"{a:<20} {b}")
    lines += [
        "",
        "Só contagens Tiny (sem receita/margem). "
        "Quer filtrar uma situação ou um pedido?",
    ]
    return "\n".join(lines)


def format_dossier_html(lines: List[str], *, title: str) -> str:
    bullets = "\n".join(f"• {escape(x.lstrip('·').strip())}" for x in lines if x.strip())
    return f"<b>{escape(title)}</b>\n\n{bullets}"


def hermes_reply_to_html(text: str) -> str:
    """Converte texto Hermes (markdown leve / tabela) para HTML Telegram."""
    raw = (text or "").strip()
    if not raw:
        return ""
    # Se já parecer HTML, não mexer
    if looks_like_html(raw):
        return raw

    lines = raw.replace("\r\n", "\n").split("\n")
    out: List[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # bloco de tabela markdown / ASCII
        if "|" in line and i + 1 < len(lines) and (
            set(lines[i + 1].strip()) <= set("-|: ")
            or ("Indicador" in line and "Valor" in line)
        ):
            block = [line]
            i += 1
            while i < len(lines) and (
                "|" in lines[i]
                or set(lines[i].strip()) <= set("-|: ─━")
                or (lines[i].strip() and "  " in lines[i] and not lines[i].startswith("Quer"))
            ):
                # para em pergunta final
                if lines[i].strip().endswith("?") and "|" not in lines[i]:
                    break
                block.append(lines[i])
                i += 1
            # limpar pipes markdown → colunas espaçadas
            cleaned: List[str] = []
            for bl in block:
                s = bl.strip()
                if set(s) <= set("-|: ─━") and len(s) >= 3:
                    continue
                if "|" in s:
                    cells = [c.strip() for c in s.strip("|").split("|")]
                    cleaned.append("  ".join(cells))
                else:
                    cleaned.append(s)
            body = "\n".join(cleaned)
            out.append(f"<pre>{escape(body)}</pre>")
            continue

        # negrito **x**
        esc = escape(line)
        esc = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", esc)
        esc = re.sub(r"`([^`]+)`", r"<code>\1</code>", esc)
        out.append(esc)
        i += 1

    return "\n".join(out).strip()


def looks_like_html(text: str) -> bool:
    t = (text or "").strip()
    return t.startswith("<") or "<pre>" in t or "<b>" in t
