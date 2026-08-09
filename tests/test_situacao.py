from knowt.situacao import parse_situacao, wants_situacao_breakdown


def test_parse_situacao_cancelado():
    assert parse_situacao("pedidos cancelados esta semana") == (
        "cancelado",
        "cancelado",
    )


def test_parse_situacao_preparado_maps_to_preparando_envio():
    assert parse_situacao("pedidos preparados esta semana") == (
        "preparando envio",
        "preparando_envio",
    )
    assert parse_situacao("pedidos preparando envio")[1] == "preparando_envio"


def test_parse_situacao_pronto_para_envio():
    assert parse_situacao("pedidos prontos para envio") == (
        "pronto para envio",
        "pronto_envio",
    )


def test_parse_situacao_none():
    assert parse_situacao("pedidos esta semana") is None


def test_wants_breakdown():
    assert wants_situacao_breakdown("resumo de pedidos esta semana")
    assert wants_situacao_breakdown("pedidos por situação últimos 7 dias")
    assert not wants_situacao_breakdown("pedidos cancelados esta semana")
