"""Testes unitários do guião demo (sem rede)."""
from __future__ import annotations

from knowt.guiao_demo import (
    check_catalog,
    check_discovery,
    check_pedidos_recon,
    check_receita_blocked,
    check_situacao,
    extract_pedidos_count,
)


def test_extract_pedidos_count():
    assert extract_pedidos_count("Há **42** pedidos esta semana.") == 42
    assert extract_pedidos_count("Foram 1.234 pedidos no período.") == 1234
    assert extract_pedidos_count("sem números úteis") is None


def test_check_pedidos_recon_ok():
    assert check_pedidos_recon("Há 10 pedidos esta semana.", 10) == []
    assert "pedidos_mismatch" in check_pedidos_recon("Há 10 pedidos esta semana.", 11)[0]


def test_check_receita_blocked():
    errs = check_receita_blocked(
        "A capacidade `sales.summary` ainda não está publicada como live.",
        {"reason_code": "CAPABILITY_UNAVAILABLE", "mode": "refuse"},
    )
    assert errs == []
    bad = check_receita_blocked("Receita R$ 1000", {"reason_code": "OK", "mode": "fact"})
    assert "receita_invented_brl" in bad


def test_check_discovery():
    assert (
        check_discovery(
            "Dossiê discovery do Tiny com evidências suficientes para leitura.",
            {"reason_code": "DISCOVERY_OBSERVATION", "capability_id": "discovery.dossier"},
        )
        == []
    )


def test_check_catalog_and_situacao():
    assert check_catalog("orders.list live · vendas unavailable", {"mode": "catalog", "reason_code": "CATALOG"}) == []
    assert check_situacao(
        "Situação | Pedidos\nAberto | 3 pedidos",
        {"capability_id": "orders.list"},
        "",
    ) == []
