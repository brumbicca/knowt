"""Tiny v2 pedido.obter — detalhe factual sem CMV/margem."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

TINY_V2_ORDER_OBTER_URL = "https://api.tiny.com.br/api2/pedido.obter.php"


@dataclass
class TinyOrderDetail:
    ok: bool
    reason_code: str
    http_status: Optional[int] = None
    tinystatus: Optional[str] = None
    order_id: Optional[str] = None
    numero: Optional[str] = None
    data_pedido: Optional[str] = None
    situacao: Optional[str] = None
    cliente_nome: Optional[str] = None
    ecommerce_numero: Optional[str] = None
    itens_count: int = 0
    item_skus: List[str] = field(default_factory=list)
    valor_total: Optional[str] = None  # string da Tiny; sem recalcular margem
    detail: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _pick_cliente_nome(ped: dict) -> Optional[str]:
    cli = ped.get("cliente")
    if isinstance(cli, dict):
        nome = cli.get("nome") or cli.get("nome_fantasia")
        if nome:
            return str(nome)
    nome = ped.get("nome_cliente") or ped.get("cliente_nome")
    return str(nome) if nome else None


def _count_itens(ped: dict) -> tuple[int, List[str]]:
    raw = ped.get("itens") or ped.get("itens_pedido") or []
    if isinstance(raw, dict):
        raw = raw.get("item") or raw.get("itens") or []
    if not isinstance(raw, list):
        return 0, []
    skus: List[str] = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        it = row.get("item") if isinstance(row.get("item"), dict) else row
        sku = it.get("codigo") or it.get("id_produto") or it.get("descricao")
        if sku is not None and len(skus) < 8:
            skus.append(str(sku)[:80])
    return len(raw), skus


def fetch_order_detail(
    api_token: str,
    order_id: str,
    *,
    timeout: float = 60.0,
) -> TinyOrderDetail:
    token = (api_token or "").strip()
    oid = (order_id or "").strip()
    if not token:
        return TinyOrderDetail(ok=False, reason_code="SECRET_EMPTY", order_id=oid or None)
    if not oid:
        return TinyOrderDetail(ok=False, reason_code="ORDER_ID_EMPTY")

    payload = {"token": token, "formato": "JSON", "id": oid}
    body = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(
        TINY_V2_ORDER_OBTER_URL,
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
        return TinyOrderDetail(
            ok=False,
            reason_code="HTTP_ERROR",
            http_status=exc.code,
            order_id=oid,
            detail=raw[:200],
        )
    except (urllib.error.URLError, TimeoutError) as exc:
        return TinyOrderDetail(
            ok=False,
            reason_code="NETWORK_ERROR",
            order_id=oid,
            detail=str(exc)[:200],
        )

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return TinyOrderDetail(
            ok=False,
            reason_code="INVALID_JSON",
            http_status=status,
            order_id=oid,
            detail=raw[:200],
        )

    ret = data.get("retorno") if isinstance(data, dict) else None
    if not isinstance(ret, dict):
        return TinyOrderDetail(
            ok=False,
            reason_code="NO_RETORNO",
            http_status=status,
            order_id=oid,
            detail=raw[:200],
        )

    tinystatus = str(ret.get("status") or "").strip()
    if ret.get("erros") or ret.get("codigo_erro"):
        return TinyOrderDetail(
            ok=False,
            reason_code="TINY_API_ERROR",
            http_status=status,
            tinystatus=tinystatus or None,
            order_id=oid,
            detail=str(ret.get("erros") or ret.get("codigo_erro"))[:200],
        )

    ped = ret.get("pedido")
    if not isinstance(ped, dict):
        return TinyOrderDetail(
            ok=False,
            reason_code="NO_PEDIDO",
            http_status=status,
            tinystatus=tinystatus or None,
            order_id=oid,
            detail=raw[:200],
        )

    itens_n, skus = _count_itens(ped)
    valor = ped.get("total_pedido") or ped.get("valor") or ped.get("total")
    return TinyOrderDetail(
        ok=True,
        reason_code="OK",
        http_status=status,
        tinystatus=tinystatus or "OK",
        order_id=str(ped.get("id") or oid),
        numero=str(ped.get("numero")) if ped.get("numero") is not None else None,
        data_pedido=str(ped.get("data_pedido") or ped.get("data") or "") or None,
        situacao=str(ped.get("situacao") or "") or None,
        cliente_nome=_pick_cliente_nome(ped),
        ecommerce_numero=(
            str(ped.get("numero_ecommerce") or ped.get("ecommerce") or "") or None
        ),
        itens_count=itens_n,
        item_skus=skus,
        valor_total=str(valor) if valor is not None else None,
        detail="obter_ok",
    )
