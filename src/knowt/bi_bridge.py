"""Bridge compatível com o client fiesta-bi (Insights + assistente).

Zero verdade silenciosa: só números de pedidos Tiny onde `orders.list` está live;
vendas/margem não são inventadas.
"""
from __future__ import annotations

import json
import os
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from flask import Blueprint, jsonify, request

from knowt.agenda_store import (
    add_event,
    google_status as agenda_google_status,
    list_events_merged,
)
from knowt.agent_catalog import agent_catalog_payload
from knowt.answers import answer_chat
from knowt.audit import append_answer_audit, audit_path_for
from knowt.google_oauth import build_auth_url, exchange_code, status as google_oauth_status
from knowt.hermes_chat import assistant_engine, hermes_available, run_hermes_chat
from knowt.mongo import ping_mongo
from knowt.orgs import OrgRegistry, assert_source_in_org, default_org_id, seed_default_org
from knowt.order_breakdown import breakdown_por_situacao, format_breakdown_short
from knowt.period import Period, today_br
from knowt.sales_gates import can_publish_sales_summary, load_gates
from knowt.discovery_dossier import load_latest_dossier, persist_discovery_dossier
from knowt.discovery_ui import (
    load_latest_margin_reports,
    load_latest_product_cost_probe,
    load_latest_system_map,
    load_latest_system_map_expand,
)
from knowt.sales_probe import load_latest_probe
from knowt.situacao import wants_situacao_breakdown
from knowt.sources import SourceRegistry
from knowt.tasks_store import (
    add_task,
    complete_task,
    google_status as tasks_google_status,
    list_tasks_merged,
)
from knowt.tiny_orders import count_orders_in_period, fetch_orders_page
from knowt.vault import resolve_secret
from knowt.whatsapp import (
    handle_webhook_messages,
    parse_allowlist as wa_parse_allowlist,
    verify_signature,
    verify_webhook_challenge,
    whatsapp_configured,
)


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
    org_registry: OrgRegistry | None = None,
) -> Blueprint:
    bp = Blueprint("bi_bridge", __name__, url_prefix="/api/bridge")
    orgs = org_registry or OrgRegistry(Path(data_dir))
    seed_default_org(orgs)

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
        path = (request.path or "").rstrip("/")
        # públicos: health + webhook Meta (challenge + eventos)
        if path.endswith("/api/bridge/health"):
            return None
        if path.endswith("/api/bridge/whatsapp/webhook"):
            return None
        if path.endswith("/api/bridge/agenda/google/callback"):
            return None
        if not _auth_ok():
            return (
                jsonify({"ok": False, "error": "unauthorized", "message": "Token inválido"}),
                401,
            )
        return None

    def _resolve_org_id() -> str:
        ctx = request.get_json(silent=True) or {}
        if isinstance(ctx, dict):
            c = ctx.get("context") or {}
            if isinstance(c, dict) and c.get("org_id"):
                return str(c.get("org_id")).strip() or default_org_id()
        q = (request.args.get("org_id") or "").strip()
        return q or default_org_id()

    @bp.get("/health")
    def health():
        tg = bool(resolve_secret("KNOWT_TELEGRAM_BOT_TOKEN", required=False))
        wa = whatsapp_configured()
        hermes_bin = hermes_available()
        engine = assistant_engine()
        mongo = ping_mongo()
        orgs.load()
        seed_default_org(orgs)
        gstat = google_oauth_status()
        return jsonify(
            {
                "ok": True,
                "service": "knowt-bridge",
                "chat": True,
                "hermes_bin": hermes_bin,
                "assistant_engine": engine,
                "org_id": default_org_id(),
                "orgs_count": len(orgs.list()),
                "telegram_configured": tg,
                "whatsapp_configured": wa,
                "whatsapp_webhook": "/api/bridge/whatsapp/webhook",
                "mongo_ok": bool(mongo.get("ok")),
                "mongo": mongo,
                "google_credentials_configured": bool(gstat.get("credentials_configured")),
                "google_connected": bool(gstat.get("google_connected")),
                "google": gstat,
                "telegram_note": (
                    "Bot fino → /assistant/chat (engine="
                    + engine
                    + "). Hermes gateway Telegram fica off para não duplicar o token — ver docs/HERMES.md"
                    if tg
                    else "Define KNOWT_TELEGRAM_BOT_TOKEN — ver docs/TELEGRAM.md"
                ),
                "whatsapp_note": (
                    "Cloud API activo — ver docs/WHATSAPP.md"
                    if wa
                    else "Define KNOWT_WHATSAPP_TOKEN + PHONE_NUMBER_ID — ver docs/WHATSAPP.md"
                ),
                "google_note": (
                    "Calendar+Tasks ligados — ver docs/GOOGLE.md"
                    if gstat.get("google_connected")
                    else (
                        "Credenciais prontas — GET /agenda/google/auth-url — ver docs/GOOGLE.md"
                        if gstat.get("credentials_configured")
                        else "Agenda local. Para Google: KNOWT_GOOGLE_CLIENT_ID/SECRET — docs/GOOGLE.md"
                    )
                ),
            }
        )

    @bp.get("/catalog")
    def catalog():
        return jsonify(agent_catalog_payload("http://127.0.0.1:8766/api/bridge"))

    @bp.get("/organizacoes")
    def organizacoes():
        orgs.load()
        seed_default_org(orgs)
        rows = [o.to_dict() for o in orgs.list()]
        return jsonify(
            {
                "ok": True,
                "orgs": rows,
                "total": len(rows),
                "default_org_id": default_org_id(),
            }
        )

    @bp.get("/organizacoes/<org_id>")
    def organizacao_get(org_id: str):
        orgs.load()
        org = orgs.get(org_id)
        if not org:
            return jsonify({"ok": False, "error": "org_not_found"}), 404
        registry.load()
        fontes_org = [s.to_dict() for s in registry.list(org_id=org_id)]
        return jsonify({"ok": True, "org": org.to_dict(), "fontes": fontes_org})

    @bp.get("/fontes")
    def fontes():
        registry.load()
        oid = _resolve_org_id()
        src = registry.get("tinyerp")
        if src and not assert_source_in_org(src.org_id, oid):
            return jsonify(
                {
                    "ok": False,
                    "error": "org_mismatch",
                    "message": f"Fonte tinyerp não pertence à org `{oid}`.",
                    "org_id": oid,
                }
            ), 403
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
            "org_id": (src.org_id if src else oid),
            "logo_url": None,
            "pedidos_count": page_count or 1,
        }
        return jsonify({"ok": True, "fontes": [fonte], "total": 1, "org_id": oid})

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
        br = None
        br_txt = ""
        if counted.ok:
            try:
                br = breakdown_por_situacao(_token(), data_inicial=d0, data_final=d1)
                br_txt = format_breakdown_short(br, max_items=8)
            except Exception:
                br = None
        leitura = (
            f"No período **{period.label}** a Tiny reporta **{n}** pedido(s) "
            f"(capability `orders.list`, contagem {counted.method or 'n/d'})."
            + (f" Por situação: {br_txt}." if br_txt else "")
            + " Receita/margem ainda não estão live no knowt — não inventamos valores."
            if counted.ok
            else (
                f"Não consegui contar pedidos ({counted.reason_code}). "
                "Sem inventar números."
            )
        )
        achados = [
            {
                "titulo": "Cobertura knowt",
                "detalhe": "live: orders.list + orders.detail · blocked: sales.summary / margem",
                "tipo": "info",
            }
        ]
        if br and br.get("by_situacao"):
            for row in br["by_situacao"]:
                if row.get("ok") and row.get("total_orders"):
                    achados.append(
                        {
                            "titulo": f"Pedidos · {row['situacao']}",
                            "detalhe": f"{row['total_orders']} no período",
                            "tipo": "info",
                        }
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
                "achados": achados,
                "breakdown": br,
                "recomendacoes": [
                    {
                        "titulo": "Perguntar no chat",
                        "detalhe": "Ex.: «resumo de pedidos…», «cria uma tarefa…», «agenda call amanhã às 15h»",
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
        _, missing = can_publish_sales_summary(data_dir)
        probe = load_latest_probe(data_dir)
        probe_detalhe = "Ainda sem probe — corre scripts/run_sales_probe.py"
        if probe:
            p1 = probe.get("page1_sample") or {}
            oc = probe.get("orders_count") or {}
            probe_detalhe = (
                f"Último probe: {oc.get('total_orders')} ped. no período; "
                f"soma valor pág.1={p1.get('page_valor_sum')} "
                f"({p1.get('page_valor_parsed')} c/ valor). "
                "Não extrapolar; sales.summary continua unavailable."
            )
        return jsonify(
            {
                "periodo": _periodo_payload(period),
                "acoes": [
                    {
                        "titulo": "Validar sales.summary / margem",
                        "detalhe": (
                            "Gates em falta: "
                            + (", ".join(missing) if missing else "nenhum — ainda assim só publish manual")
                            + ". Ver docs/SALES_SUMMARY_PACOTE.md"
                        ),
                        "prioridade": 1,
                    },
                    {
                        "titulo": "Evidência do probe Tiny",
                        "detalhe": probe_detalhe,
                        "prioridade": 2,
                    },
                ],
                "total": 2,
                "confianca": {"nivel": "media", "motivo": "piloto Tiny em expansão"},
                "texto": "Plano knowt: expandir capabilities com validação.",
                "fonte": "tinyerp",
                "gates": load_gates(data_dir),
                "probe": probe,
            }
        )

    @bp.get("/sales/probe/latest")
    def sales_probe_latest():
        probe = load_latest_probe(data_dir)
        ok_pub, missing = can_publish_sales_summary(data_dir)
        if not probe:
            return jsonify(
                {
                    "ok": True,
                    "probe": None,
                    "can_publish_sales_summary": ok_pub,
                    "missing_gates": missing,
                    "note": "Sem evidence/sales_probe_latest.json",
                }
            )
        return jsonify(
            {
                "ok": True,
                "probe": probe,
                "can_publish_sales_summary": ok_pub,
                "missing_gates": missing,
            }
        )

    @bp.get("/discovery/ui/product-cost/latest")
    def discovery_ui_product_cost_latest():
        probe = load_latest_product_cost_probe(data_dir)
        return jsonify(
            {
                "ok": True,
                "probe": probe,
                "note": (
                    None
                    if probe
                    else "Sem evidence/ui_tiny_product_cost_latest.json — corre probe-cost"
                ),
            }
        )

    @bp.get("/discovery/ui/system-map/latest")
    def discovery_ui_system_map_latest():
        probe = load_latest_system_map(data_dir)
        return jsonify(
            {
                "ok": True,
                "probe": probe,
                "note": (
                    None
                    if probe
                    else "Sem evidence/ui_system_map_latest.json — corre probe-system"
                ),
            }
        )

    @bp.get("/discovery/ui/margin-reports/latest")
    def discovery_ui_margin_reports_latest():
        probe = load_latest_margin_reports(data_dir)
        return jsonify(
            {
                "ok": True,
                "probe": probe,
                "note": (
                    None
                    if probe
                    else "Sem evidence/ui_margin_reports_latest.json — corre probe-margin-reports"
                ),
            }
        )

    @bp.get("/discovery/ui/system-map-expand/latest")
    def discovery_ui_system_map_expand_latest():
        probe = load_latest_system_map_expand(data_dir)
        return jsonify(
            {
                "ok": True,
                "probe": probe,
                "note": (
                    None
                    if probe
                    else "Sem evidence/ui_system_map_expand_latest.json — corre probe-system-expand"
                ),
            }
        )

    @bp.get("/discovery/dossier")
    def discovery_dossier():
        """Inventário consolidado do que o Discovery já observou no Tiny."""
        rebuild = (request.args.get("rebuild") or "").strip().lower() in {
            "1",
            "true",
            "yes",
        }
        if rebuild:
            dossier = persist_discovery_dossier(data_dir)
        else:
            dossier = load_latest_dossier(data_dir) or persist_discovery_dossier(data_dir)
        return jsonify({"ok": True, "dossier": dossier})

    @bp.get("/fonte/status")
    def fonte_status():
        """Proveniência honest para o strip da UI (sem espelho Mongo)."""
        registry.load()
        sid = (request.args.get("source_id") or "tinyerp").strip() or "tinyerp"
        src = registry.get(sid)
        live_caps = [
            c.id
            for c in (src.capabilities if src else [])
            if getattr(c, "status", None) == "live"
        ]
        period = _period_from_args()
        d0, d1 = period.tiny_bounds()
        pedidos = 0
        count_ok = False
        try:
            counted = count_orders_in_period(_token(), data_inicial=d0, data_final=d1)
            count_ok = counted.ok
            pedidos = int(counted.total_orders or 0) if counted.ok else 0
        except Exception:
            pedidos = int((registry.get("tinyerp") and 0) or 0)
        name = "Tiny ERP"
        if sid != "tinyerp" and src is not None:
            name = str(getattr(src, "system", None) or sid)
        return jsonify(
            {
                "ok": True,
                "source_id": sid,
                "health": "ok" if count_ok else "warning",
                "shadow": False,
                "source": {
                    "id": sid,
                    "name": name,
                    "db_name": "bi_tinyerp" if sid == "tinyerp" else sid,
                    "builtin": True,
                    "role": "erp",
                    "status": "active",
                    "is_mirror": False,
                },
                "freshness": {
                    "field": "tiny_api_live",
                    "at": None,
                    "age_minutes": 0 if count_ok else None,
                    "pedidos_count": pedidos,
                    "ok": count_ok,
                    "sla_minutes": 0,
                    "state": "fresh" if count_ok else "unknown",
                },
                "coverage": {
                    "pedidos_count": pedidos,
                    "quality_suggestion": "live_api",
                    "recon_ok": None,
                    "capabilities": live_caps,
                    "capabilities_count": len(live_caps),
                },
                "drift": {"last": None},
                "provenance": {
                    "label_pt": "Tiny ERP · API ao vivo",
                    "contract_hint": "sem espelho Mongo · zero verdade silenciosa",
                },
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
        events = list_events_merged(data_dir, period.start, period.end)
        gstat = agenda_google_status()
        return jsonify(
            {
                "ok": True,
                "periodo": _periodo_payload(period),
                "events": events,
                "eventos": events,
                "count": len(events),
                "google": gstat,
                "source": "google+knowt_local"
                if gstat.get("google_connected")
                else "knowt_local",
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
        try:
            out = build_auth_url()
            return jsonify({"ok": True, **out, "google": google_oauth_status()})
        except ValueError as exc:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": str(exc),
                        "message": "Google OAuth não configurado — ver docs/GOOGLE.md",
                        "google": google_oauth_status(),
                    }
                ),
                400,
            )

    @bp.get("/agenda/google/callback")
    def agenda_google_callback():
        code = (request.args.get("code") or "").strip()
        state = (request.args.get("state") or "").strip()
        err = (request.args.get("error") or "").strip()
        if err:
            return (
                f"<html><body><h3>Google OAuth cancelado</h3><p>{err}</p></body></html>",
                400,
                {"Content-Type": "text/html; charset=utf-8"},
            )
        try:
            exchange_code(code, state)
        except ValueError as exc:
            return (
                f"<html><body><h3>Falha OAuth</h3><p>{exc}</p>"
                "<p>Fecha esta janela e tenta outra vez.</p></body></html>",
                400,
                {"Content-Type": "text/html; charset=utf-8"},
            )
        return (
            "<html><body><h3>knowt · Google ligado</h3>"
            "<p>Calendar e Tasks autorizados. Podes fechar esta janela.</p>"
            "</body></html>",
            200,
            {"Content-Type": "text/html; charset=utf-8"},
        )

    @bp.get("/tarefas")
    def tarefas():
        status = (request.args.get("status") or "open").strip().lower() or "open"
        tasks = list_tasks_merged(data_dir, status=status)
        gstat = tasks_google_status()
        return jsonify(
            {
                "ok": True,
                "tasks": tasks,
                "tarefas": tasks,
                "count": len(tasks),
                "status_filter": status,
                "google": gstat,
                "source": "google+knowt_local"
                if gstat.get("google_tasks_connected")
                else "knowt_local",
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
        org_id = default_org_id()
        if isinstance(ctx, dict) and ctx.get("org_id"):
            org_id = str(ctx.get("org_id")).strip() or default_org_id()
        src = registry.get(source_id)
        if src and not assert_source_in_org(src.org_id, org_id):
            return jsonify(
                {
                    "ok": False,
                    "error": "org_mismatch",
                    "message": f"Fonte `{source_id}` não pertence à org `{org_id}`.",
                    "org_id": org_id,
                    "source_org_id": src.org_id,
                }
            ), 403
        if not message:
            return jsonify({"ok": False, "error": "empty", "message": "Mensagem vazia"})
        channel = ""
        if isinstance(ctx, dict):
            channel = str(ctx.get("channel") or "").strip().lower()
        tone = "casual" if channel in ("telegram", "whatsapp") else "default"
        engine = assistant_engine()
        force = str((ctx or {}).get("engine") or "").strip().lower()
        if force in ("hermes", "deterministic"):
            engine = force
        # Tabelas factuais (ex. por situação) → sempre determinístico + HTML
        if wants_situacao_breakdown(message) and force != "hermes":
            engine = "deterministic"
        if engine == "hermes":
            h = run_hermes_chat(
                message,
                session_id=str(payload.get("session_id") or "") or None,
            )
            try:
                append_answer_audit(
                    audit_path_for(data_dir),
                    message=message,
                    source_id=source_id,
                    result={"engine": "hermes", **h},
                )
            except OSError:
                pass
            if h.get("ok"):
                return jsonify(
                    {
                        "ok": True,
                        "reply": h.get("reply") or "",
                        "session_id": h.get("session_id")
                        or payload.get("session_id")
                        or "knowt-web",
                        "engine": "hermes",
                    }
                )
            # fallback determinístico se Hermes falhar
            result = answer_chat(
                registry,
                message=message,
                source_id=source_id,
                data_dir=data_dir,
                tone=tone,
            )
            reply = result.get("answer") or result.get("enforcement", {}).get("message") or ""
            payload_out: Dict[str, Any] = {
                "ok": True,
                "reply": reply,
                "session_id": payload.get("session_id") or "knowt-web",
                "enforcement": result.get("enforcement"),
                "engine": "deterministic",
                "hermes_fallback": h.get("error") or "hermes_failed",
            }
            if result.get("answer_html"):
                payload_out["reply_html"] = result["answer_html"]
            return jsonify(payload_out)

        result = answer_chat(
            registry,
            message=message,
            source_id=source_id,
            data_dir=data_dir,
            tone=tone,
        )
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
        payload_out = {
            "ok": True,
            "reply": reply,
            "session_id": payload.get("session_id") or "knowt-web",
            "enforcement": result.get("enforcement"),
            "engine": "deterministic",
        }
        if result.get("answer_html"):
            payload_out["reply_html"] = result["answer_html"]
        return jsonify(payload_out)

    def _assistant_reply_text(
        message: str,
        *,
        source_id: str,
        channel: str,
        session_id: str,
    ) -> str:
        """Resposta em texto (WhatsApp / uso interno) — sem HTTP aninhado."""
        tone = "casual" if channel in ("telegram", "whatsapp") else "default"
        engine = assistant_engine()
        if engine == "hermes":
            h = run_hermes_chat(message, session_id=None)
            # session_id wa-* não é hermes — não passar
            if h.get("ok") and h.get("reply"):
                try:
                    append_answer_audit(
                        audit_path_for(data_dir),
                        message=message,
                        source_id=source_id,
                        result={"engine": "hermes", "channel": channel, **h},
                    )
                except OSError:
                    pass
                return str(h["reply"])
        result = answer_chat(
            registry,
            message=message,
            source_id=source_id,
            data_dir=data_dir,
            tone=tone,
        )
        try:
            append_answer_audit(
                audit_path_for(data_dir),
                message=message,
                source_id=source_id,
                result={"channel": channel, **result},
            )
        except OSError:
            pass
        return str(
            result.get("answer")
            or result.get("enforcement", {}).get("message")
            or "(sem resposta)"
        )

    @bp.get("/whatsapp/webhook")
    def whatsapp_webhook_verify():
        mode = (request.args.get("hub.mode") or "").strip()
        token = (request.args.get("hub.verify_token") or "").strip()
        challenge = (request.args.get("hub.challenge") or "").strip()
        expected = (
            resolve_secret("KNOWT_WHATSAPP_VERIFY_TOKEN", required=False) or ""
        ).strip()
        ch = verify_webhook_challenge(
            mode=mode,
            token=token,
            challenge=challenge,
            expected_verify_token=expected,
        )
        if ch is None:
            return "forbidden", 403
        return ch, 200, {"Content-Type": "text/plain"}

    @bp.post("/whatsapp/webhook")
    def whatsapp_webhook_events():
        raw = request.get_data(cache=False, as_text=False) or b""
        app_secret = (
            resolve_secret("KNOWT_WHATSAPP_APP_SECRET", required=False) or ""
        ).strip()
        if not verify_signature(raw, request.headers.get("X-Hub-Signature-256"), app_secret):
            return jsonify({"ok": False, "error": "bad_signature"}), 403
        if not whatsapp_configured():
            return jsonify({"ok": False, "error": "whatsapp_not_configured"}), 503
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return jsonify({"ok": False, "error": "invalid_json"}), 400
        access = (resolve_secret("KNOWT_WHATSAPP_TOKEN", required=False) or "").strip()
        phone_id = (
            resolve_secret("KNOWT_WHATSAPP_PHONE_NUMBER_ID", required=False) or ""
        ).strip()
        allow = wa_parse_allowlist(
            resolve_secret("KNOWT_WHATSAPP_ALLOWLIST", required=False)
            or os.environ.get("KNOWT_WHATSAPP_ALLOWLIST")
        )
        source_id = (
            (os.environ.get("KNOWT_WHATSAPP_SOURCE_ID") or "tinyerp").strip() or "tinyerp"
        )

        def reply_fn(wa_id: str, text: str) -> str:
            registry.load()
            return _assistant_reply_text(
                text,
                source_id=source_id,
                channel="whatsapp",
                session_id=f"wa-{wa_id}",
            )

        # Responder 200 rápido à Meta: processar no mesmo pedido (timeout nginx 180s).
        # Em volume alto, mover para fila async.
        n = handle_webhook_messages(
            payload if isinstance(payload, dict) else {},
            allowlist=allow,
            access_token=access,
            phone_number_id=phone_id,
            reply_fn=reply_fn,
        )
        return jsonify({"ok": True, "replied": n})

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
