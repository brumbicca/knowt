"""Bridge compatível com o client fiesta-bi (Insights + assistente).

Zero verdade silenciosa: só números de pedidos Tiny onde `orders.list` está live;
vendas/margem não são inventadas.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, Optional, Tuple

from flask import Blueprint, jsonify, request

from knowt.agenda_store import add_event, google_status as agenda_google_status, list_events
from knowt.answers import answer_chat
from knowt.audit import append_answer_audit, audit_path_for
from knowt.period import Period, today_br
from knowt.sources import SourceRegistry
from knowt.tasks_store import (
    add_task,
    complete_task,
    google_status as tasks_google_status,
    list_tasks,
)
from knowt.tiny_orders import count_orders_in_period, fetch_orders_page
from knowt.vault import resolve_secret


def _period_from_args() -> Period:
    hoje = today_br()
    di = (request.args.get("data_inicio") or "").strip()
    df = (request.args.get("data_fim") or "").strip()
    if di and df:
        try:
            d0 = date.fromisoformat(di[:10])
            d1 = date.fromisoformat(df[:10])
            if d1 < d0:
                d0, d1 = d1, d0
            return Period(d0, d1, f"{d0.isoformat()} a {d1.isoformat()}")
        except ValueError:
            pass
    p = (request.args.get("periodo") or "7d").strip().lower()
    if p in ("hoje",):
        return Period(hoje, hoje, "hoje")
    if p in ("proximos", "próximos", "prox"):
        return Period(hoje, hoje + timedelta(days=7), "próximos 7 dias")
    if p in ("semana",):
        start = hoje - timedelta(days=hoje.weekday())
        return Period(start, hoje, "esta semana")
    if p in ("mes", "mês"):
        return Period(hoje.replace(day=1), hoje, "este mês")
    if p in ("30d",):
        return Period(hoje - timedelta(days=29), hoje, "últimos 30 dias")
    # 7d default
    return Period(hoje - timedelta(days=6), hoje, "últimos 7 dias")


def _periodo_payload(period: Period) -> Dict[str, Any]:
    return {
        "inicio": period.start.isoformat(),
        "fim": period.end.isoformat(),
        "label": period.label,
    }


def _token() -> str:
    return resolve_secret("KNOWT_SECRET_TINY_TOKEN", required=True)


def create_bi_bridge_blueprint(
    registry: SourceRegistry,
    *,
    data_dir,
    api_token: str,
) -> Blueprint:
    bp = Blueprint("bi_bridge", __name__, url_prefix="/api/bridge")

    def _auth_ok() -> bool:
        expected = (api_token or "").strip()
        if not expected:
            return True
        got = (
            (request.headers.get("X-Fiesta-Bi-Key") or "").strip()
            or (request.headers.get("X-Knowt-Token") or "").strip()
        )
        auth = (request.headers.get("Authorization") or "").strip()
        if auth.lower().startswith("bearer "):
            got = got or auth[7:].strip()
        return got == expected

    @bp.before_request
    def _guard():
        if not _auth_ok():
            return (
                jsonify({"ok": False, "error": "unauthorized", "message": "Token inválido"}),
                401,
            )
        return None

    @bp.get("/fontes")
    def fontes():
        registry.load()
        src = registry.get("tinyerp")
        page_count = 0
        try:
            page = fetch_orders_page(_token(), page=1)
            if page.ok:
                page_count = int(page.total_pages or 0) * 100  # estimativa só para coverage UI
        except Exception:
            page_count = 0
        fonte = {
            "id": "tinyerp",
            "name": "Tiny ERP",
            "db_name": "bi_tinyerp",
            "builtin": True,
            "status": "active" if src else "draft",
            "role": "erp",
            "logo_url": None,
            "pedidos_count": page_count or 1,
        }
        return jsonify({"ok": True, "fontes": [fonte], "total": 1})

    @bp.get("/vendas/periodo")
    def vendas_periodo():
        period = _period_from_args()
        d0, d1 = period.tiny_bounds()
        counted = count_orders_in_period(_token(), data_inicial=d0, data_final=d1)
        n = counted.total_orders if counted.ok else 0
        return jsonify(
            {
                "periodo": _periodo_payload(period),
                "marketplace": None,
                "pedidos_validos": n,
                "vendas_validas": 0,
                "vendas_validas_fmt": "—",
                "raw": {
                    "note": "knowt: só contagem de pedidos (orders.list). sales.summary unavailable.",
                    "count_ok": counted.ok,
                    "reason_code": counted.reason_code,
                    "method": counted.method,
                },
            }
        )

    @bp.get("/pedidos/metricas")
    def pedidos_metricas():
        period = _period_from_args()
        d0, d1 = period.tiny_bounds()
        counted = count_orders_in_period(_token(), data_inicial=d0, data_final=d1)
        n = counted.total_orders if counted.ok else 0
        return jsonify(
            {
                "periodo": _periodo_payload(period),
                "total_liquido": 0,
                "total_liquido_fmt": "—",
                "total_receita": 0,
                "total_receita_fmt": "—",
                "total_pedidos": n,
                "metricas": {"pedidos": n},
            }
        )

    @bp.get("/vendas/dashboard-completo")
    def dashboard_completo():
        period = _period_from_args()
        d0, d1 = period.tiny_bounds()
        counted = count_orders_in_period(_token(), data_inicial=d0, data_final=d1)
        n = counted.total_orders if counted.ok else 0
        return jsonify(
            {
                "periodo": _periodo_payload(period),
                "dashboard": {
                    "stats": {
                        "totalPedidos": n,
                        "totalPedidosValidos": n,
                        "totalVendas": 0,
                        "totalVendasValidas": 0,
                        "totalLiquido": 0,
                    },
                    "dailyStats": [],
                    "topSkus": [],
                },
            }
        )

    @bp.get("/vendas/comparacao")
    def comparacao():
        period = _period_from_args()
        return jsonify(
            {
                "periodo": _periodo_payload(period),
                "atual": {"pedidos": 0, "vendas": 0},
                "anterior": {"pedidos": 0, "vendas": 0},
                "delta_pct": None,
                "note": "comparacao indisponivel sem sales.summary",
            }
        )

    @bp.get("/margens/periodo")
    def margens_periodo():
        period = _period_from_args()
        return jsonify(
            {
                "periodo": _periodo_payload(period),
                "margem": 0,
                "margem_fmt": "—",
                "cmv": 0,
                "unavailable": True,
                "reason_code": "CAPABILITY_UNAVAILABLE",
                "note": "margins/sales.summary não publicados no knowt",
            }
        )

    @bp.get("/vendas/canais")
    def canais_alt():
        return jsonify({"canais": [], "capability_status": "unavailable"})

    @bp.get("/canais")
    def canais():
        return jsonify({"canais": [], "capability_status": "unavailable"})

    @bp.get("/insights/resumo")
    def insights_resumo():
        period = _period_from_args()
        d0, d1 = period.tiny_bounds()
        dominio = (request.args.get("dominio") or "geral").strip()
        counted = count_orders_in_period(_token(), data_inicial=d0, data_final=d1)
        n = counted.total_orders if counted.ok else 0
        leitura = (
            f"No período **{period.label}** a Tiny reporta **{n}** pedido(s) "
            f"(capability `orders.list`, contagem {counted.method or 'n/d'}). "
            "Receita/margem ainda não estão live no knowt — não inventamos valores."
            if counted.ok
            else (
                f"Não consegui contar pedidos ({counted.reason_code}). "
                "Sem inventar números."
            )
        )
        return jsonify(
            {
                "dominio": dominio,
                "dominio_label": dominio,
                "periodo": _periodo_payload(period),
                "marketplace": None,
                "titulo": f"Pedidos · {period.label}",
                "leitura": leitura,
                "insight": leitura,
                "principal": {
                    "titulo": "Volume de pedidos (Tiny)",
                    "detalhe": f"{n} pedido(s)" if counted.ok else "indisponível",
                    "tipo": "info",
                },
                "achados": [
                    {
                        "titulo": "Cobertura knowt",
                        "detalhe": "live: orders.list + orders.detail · blocked: sales.summary / margem",
                        "tipo": "info",
                    }
                ],
                "recomendacoes": [
                    {
                        "titulo": "Perguntar no chat",
                        "detalhe": "Ex.: «resumo de pedidos esta semana» ou «pedido <id>»",
                        "tipo": "acao",
                    }
                ],
                "confianca": {
                    "nivel": "alta" if counted.ok else "baixa",
                    "motivo": "Contagem via Tiny pedidos.pesquisa"
                    if counted.ok
                    else counted.reason_code,
                },
                "fonte": "tinyerp",
                "texto": leitura,
            }
        )

    @bp.get("/insights/plano")
    def insights_plano():
        period = _period_from_args()
        return jsonify(
            {
                "periodo": _periodo_payload(period),
                "acoes": [
                    {
                        "titulo": "Validar sales.summary / margem",
                        "detalhe": "Só publicar após pacote de negócio (zero verdade silenciosa).",
                        "prioridade": 1,
                    }
                ],
                "total": 1,
                "confianca": {"nivel": "media", "motivo": "piloto Tiny em expansão"},
                "texto": "Plano knowt: expandir capabilities com validação.",
                "fonte": "tinyerp",
            }
        )

    @bp.get("/sync/status")
    def sync_status():
        return jsonify(
            {
                "ok": True,
                "running": False,
                "mode": "live_api",
                "note": "knowt lê Tiny ao vivo — sem sync espelho Fiesta",
            }
        )

    @bp.get("/agenda/periodo")
    def agenda_periodo():
        period = _period_from_args()
        events = list_events(data_dir, period.start, period.end)
        gstat = agenda_google_status()
        return jsonify(
            {
                "ok": True,
                "periodo": _periodo_payload(period),
                "events": events,
                "eventos": events,
                "count": len(events),
                "google": gstat,
                "source": "knowt_local",
            }
        )

    @bp.post("/agenda/eventos")
    def agenda_criar_evento():
        payload = request.get_json(silent=True) or {}
        try:
            ev = add_event(
                data_dir,
                title=str(payload.get("title") or ""),
                start_iso=str(payload.get("start") or ""),
                end_iso=str(payload.get("end") or "") or None,
                kind=str(payload.get("kind") or "reuniao"),
            )
        except ValueError as exc:
            return jsonify({"ok": False, "error": str(exc)}), 400
        except Exception as exc:
            return jsonify({"ok": False, "error": "bad_start", "detail": str(exc)[:120]}), 400
        return jsonify({"ok": True, "event": ev})

    @bp.get("/agenda/google/auth-url")
    def agenda_google_auth_url():
        return jsonify(
            {
                "ok": False,
                "error": "google_not_configured",
                "message": "Google Calendar ainda não está ligado no piloto knowt.",
            }
        ), 400

    @bp.get("/tarefas")
    def tarefas():
        status = (request.args.get("status") or "open").strip().lower() or "open"
        tasks = list_tasks(data_dir, status=status)
        return jsonify(
            {
                "ok": True,
                "tasks": tasks,
                "tarefas": tasks,
                "count": len(tasks),
                "status_filter": status,
                "google": tasks_google_status(),
                "source": "knowt_local",
            }
        )

    @bp.post("/tarefas")
    def tarefas_criar():
        payload = request.get_json(silent=True) or {}
        try:
            task = add_task(
                data_dir,
                title=str(payload.get("title") or ""),
                priority=str(payload.get("priority") or "medium"),
                due=str(payload.get("due") or "") or None,
                notes=str(payload.get("notes") or "") or None,
            )
        except ValueError as exc:
            return jsonify({"ok": False, "error": str(exc)}), 400
        return jsonify({"ok": True, "task": task})

    @bp.post("/tarefas/concluir")
    def tarefas_concluir():
        payload = request.get_json(silent=True) or {}
        tid = payload.get("id") or payload.get("task_id")
        try:
            task = complete_task(data_dir, str(tid or ""))
        except ValueError as exc:
            code = 404 if str(exc) == "not_found" else 400
            return jsonify({"ok": False, "error": str(exc)}), code
        return jsonify({"ok": True, "task": task})

    @bp.post("/assistant/chat")
    def assistant_chat():
        registry.load()
        payload = request.get_json(silent=True) or {}
        message = (payload.get("message") or "").strip()
        source_id = "tinyerp"
        ctx = payload.get("context") or {}
        if isinstance(ctx, dict) and ctx.get("source_id"):
            source_id = str(ctx.get("source_id")).strip() or "tinyerp"
        if not message:
            return jsonify({"ok": False, "error": "empty", "message": "Mensagem vazia"})
        result = answer_chat(registry, message=message, source_id=source_id)
        try:
            append_answer_audit(
                audit_path_for(data_dir),
                message=message,
                source_id=source_id,
                result=result,
            )
        except OSError:
            pass
        reply = result.get("answer") or result.get("enforcement", {}).get("message") or ""
        return jsonify(
            {
                "ok": True,
                "reply": reply,
                "session_id": payload.get("session_id") or "knowt-web",
                "enforcement": result.get("enforcement"),
            }
        )

    @bp.post("/assistant/transcribe")
    def transcribe():
        return jsonify(
            {
                "ok": False,
                "error": "unavailable",
                "message": "Áudio ainda não está no piloto knowt.",
            }
        )

    return bp
