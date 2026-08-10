"""Drift + alertas (plano Fase 9) — API live Tiny, sem espelho Mongo Fiesta.

Tipos: schema_drift · contract_break · reconciliation_drift.
Nunca aplica kill switch automaticamente — só `suggest_kill_switch`.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from knowt.contracts import ensure_seed_contracts, get_published
from knowt.reason_codes import reason_payload
from knowt.sources import SourceRegistry
from knowt.vault import resolve_secret


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def drift_dir(data_dir: Path) -> Path:
    d = Path(data_dir) / "drift"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _baseline_path(data_dir: Path, source_id: str) -> Path:
    return drift_dir(data_dir) / f"baseline_{source_id}.json"


def _events_path(data_dir: Path) -> Path:
    return drift_dir(data_dir) / "events.jsonl"


def load_baseline(data_dir: Path, source_id: str) -> Optional[dict]:
    p = _baseline_path(data_dir, source_id)
    if not p.is_file():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def save_baseline(data_dir: Path, source_id: str, fields: Set[str], sample_n: int) -> dict:
    doc = {
        "source_id": source_id,
        "updated_at": _now_iso(),
        "fields": sorted(fields),
        "sample_n": sample_n,
        "surface": "tiny_orders_list_preview",
    }
    _baseline_path(data_dir, source_id).write_text(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return doc


def append_event(data_dir: Path, event: dict) -> dict:
    p = _events_path(data_dir)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(event, ensure_ascii=False) + "\n")
    return event


def list_events(
    data_dir: Path,
    *,
    source_id: Optional[str] = None,
    limit: int = 20,
) -> List[dict]:
    p = _events_path(data_dir)
    if not p.is_file():
        return []
    rows: List[dict] = []
    try:
        lines = p.read_text(encoding="utf-8").splitlines()
    except OSError:
        return []
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if source_id and ev.get("source_id") != source_id:
            continue
        rows.append(ev)
        if len(rows) >= max(1, int(limit)):
            break
    return rows


def last_event(data_dir: Path, source_id: str) -> Optional[dict]:
    rows = list_events(data_dir, source_id=source_id, limit=1)
    return rows[0] if rows else None


def _sample_fields_from_token(token: str) -> tuple[Set[str], int, Optional[str]]:
    """Devolve (fields, n, error_code)."""
    from knowt.tiny_orders import fetch_orders_page

    page = fetch_orders_page(token, page=1)
    if not page.ok:
        return set(), 0, page.reason_code or "API_UNREACHABLE"
    fields: Set[str] = set()
    for prev in page.order_previews or []:
        if isinstance(prev, dict):
            fields.update(k for k, v in prev.items() if v is not None)
    # ids sempre presentes mesmo se preview escasso
    if page.order_ids:
        fields.add("id")
    return fields, int(page.order_count or 0), None


def detect_schema_alerts(
    *,
    baseline: Optional[dict],
    current_fields: Set[str],
    sample_n: int,
) -> List[dict]:
    alerts: List[dict] = []
    if baseline is None:
        alerts.append(
            {
                "type": "schema_drift",
                "severity": "info",
                "code": "NO_BASELINE_DRIFT",
                "message": "Sem baseline — criado neste check.",
                "detail": {"fields": sorted(current_fields), "sample_n": sample_n},
            }
        )
        return alerts
    old = set(baseline.get("fields") or [])
    added = sorted(current_fields - old)
    removed = sorted(old - current_fields)
    if added or removed:
        sev = "error" if removed else "warning"
        alerts.append(
            {
                "type": "schema_drift",
                "severity": sev,
                "code": "FIELD_SET_CHANGED",
                "message": "Campos da amostra Tiny mudaram vs baseline.",
                "detail": {"added": added, "removed": removed},
                **reason_payload("FIELD_SET_CHANGED"),
            }
        )
    return alerts


def detect_contract_alerts(data_dir: Path, current_fields: Set[str]) -> List[dict]:
    ensure_seed_contracts(data_dir)
    published = get_published(data_dir, "orders.v1")
    if not published:
        return []
    required = [str(f) for f in (published.get("required_fields") or [])]
    missing = [f for f in required if f not in current_fields]
    if not missing:
        return []
    return [
        {
            "type": "contract_break",
            "severity": "critical",
            "code": "CONTRACT_FIELD_MISSING",
            "message": "Amostra não cobre campos obrigatórios de orders.v1 published.",
            "detail": {
                "contract_id": "orders.v1",
                "version": published.get("version"),
                "hash": published.get("hash"),
                "missing": missing,
            },
            **reason_payload("CONTRACT_FIELD_MISSING"),
        }
    ]


def run_drift_check(
    data_dir: Path,
    registry: SourceRegistry,
    *,
    source_id: str = "tinyerp",
    actor: str = "operator",
    api_token: Optional[str] = None,
) -> dict:
    """Corre um check e grava evento. Nunca suspende a fonte."""
    ensure_seed_contracts(data_dir)
    src = registry.get(source_id)
    token = (api_token or "").strip()
    if not token:
        token = (resolve_secret("KNOWT_SECRET_TINY_TOKEN", required=False) or "").strip()

    alerts: List[dict] = []
    current_fields: Set[str] = set()
    sample_n = 0
    fetch_error = None

    if not token:
        alerts.append(
            {
                "type": "reconciliation_drift",
                "severity": "warning",
                "code": "API_UNREACHABLE",
                "message": "Sem token Tiny — drift de amostra não correu.",
                "detail": {},
                **reason_payload("API_UNREACHABLE"),
            }
        )
        fetch_error = "SECRET_EMPTY"
    else:
        current_fields, sample_n, fetch_error = _sample_fields_from_token(token)
        if fetch_error:
            alerts.append(
                {
                    "type": "reconciliation_drift",
                    "severity": "error",
                    "code": "API_UNREACHABLE",
                    "message": f"Falha ao amostrar Tiny ({fetch_error}).",
                    "detail": {"reason_code": fetch_error},
                    **reason_payload("API_UNREACHABLE"),
                }
            )
        elif sample_n == 0 and not current_fields:
            alerts.append(
                {
                    "type": "reconciliation_drift",
                    "severity": "warning",
                    "code": "RECON_SAMPLE_EMPTY",
                    "message": "Amostra vazia — não assumir zero como verdade.",
                    "detail": {},
                    **reason_payload("RECON_SAMPLE_EMPTY"),
                }
            )
        else:
            baseline = load_baseline(data_dir, source_id)
            alerts.extend(
                detect_schema_alerts(
                    baseline=baseline,
                    current_fields=current_fields,
                    sample_n=sample_n,
                )
            )
            alerts.extend(detect_contract_alerts(data_dir, current_fields))
            save_baseline(data_dir, source_id, current_fields, sample_n)

    severities = {a.get("severity") for a in alerts}
    suggest = any(
        a.get("severity") in ("error", "critical")
        or a.get("code") in ("CONTRACT_FIELD_MISSING", "CONTRACT_BREAK")
        for a in alerts
    )
    # nunca auto-kill; demote opcional só se env pedir
    demoted: List[str] = []
    auto_demote = (os.environ.get("KNOWT_DRIFT_AUTO_DEMOTE") or "").strip() in (
        "1",
        "true",
        "yes",
    )
    if auto_demote and suggest and src:
        from knowt.publish import set_capability_status

        for cap in list(src.capabilities):
            if cap.status == "live" and cap.id.startswith("orders."):
                set_capability_status(
                    registry,
                    source_id=source_id,
                    capability_id=cap.id,
                    status="pending",
                    quality="unknown",
                    description=(cap.description or "")
                    + " [demoted by drift auto — KNOWT_DRIFT_AUTO_DEMOTE]",
                )
                demoted.append(cap.id)

    event = {
        "id": str(uuid.uuid4()),
        "at": _now_iso(),
        "source_id": source_id,
        "actor": actor,
        "alerts": alerts,
        "alert_count": len(alerts),
        "severities": sorted(s for s in severities if s),
        "suggest_kill_switch": suggest,
        "auto_kill": False,
        "demoted_capabilities": demoted,
        "sample": {
            "fields": sorted(current_fields),
            "n": sample_n,
            "fetch_error": fetch_error,
        },
        "note": (
            "Drift knowt (API live). Nunca auto-suspende a fonte. "
            "Kill switch só via POST /fontes/{id}/kill-switch."
        ),
    }
    append_event(data_dir, event)
    # latest pointer
    (drift_dir(data_dir) / f"last_{source_id}.json").write_text(
        json.dumps(event, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return event
