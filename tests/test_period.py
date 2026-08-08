from datetime import date
from unittest.mock import patch

from knowt.period import Period, parse_period, today_br


def test_parse_hoje():
    with patch("knowt.period.today_br", return_value=date(2026, 8, 8)):
        p = parse_period("quantos pedidos hoje?")
    assert p is not None
    assert p.label == "hoje"
    assert p.tiny_bounds() == ("08/08/2026", "08/08/2026")


def test_parse_esta_semana_segunda():
    # sábado 8/8/2026 -> semana começa 3/8
    with patch("knowt.period.today_br", return_value=date(2026, 8, 8)):
        p = parse_period("pedidos desta semana")
    assert p is not None
    assert p.start == date(2026, 8, 3)
    assert p.end == date(2026, 8, 8)


def test_parse_range():
    p = parse_period("pedidos de 01/08/2026 a 05/08/2026")
    assert p == Period(date(2026, 8, 1), date(2026, 8, 5), "01/08/2026 a 05/08/2026")
