"""Testes unitários discovery_ui (sem browser)."""
from __future__ import annotations

from knowt.discovery_ui import (
    fields_from_header_value_pairs,
    match_cost_api_key,
    normalize_label,
    parse_brl_number,
)


def test_parse_brl_number():
    assert parse_brl_number("2,75") == 2.75
    assert parse_brl_number("R$ 1.234,56") == 1234.56
    assert parse_brl_number("") is None


def test_match_cost_labels():
    assert match_cost_api_key("Preço custo") == "preco_custo"
    assert match_cost_api_key("Custo médio") == "preco_custo_medio"
    assert match_cost_api_key("Preço venda") is None


def test_fields_from_pairs_partial():
    fields = fields_from_header_value_pairs(
        [
            ("A partir de", "27/08/2024"),
            ("Preço custo", "2,75"),
            ("Custo médio", "2,75"),
            ("Preço venda", "5,70"),
        ]
    )
    by = {f["api_key"]: f for f in fields}
    assert by["preco_custo"]["found"] is True
    assert by["preco_custo"]["parsed"] == 2.75
    assert by["preco_custo_medio"]["found"] is True
    assert by["preco_custo_medio"]["parsed"] == 2.75
    assert normalize_label("Custo Médio") == "custo medio"
