#!/usr/bin/env python3
"""MCP stdio — Agent Gateway knowt (read-only bridge + agenda/tarefas).

Base: http://127.0.0.1:8766/api/bridge
Auth: KNOWT_API_TOKEN via X-Knowt-Token / Bearer
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_SRC = _ROOT / "src"
for p in (_SRC, _ROOT):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from knowt.agent_catalog import (  # noqa: E402
    agent_catalog_payload,
    is_allowed_agent_path,
    normalize_bridge_path,
)

BRIDGE = os.environ.get("KNOWT_AGENT_BRIDGE", "http://127.0.0.1:8766/api/bridge").rstrip("/")
_TOKEN = (
    os.environ.get("KNOWT_API_TOKEN")
    or os.environ.get("KNOWT_BRIDGE_TOKEN")
    or ""
).strip()
_ALLOWED_HOSTS = {"127.0.0.1", "localhost"}
_PATH_RE = re.compile(r"^/[a-zA-Z0-9_./{}-]*$")
_ALLOWED_WRITE_PATHS = frozenset({"/tarefas", "/tarefas/concluir", "/agenda/eventos"})


def _validate_bridge_url() -> None:
    parsed = urllib.parse.urlparse(BRIDGE)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"invalid bridge scheme: {parsed.scheme}")
    host = (parsed.hostname or "").lower()
    if host not in _ALLOWED_HOSTS:
        raise ValueError(f"bridge host must be localhost, got: {host}")


def _auth_headers() -> dict[str, str]:
    hdrs = {"Accept": "application/json"}
    if _TOKEN:
        hdrs["X-Knowt-Token"] = _TOKEN
        hdrs["Authorization"] = f"Bearer {_TOKEN}"
    return hdrs


def _parse_path_inputs(path: str) -> tuple[str, dict[str, str]]:
    raw = (path or "").strip()
    if not raw.startswith("/"):
        raw = "/" + raw
    parsed = urllib.parse.urlparse(raw)
    base = parsed.path.rstrip("/") or "/"
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=False)
    params = {k: v[0] for k, v in query.items() if v}
    return base, params


def _bridge_get(path: str, params: dict | None = None) -> str:
    _validate_bridge_url()
    if not path.startswith("/"):
        path = "/" + path
    if ".." in path or not _PATH_RE.match(path.split("?")[0]):
        raise ValueError(f"invalid path: {path}")

    qs = urllib.parse.urlencode({k: v for k, v in (params or {}).items() if v})
    url = f"{BRIDGE}{path}"
    if qs:
        url += "?" + qs

    req = urllib.request.Request(url, method="GET", headers=_auth_headers())
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode()
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if e.fp else str(e)
        return json.dumps({"error": f"HTTP {e.code}", "detail": err_body[:500]}, ensure_ascii=False)

    try:
        return json.dumps(json.loads(body), ensure_ascii=False, indent=2)
    except json.JSONDecodeError:
        return body


def _bridge_post(path: str, body: dict) -> str:
    _validate_bridge_url()
    if not path.startswith("/"):
        path = "/" + path
    if ".." in path or not _PATH_RE.match(path):
        raise ValueError(f"invalid path: {path}")
    if path not in _ALLOWED_WRITE_PATHS:
        raise ValueError(f"write path not allowed: {path}")

    data = json.dumps(body or {}, ensure_ascii=False).encode("utf-8")
    hdrs = _auth_headers()
    hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(
        f"{BRIDGE}{path}",
        data=data,
        method="POST",
        headers=hdrs,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if e.fp else str(e)
        return json.dumps({"error": f"HTTP {e.code}", "detail": err_body[:500]}, ensure_ascii=False)

    try:
        return json.dumps(json.loads(raw), ensure_ascii=False, indent=2)
    except json.JSONDecodeError:
        return raw


def knowt_catalog() -> str:
    """Lista consultas read-only do plugin knowt (campo path)."""
    try:
        return _bridge_get("/catalog")
    except (urllib.error.URLError, ValueError):
        return json.dumps(agent_catalog_payload(BRIDGE), ensure_ascii=False, indent=2)


def knowt_query(
    path: str,
    periodo: str = "",
    data_inicio: str = "",
    data_fim: str = "",
    dominio: str = "",
    source_id: str = "",
    status: str = "",
) -> str:
    """GET read-only no bridge knowt.

    Use **path** do knowt_catalog. 'esta semana' → periodo=semana.
    Pedidos/contagens: /vendas/periodo. Discovery: /discovery/dossier.
    Nunca inventar receita/margem.
    """
    base, path_params = _parse_path_inputs(path)
    normalized = normalize_bridge_path(base)
    if not is_allowed_agent_path(normalized):
        return json.dumps(
            {
                "error": "path_not_allowed",
                "path": path,
                "normalized": normalized,
                "message": (
                    "Path fora do plugin knowt. Chame knowt_catalog() e use um 'path' listado."
                ),
            },
            ensure_ascii=False,
            indent=2,
        )
    params: dict[str, str] = dict(path_params)
    if periodo:
        params["periodo"] = periodo
    if data_inicio:
        params["data_inicio"] = data_inicio
    if data_fim:
        params["data_fim"] = data_fim
    if dominio:
        params["dominio"] = dominio
    if source_id:
        params["source_id"] = source_id.strip().lower()
    if status:
        params["status"] = status
    return _bridge_get(normalized, params)


def knowt_action(path: str, body_json: str = "{}") -> str:
    """POST limitado (tarefas / agenda local)."""
    normalized = (path or "").strip().split("?")[0].rstrip("/") or "/"
    if not normalized.startswith("/"):
        normalized = "/" + normalized
    if normalized not in _ALLOWED_WRITE_PATHS:
        return json.dumps(
            {
                "error": "write_path_not_allowed",
                "path": path,
                "allowed": sorted(_ALLOWED_WRITE_PATHS),
            },
            ensure_ascii=False,
            indent=2,
        )
    try:
        body = json.loads(body_json or "{}")
        if not isinstance(body, dict):
            raise ValueError("body must be object")
    except (json.JSONDecodeError, ValueError) as exc:
        return json.dumps({"error": "invalid_body_json", "detail": str(exc)}, ensure_ascii=False)
    try:
        return _bridge_post(normalized, body)
    except ValueError as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)


def _run_mcp_server() -> None:
    try:
        from mcp.server.fastmcp import FastMCP
    except ImportError as exc:
        print(
            "mcp package required — use Hermes venv python:\n"
            "  /usr/local/lib/hermes-agent/venv/bin/python scripts/hermes_knowt_mcp.py",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc

    mcp = FastMCP("knowt-gateway")
    mcp.tool()(knowt_catalog)
    mcp.tool()(knowt_query)
    mcp.tool()(knowt_action)
    mcp.run(transport="stdio")


if __name__ == "__main__":
    _run_mcp_server()
