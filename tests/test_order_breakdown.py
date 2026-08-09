from unittest.mock import patch

from knowt.order_breakdown import (
    breakdown_por_situacao,
    clear_breakdown_cache,
    format_breakdown_short,
)
from knowt.tiny_orders import TinyOrdersCount


def test_breakdown_and_cache():
    clear_breakdown_cache()
    calls = {"n": 0}

    def fake_count(token, *, data_inicial, data_final, situacao=None, timeout=60.0):
        calls["n"] += 1
        n = {"aprovado": 12, "faturado": 40, "cancelado": 3}.get(situacao or "", 0)
        return TinyOrdersCount(
            ok=True,
            reason_code="OK",
            data_inicial=data_inicial,
            data_final=data_final,
            total_orders=n,
            pages_fetched=1,
            total_pages=1,
            method="single_page",
        )

    with patch("knowt.order_breakdown.count_orders_in_period", side_effect=fake_count):
        first = breakdown_por_situacao("tok", data_inicial="01/08/2026", data_final="08/08/2026")
        second = breakdown_por_situacao("tok", data_inicial="01/08/2026", data_final="08/08/2026")
    assert first["cached"] is False
    assert second["cached"] is True
    assert format_breakdown_short(first).startswith("**aprovado**")
    assert calls["n"] == len(first["by_situacao"])
