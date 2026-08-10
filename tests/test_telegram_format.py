"""Formatação visual das mensagens Telegram."""
from __future__ import annotations

from knowt.telegram_format import (
    format_orders_period_html,
    format_orders_period_plain,
    hermes_reply_to_html,
    human_period_span,
)


def test_human_period_semana():
    assert "nesta semana" in human_period_span(
        "03/08/2026", "09/08/2026", label="esta semana"
    )
    assert "agosto" in human_period_span("03/08/2026", "09/08/2026", label="esta semana")


def test_orders_period_html_table():
    html = format_orders_period_html(
        label="esta semana",
        d0="03/08/2026",
        d1="09/08/2026",
        total_orders=42,
    )
    assert "<pre>" in html
    assert "Total de pedidos" in html
    assert "42 pedidos" in html
    assert "Receita" in html
    assert "n/d" in html
    assert "Margem" in html


def test_orders_period_plain_structure():
    plain = format_orders_period_plain(
        label="esta semana",
        d0="03/08/2026",
        d1="09/08/2026",
        total_orders=10,
    )
    assert "Indicador" in plain
    assert "Total de pedidos" in plain
    assert "10 pedidos" in plain


def test_hermes_reply_to_html_table():
    raw = (
        "Resultado da semana:\n\n"
        "Indicador | Valor\n"
        "---|---\n"
        "Pedidos | 100\n"
        "Receita | n/d\n\n"
        "São **100** pedidos. Quer detalhe?"
    )
    html = hermes_reply_to_html(raw)
    assert "<pre>" in html
    assert "Pedidos" in html
    assert "<b>100</b>" in html


def test_situacao_breakdown_html():
    from knowt.telegram_format import format_situacao_breakdown_html

    html = format_situacao_breakdown_html(
        label="esta semana",
        d0="03/08/2026",
        d1="09/08/2026",
        total_orders=100,
        breakdown_lines=[("entregue", "80 pedidos"), ("cancelado", "5 pedidos")],
    )
    assert "Pedidos por situação" in html
    assert "Situação" in html
    assert "entregue" in html
    assert "<pre>" in html
