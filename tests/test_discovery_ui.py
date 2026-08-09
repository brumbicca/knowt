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


def test_parse_cost_pairs_from_body_text():
    from knowt.discovery_ui import parse_cost_pairs_from_body_text

    # Forma "compacta" (uma linha de valores)
    body = (
        "custos\n"
        "A partir de\tSaldo atual\tSaldo anterior\tImpostos recuperáveis\t"
        "Preço custo\tCusto médio\tPreço venda\n"
        "27/08/2024\t32,00\t32,00\t0,00\t2,75\t2,75\t5,70\n"
    )
    pairs = parse_cost_pairs_from_body_text(body)
    fields = fields_from_header_value_pairs(pairs)
    by = {f["api_key"]: f for f in fields}
    assert by["preco_custo"]["parsed"] == 2.75
    assert by["preco_custo_medio"]["parsed"] == 2.75


def test_clean_texts_and_targets():
    from knowt.discovery_ui import MARGIN_REPORT_TARGETS, TINY_SYSTEM_TARGETS, _clean_texts

    assert len(TINY_SYSTEM_TARGETS) >= 6
    keys = {t["key"] for t in TINY_SYSTEM_TARGETS}
    assert "pedidos_venda" in keys
    assert "produtos" in keys
    assert {t["key"] for t in MARGIN_REPORT_TARGETS} == {
        "avaliacao_margem",
        "margem_contribuicao",
    }
    cleaned = _clean_texts(["  Vendas  ", "Vendas", "x", "Pedidos de venda"])
    assert cleaned == ["Vendas", "Pedidos de venda"]
