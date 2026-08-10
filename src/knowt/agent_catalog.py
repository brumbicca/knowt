"""Catálogo read-only do Agent Gateway knowt (Hermes MCP)."""
from __future__ import annotations

AGENT_GATEWAY_VERSION = "0.1.0"

DEFAULTS = {
    "fonte_principal": "Tiny ERP / Olist (piloto)",
    "source_id_default": "tinyerp",
    "timezone": "America/Sao_Paulo",
    "periodo_aliases": "hoje, ontem, semana, mes, 7d, 30d",
    "semana_regra": (
        "'esta semana' = periodo=semana (segunda até hoje). "
        "'últimos 7 dias' = periodo=7d."
    ),
    "vendas_nota": (
        "orders.list está live (contagem de pedidos). "
        "Receita/margem (sales.summary / margins.summary) ainda unavailable — "
        "nunca inventar R$."
    ),
}

BRIDGE_PATH_ALIASES: dict[str, str] = {
    "/dashboard/stats/period": "/vendas/periodo",
    "/dashboard/dashboard-pedidos": "/vendas/dashboard-completo",
}

CatalogEntry = dict

CATALOG: list[CatalogEntry] = [
    {
        "id": "health",
        "domain": "sistema",
        "bridge_path": "/health",
        "bridge_status": "live",
        "method": "GET",
        "description_pt": "Verifica se o bridge knowt está no ar.",
        "exemplos": ["O bridge está vivo?"],
    },
    {
        "id": "catalog",
        "domain": "sistema",
        "bridge_path": "/catalog",
        "bridge_status": "live",
        "method": "GET",
        "description_pt": "Lista consultas read-only disponíveis (este endpoint).",
        "exemplos": ["O que podes consultar?", "catálogo"],
    },
    {
        "id": "organizacoes",
        "domain": "sistema",
        "bridge_path": "/organizacoes",
        "bridge_status": "live",
        "method": "GET",
        "description_pt": "Lista organizações (tenancy). Piloto: uma org default.",
        "exemplos": ["Que organizações existem?"],
    },
    {
        "id": "fontes",
        "domain": "sistema",
        "bridge_path": "/fontes",
        "bridge_status": "live",
        "method": "GET",
        "description_pt": "Fontes registadas (piloto: Tiny ERP).",
        "exemplos": ["Que fontes estão ligadas?"],
    },
    {
        "id": "vendas_periodo",
        "domain": "pedidos",
        "bridge_path": "/vendas/periodo",
        "bridge_status": "live",
        "method": "GET",
        "query_params": ["periodo", "data_inicio", "data_fim", "source_id"],
        "description_pt": (
            "Contagem de pedidos Tiny no período. "
            "'Esta semana' → periodo=semana. Sem receita/margem publicada."
        ),
        "exemplos": [
            "Pedidos esta semana",
            "Quantos pedidos no mês?",
        ],
    },
    {
        "id": "pedidos_metricas",
        "domain": "pedidos",
        "bridge_path": "/pedidos/metricas",
        "bridge_status": "live",
        "method": "GET",
        "query_params": ["periodo", "data_inicio", "data_fim"],
        "description_pt": "Métricas de pedidos no período (contagens; sem inventar R$).",
        "exemplos": ["Métricas de pedidos da semana"],
    },
    {
        "id": "dashboard_completo",
        "domain": "pedidos",
        "bridge_path": "/vendas/dashboard-completo",
        "bridge_status": "live",
        "method": "GET",
        "query_params": ["periodo"],
        "description_pt": "Painel resumido de pedidos para o período.",
        "exemplos": ["Resumo do dashboard esta semana"],
    },
    {
        "id": "margens_periodo",
        "domain": "margem",
        "bridge_path": "/margens/periodo",
        "bridge_status": "live",
        "method": "GET",
        "query_params": ["periodo"],
        "description_pt": (
            "Endpoint de margens — hoje responde unavailable até CMV/aprovação. "
            "Não inventar margem."
        ),
        "exemplos": ["Margem esta semana"],
    },
    {
        "id": "insights_resumo",
        "domain": "insights",
        "bridge_path": "/insights/resumo",
        "bridge_status": "live",
        "method": "GET",
        "query_params": ["periodo", "dominio"],
        "description_pt": "Insight textual do piloto (pedidos). Usar campo texto.",
        "exemplos": ["O que destaco esta semana?"],
    },
    {
        "id": "discovery_dossier",
        "domain": "discovery",
        "bridge_path": "/discovery/dossier",
        "bridge_status": "live",
        "method": "GET",
        "description_pt": "Dossiê do que já conhecemos do Tiny (observação, sem publish).",
        "exemplos": [
            "O que já conhecemos do Tiny?",
            "Dossiê de discovery",
        ],
    },
    {
        "id": "fonte_status",
        "domain": "sistema",
        "bridge_path": "/fonte/status",
        "bridge_status": "live",
        "method": "GET",
        "query_params": ["source_id"],
        "description_pt": "Status da fonte Tiny (capabilities, gates).",
        "exemplos": ["Status da fonte Tiny"],
    },
    {
        "id": "sales_probe_latest",
        "domain": "discovery",
        "bridge_path": "/sales/probe/latest",
        "bridge_status": "live",
        "method": "GET",
        "description_pt": "Último probe de sales (evidência; não implica publish).",
        "exemplos": ["Último probe de vendas"],
    },
    {
        "id": "agenda_periodo",
        "domain": "agenda",
        "bridge_path": "/agenda/periodo",
        "bridge_status": "live",
        "method": "GET",
        "query_params": ["periodo"],
        "description_pt": "Agenda do knowt no período (local + Google se OAuth ligado).",
        "exemplos": ["Agenda desta semana"],
    },
    {
        "id": "tarefas",
        "domain": "tarefas",
        "bridge_path": "/tarefas",
        "bridge_status": "live",
        "method": "GET",
        "query_params": ["status"],
        "description_pt": "Lista tarefas (local + Google Tasks se OAuth ligado; status=open por defeito).",
        "exemplos": ["Minhas tarefas"],
    },
    {
        "id": "agenda_google_auth",
        "domain": "agenda",
        "bridge_path": "/agenda/google/auth-url",
        "bridge_status": "live",
        "method": "GET",
        "description_pt": "Gera URL OAuth Google Calendar+Tasks (requer Client ID/Secret). Ver docs/GOOGLE.md.",
        "exemplos": [],
    },
]

WRITE_ACTIONS = [
    {
        "path": "/tarefas",
        "method": "POST",
        "description_pt": "Criar tarefa (Google se ligado, senão local).",
        "body_exemplo": {"title": "Revisar CMV Tiny"},
    },
    {
        "path": "/tarefas/concluir",
        "method": "POST",
        "description_pt": "Concluir tarefa por id (gtask:… ou local).",
        "body_exemplo": {"id": "..."},
    },
    {
        "path": "/agenda/eventos",
        "method": "POST",
        "description_pt": "Criar evento (Google Calendar se ligado + espelho local).",
        "body_exemplo": {"title": "Call Tiny", "when": "2026-08-10T15:00:00"},
    },
]


def normalize_bridge_path(path: str) -> str:
    raw = (path or "").strip().split("?")[0]
    if not raw.startswith("/"):
        raw = "/" + raw
    raw = raw.rstrip("/") or "/"
    return BRIDGE_PATH_ALIASES.get(raw, raw)


def live_catalog_entries() -> list[CatalogEntry]:
    return [e for e in CATALOG if e.get("bridge_status") == "live"]


def live_bridge_paths() -> set[str]:
    return {e["bridge_path"] for e in live_catalog_entries()}


def is_allowed_agent_path(path: str) -> bool:
    path = normalize_bridge_path((path or "").split("?")[0])
    return path in live_bridge_paths()


def _entry_public(entry: CatalogEntry) -> dict:
    out = {
        "id": entry["id"],
        "domain": entry["domain"],
        "path": entry["bridge_path"],
        "method": entry.get("method") or "GET",
        "status": entry.get("bridge_status") or "live",
        "description_pt": entry.get("description_pt") or "",
    }
    if entry.get("query_params"):
        out["query_params"] = list(entry["query_params"])
    if entry.get("exemplos"):
        out["exemplos"] = list(entry["exemplos"])
    return out


def agent_catalog_payload(base_url: str = "http://127.0.0.1:8766/api/bridge") -> dict:
    entries = [_entry_public(e) for e in live_catalog_entries()]
    by_domain: dict[str, list] = {}
    for entry in entries:
        by_domain.setdefault(entry["domain"], []).append(entry)
    return {
        "service": "knowt-agent-gateway",
        "version": AGENT_GATEWAY_VERSION,
        "base_url": base_url.rstrip("/"),
        "read_only": True,
        "defaults": DEFAULTS,
        "stats": {"total": len(entries), "live": len(entries), "planned": 0},
        "domains": sorted(by_domain.keys()),
        "endpoints": entries,
        "usage_pt": (
            "Plugin knowt (Tiny piloto). Fluxo: 1) knowt_catalog; 2) escolha path; "
            "3) knowt_query(path=..., periodo=...); 4) knowt_action só agenda/tarefas; "
            "5) responde com dados retornados. Nunca inventes receita/margem."
        ),
        "write_actions": WRITE_ACTIONS,
    }
