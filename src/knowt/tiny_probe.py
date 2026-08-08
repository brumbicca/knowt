"""Probe seguro da API Tiny v2 — evidência, não publicação de capability."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional

TINY_V2_ORDERS_URL = "https://api.tiny.com.br/api2/pedidos.pesquisa.php"


@dataclass
class TinyProbeResult:
    ok: bool
    http_status: Optional[int]
    tinystatus: Optional[str]
    reason_code: str
    detail: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def probe_tiny_v2_orders(api_token: str, *, timeout: float = 25.0) -> TinyProbeResult:
    """Lista mínima de pedidos (página 1) para validar token.

    Não interpreta negócio; só reachability + status Tiny.
    """
    token = (api_token or "").strip()
    if not token:
        return TinyProbeResult(
            ok=False,
            http_status=None,
            tinystatus=None,
            reason_code="SECRET_EMPTY",
            detail="token vazio",
        )

    body = urllib.parse.urlencode(
        {"token": token, "formato": "JSON", "pagina": "1"}
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
        return TinyProbeResult(
            ok=False,
            http_status=exc.code,
            tinystatus=None,
            reason_code="HTTP_ERROR",
            detail=raw[:200],
        )
    except urllib.error.URLError as exc:
        return TinyProbeResult(
            ok=False,
            http_status=None,
            tinystatus=None,
            reason_code="NETWORK_ERROR",
            detail=str(exc.reason)[:200],
        )

    tinystatus = None
    try:
        data = json.loads(raw)
        ret = data.get("retorno") if isinstance(data, dict) else None
        if isinstance(ret, dict):
            tinystatus = str(ret.get("status") or "").strip() or None
            # erros no retorno
            if ret.get("erros") or str(ret.get("codigo_erro") or ""):
                return TinyProbeResult(
                    ok=False,
                    http_status=status,
                    tinystatus=tinystatus,
                    reason_code="TINY_API_ERROR",
                    detail=str(ret.get("erros") or ret.get("codigo_erro"))[:200],
                )
        elif isinstance(data, dict):
            tinystatus = str(data.get("status") or "").strip() or None
    except json.JSONDecodeError:
        return TinyProbeResult(
            ok=False,
            http_status=status,
            tinystatus=None,
            reason_code="INVALID_JSON",
            detail=raw[:200],
        )

    ok = status == 200 and (tinystatus or "").upper() == "OK"
    return TinyProbeResult(
        ok=ok,
        http_status=status,
        tinystatus=tinystatus,
        reason_code="OK" if ok else "TINY_STATUS_NOT_OK",
        detail="reachable" if ok else (raw[:200] if not ok else "reachable"),
    )
