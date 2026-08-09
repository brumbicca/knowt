from unittest.mock import patch

from knowt.tiny_orders import TinyOrdersPage, count_orders_in_period, fetch_orders_page


def _page(*, page: int, total_pages: int, order_count: int, ids=None):
    ids = ids or [str(i) for i in range(order_count)]
    return TinyOrdersPage(
        ok=True,
        reason_code="OK",
        http_status=200,
        tinystatus="OK",
        page=page,
        total_pages=total_pages,
        order_count=order_count,
        order_ids=ids[:50],
        detail="page_ok",
    )


def test_count_single_page():
    with patch(
        "knowt.tiny_orders.fetch_orders_page",
        return_value=_page(page=1, total_pages=1, order_count=7, ids=["a"]),
    ):
        c = count_orders_in_period("tok", data_inicial="08/08/2026", data_final="08/08/2026")
    assert c.ok
    assert c.total_orders == 7
    assert c.pages_fetched == 1
    assert c.method == "single_page"


def test_count_page_bounds():
    def fake(token, *, page, data_inicial, data_final, situacao=None, timeout=60.0):
        if page == 1:
            return _page(page=1, total_pages=33, order_count=100)
        if page == 33:
            return _page(page=33, total_pages=33, order_count=34, ids=["z"])
        raise AssertionError(f"não deve pedir página {page}")

    with patch("knowt.tiny_orders.fetch_orders_page", side_effect=fake):
        c = count_orders_in_period("tok", data_inicial="03/08/2026", data_final="08/08/2026")
    assert c.ok
    assert c.total_orders == 32 * 100 + 34
    assert c.pages_fetched == 2
    assert c.method == "page_bounds"
    assert c.truncated is False


def test_count_rejects_inconsistent_last_page():
    def fake(token, *, page, data_inicial, data_final, situacao=None, timeout=60.0):
        if page == 1:
            return _page(page=1, total_pages=3, order_count=50)
        return _page(page=3, total_pages=3, order_count=80)

    with patch("knowt.tiny_orders.fetch_orders_page", side_effect=fake):
        c = count_orders_in_period("tok", data_inicial="01/08/2026", data_final="08/08/2026")
    assert not c.ok
    assert c.reason_code == "INCONSISTENT_PAGINATION"


def test_fetch_empty_consulta_is_zero_ok():
    empty = {
        "retorno": {
            "status_processamento": 2,
            "status": "Erro",
            "codigo_erro": 20,
            "erros": [{"erro": "A Consulta não retornou registros"}],
        }
    }

    class _Resp:
        status = 200

        def read(self):
            import json

            return json.dumps(empty).encode()

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    with patch("knowt.tiny_orders.urllib.request.urlopen", return_value=_Resp()):
        page = fetch_orders_page("tok", page=1, situacao="preparado")
    assert page.ok
    assert page.order_count == 0
    assert page.detail == "empty_consulta"
