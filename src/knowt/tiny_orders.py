"""Leitura Tiny v2 pedidos.pesquisa — contratos mínimos, sem CMV/margem."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

TINY_V2_ORDERS_URL = "https://api.tiny.com.br/api2/pedidos.pesquisa.php"


@dataclass
class TinyOrdersPage:
    ok: bool
    reason_code: str
    http_status: Optional[int] = None
    tinystatus: Optional[str] = None
    page: Optional[int] = None
    total_pages: Optional[int] = None
    order_count: int = 0
    order_ids: List[str] = field(default_factory=list)
    detail: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def fetch_orders_page(
    api_token: str,
    *,
    page: int = 1,
    timeout: float = 60.0,
) -> TinyOrdersPage:
    token = (api_token or "").strip()
    if not token:
        return TinyOrdersPage(ok=False, reason_code="SECRET_EMPTY")

    body = urllib.parse.urlencode(
        {
            "token": token,
            "formato": "JSON",
            "pagina": str(max(1, int(page))),
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        TINY_V2_ORDERS_URL,
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            status = int(getattr(resp, "status", 200) or 200)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        return TinyOrdersPage(
            ok=False,
            reason_code="HTTP_ERROR",
            http_status=exc.code,
            detail=raw[:200],
        )
    except (urllib.error.URLError, TimeoutError) as exc:
        return TinyOrdersPage(
            ok=False,
            reason_code="NETWORK_ERROR",
            detail=str(exc)[:200],
        )

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return TinyOrdersPage(
            ok=False,
            reason_code="INVALID_JSON",
            http_status=status,
            detail=raw[:200],
        )

    ret = data.get("retorno") if isinstance(data, dict) else None
    if not isinstance(ret, dict):
        return TinyOrdersPage(
            ok=False,
            reason_code="NO_RETORNO",
            http_status=status,
            detail=raw[:200],
        )

    tinystatus = str(ret.get("status") or "").strip()
    if ret.get("erros") or ret.get("codigo_erro"):
        return TinyOrdersPage(
            ok=False,
            reason_code="TINY_API_ERROR",
            http_status=status,
            tinystatus=tinystatus or None,
            detail=str(ret.get("erros") or ret.get("codigo_erro"))[:200],
        )
    if tinystatus.upper() != "OK":
        return TinyOrdersPage(
            ok=False,
            reason_code="TINY_STATUS_NOT_OK",
            http_status=status,
            tinystatus=tinystatus or None,
            detail=raw[:200],
        )

    pedidos = ret.get("pedidos") or []
    if pedidos is None:
        pedidos = []
    if not isinstance(pedidos, list):
        return TinyOrdersPage(
            ok=False,
            reason_code="UNEXPECTED_SHAPE",
            http_status=status,
            tinystatus=tinystatus,
            detail="pedidos não é lista",
        )

    ids: List[str] = []
    for row in pedidos:
        if not isinstance(row, dict):
            continue
        ped = row.get("pedido") if isinstance(row.get("pedido"), dict) else row
        oid = ped.get("id") or ped.get("id_pedido") or ped.get("numero")
        if oid is not None:
            ids.append(str(oid))

    pagina = ret.get("pagina")
    num_paginas = ret.get("numero_paginas")
    try:
        page_i = int(pagina) if pagina is not None else int(page)
    except (TypeError, ValueError):
        page_i = int(page)
    try:
        total_i = int(num_paginas) if num_paginas is not None else None
    except (TypeError, ValueError):
        total_i = None

    return TinyOrdersPage(
        ok=True,
        reason_code="OK",
        http_status=status,
        tinystatus=tinystatus,
        page=page_i,
        total_pages=total_i,
        order_count=len(ids),
        order_ids=ids[:50],
        detail="page_ok",
    )
