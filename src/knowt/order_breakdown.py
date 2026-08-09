"""Breakdown de pedidos Tiny por situação — factos só via orders.list."""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple

from knowt.situacao import BREAKDOWN_SITUACOES
from knowt.tiny_orders import count_orders_in_period

# cache em memória: chave → (expires_at, payload)
_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_CACHE_TTL_SEC = 120.0


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    row = _CACHE.get(key)
    if not row:
        return None
    expires, payload = row
    if time.time() >= expires:
        _CACHE.pop(key, None)
        return None
    return payload


def _cache_set(key: str, payload: Dict[str, Any]) -> None:
    _CACHE[key] = (time.time() + _CACHE_TTL_SEC, payload)


def breakdown_por_situacao(
    token: str,
    *,
    data_inicial: str,
    data_final: str,
    use_cache: bool = True,
) -> Dict[str, Any]:
    key = f"{data_inicial}|{data_final}"
    if use_cache:
        hit = _cache_get(key)
        if hit is not None:
            return {**hit, "cached": True}

    rows: List[Dict[str, Any]] = []

    def _one(label: str, api_val: str) -> Dict[str, Any]:
        counted = count_orders_in_period(
            token,
            data_inicial=data_inicial,
            data_final=data_final,
            situacao=api_val,
        )
        return {
            "situacao": label,
            "api": api_val,
            "ok": counted.ok,
            "total_orders": counted.total_orders if counted.ok else None,
            "reason_code": counted.reason_code,
        }

    with ThreadPoolExecutor(max_workers=min(6, len(BREAKDOWN_SITUACOES))) as pool:
        futs = {
            pool.submit(_one, label, api_val): label
            for label, api_val in BREAKDOWN_SITUACOES
        }
        by_label: Dict[str, Dict[str, Any]] = {}
        for fut in as_completed(futs):
            item = fut.result()
            by_label[item["situacao"]] = item
    for label, _api in BREAKDOWN_SITUACOES:
        rows.append(by_label[label])

    payload = {"by_situacao": rows, "cached": False}
    if use_cache:
        _cache_set(key, {"by_situacao": rows})
    return payload


def format_breakdown_short(br: Dict[str, Any], *, max_items: int = 6) -> str:
    bits: List[str] = []
    for row in br.get("by_situacao") or []:
        if not row.get("ok") or not row.get("total_orders"):
            continue
        bits.append(f"**{row['situacao']}** {row['total_orders']}")
        if len(bits) >= max_items:
            break
    return "; ".join(bits) if bits else "(sem pedidos nas situações amostradas)"


def clear_breakdown_cache() -> None:
    _CACHE.clear()
