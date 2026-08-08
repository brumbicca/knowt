from knowt.situacao import parse_situacao


def test_parse_situacao_cancelado():
    assert parse_situacao("pedidos cancelados esta semana") == (
        "cancelado",
        "cancelado",
    )


def test_parse_situacao_none():
    assert parse_situacao("pedidos esta semana") is None
