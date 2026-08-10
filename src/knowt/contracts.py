"""Fábrica / registry de contratos versionados (plano §8.11, Fase 2).

Persistência: `{data_dir}/contracts/*.json` + índice `contracts/index.json`.
Nunca promove capability — só regista e assina (hash) o contrato.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

ContractStatus = str  # draft | approved | published | deprecated


def contracts_dir(data_dir: Path) -> Path:
    d = Path(data_dir) / "contracts"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _canonical_blob(doc: dict) -> bytes:
    payload = {k: v for k, v in doc.items() if k not in ("hash", "updated_at")}
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )


def compute_hash(doc: dict) -> str:
    return hashlib.sha256(_canonical_blob(doc)).hexdigest()


def _path_for(data_dir: Path, contract_id: str, version: str) -> Path:
    safe_id = contract_id.replace("/", "_")
    safe_ver = version.replace("/", "_")
    return contracts_dir(data_dir) / f"{safe_id}@{safe_ver}.json"


def load_contract(data_dir: Path, contract_id: str, version: str) -> Optional[dict]:
    p = _path_for(data_dir, contract_id, version)
    if not p.is_file():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def save_contract(data_dir: Path, doc: dict) -> dict:
    cid = str(doc.get("contract_id") or "").strip()
    ver = str(doc.get("version") or "").strip()
    if not cid or not ver:
        raise ValueError("contract_id_and_version_required")
    doc = dict(doc)
    doc["updated_at"] = _now_iso()
    doc["hash"] = compute_hash(doc)
    p = _path_for(data_dir, cid, ver)
    p.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _refresh_index(data_dir)
    return doc


def list_contracts(data_dir: Path) -> List[dict]:
    out: List[dict] = []
    for p in sorted(contracts_dir(data_dir).glob("*.json")):
        if p.name == "index.json":
            continue
        try:
            out.append(json.loads(p.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return out


def get_published(data_dir: Path, contract_id: str) -> Optional[dict]:
    rows = [
        c
        for c in list_contracts(data_dir)
        if c.get("contract_id") == contract_id and c.get("status") == "published"
    ]
    if not rows:
        return None
    rows.sort(key=lambda c: str(c.get("version") or ""))
    return rows[-1]


def _refresh_index(data_dir: Path) -> None:
    rows = list_contracts(data_dir)
    idx = {
        "updated_at": _now_iso(),
        "count": len(rows),
        "contracts": [
            {
                "contract_id": c.get("contract_id"),
                "version": c.get("version"),
                "status": c.get("status"),
                "domain": c.get("domain"),
                "hash": c.get("hash"),
            }
            for c in rows
        ],
    }
    (contracts_dir(data_dir) / "index.json").write_text(
        json.dumps(idx, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _seed_doc(
    *,
    contract_id: str,
    version: str,
    domain: str,
    status: str,
    required_fields: List[str],
    optional_fields: List[str],
    limitations: List[str],
    description: str,
) -> dict:
    return {
        "contract_id": contract_id,
        "version": version,
        "status": status,
        "domain": domain,
        "org_id": "default",
        "source_system": "tiny-erp",
        "connector": "knowt.tiny_orders",
        "description": description,
        "objects": ["pedido"],
        "required_fields": required_fields,
        "optional_fields": optional_fields,
        "timezone": "America/Sao_Paulo",
        "currency": "BRL",
        "keys": ["id"],
        "deduplication": "id",
        "update_policy": "live_api_on_demand",
        "provenance": "Tiny API v2 pedidos.pesquisa / pedido.obter",
        "coverage": "piloto — campos mínimos observados",
        "limitations": limitations,
        "producer": "knowt",
        "consumers": ["knowt.bridge", "knowt.chat", "hermes"],
        "fixtures": {"valid": [], "invalid": []},
        "tests": [],
        "evidences": [],
        "approvals": [],
        "previous_version": None,
        "migration": None,
        "created_at": _now_iso(),
    }


SEED_CONTRACTS: List[dict] = [
    _seed_doc(
        contract_id="orders.v1",
        version="1.0.0",
        domain="orders",
        status="published",
        required_fields=["id"],
        optional_fields=["numero", "situacao", "data_pedido", "valor"],
        limitations=[
            "sem CMV/margem",
            "sem espelho Mongo obrigatório",
            "contagem via page_bounds quando aplicável",
        ],
        description="Contrato canónico mínimo de pedidos Tiny (piloto knowt).",
    ),
    _seed_doc(
        contract_id="sales.v1",
        version="1.0.0",
        domain="sales",
        status="draft",
        required_fields=["period_start", "period_end", "revenue"],
        optional_fields=["orders_count", "currency", "cost", "margin"],
        limitations=[
            "não publicado — gates de negócio (CMV/cost_field)",
            "nunca inventar receita no chat",
        ],
        description="Template sales.v1 — draft até approved_to_publish.",
    ),
]


def ensure_seed_contracts(data_dir: Path) -> List[dict]:
    """Cria templates canónicos se ainda não existirem (não sobrescreve)."""
    created: List[dict] = []
    for seed in SEED_CONTRACTS:
        cid, ver = seed["contract_id"], seed["version"]
        if load_contract(data_dir, cid, ver):
            continue
        doc = dict(seed)
        if doc.get("status") == "published":
            doc["approvals"] = [
                {
                    "at": _now_iso(),
                    "actor": "knowt.seed",
                    "note": "publicado no seed do piloto (orders mínimo validado por API)",
                }
            ]
        created.append(save_contract(data_dir, doc))
    _refresh_index(data_dir)
    return created


def set_contract_status(
    data_dir: Path,
    contract_id: str,
    version: str,
    *,
    status: str,
    actor: str = "operator",
    note: str = "",
) -> dict:
    doc = load_contract(data_dir, contract_id, version)
    if not doc:
        raise KeyError(f"{contract_id}@{version}")
    status = (status or "").strip().lower()
    if status not in ("draft", "approved", "published", "deprecated"):
        raise ValueError("invalid_contract_status")
    doc["status"] = status
    approvals = list(doc.get("approvals") or [])
    approvals.append(
        {
            "id": str(uuid.uuid4()),
            "at": _now_iso(),
            "actor": actor,
            "status": status,
            "note": note,
        }
    )
    doc["approvals"] = approvals
    return save_contract(data_dir, doc)


def contracts_summary(data_dir: Path) -> Dict[str, Any]:
    rows = list_contracts(data_dir)
    by_status: Dict[str, int] = {}
    for c in rows:
        st = str(c.get("status") or "draft")
        by_status[st] = by_status.get(st, 0) + 1
    return {
        "count": len(rows),
        "by_status": by_status,
        "contracts": [
            {
                "contract_id": c.get("contract_id"),
                "version": c.get("version"),
                "status": c.get("status"),
                "domain": c.get("domain"),
                "hash": c.get("hash"),
            }
            for c in rows
        ],
    }
