"""Gates de negócio para publication de sales.summary (knowt).

Nunca publicamos live sem checklist preenchido + approved_to_publish.
Espelha o espírito do §28c.1 Fiesta — adaptação narrativa knowt.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

GATES_FILENAME = "sales_summary_gates.json"

REQUIRED_ANSWERS = (
    "cost_field",  # preco_custo | preco_custo_medio | defer
    "matches_official_report",  # yes | no | unknown
    "missing_cost_policy",  # exclude | zero | block_metric
    "cmv_composition_ok",  # product_only | includes_tax_freight | unknown
)


def gates_path(data_dir: Path) -> Path:
    return Path(data_dir) / GATES_FILENAME


def default_gates() -> Dict[str, Any]:
    return {
        "version": 1,
        "capability": "sales.summary",
        "answers": {k: None for k in REQUIRED_ANSWERS},
        "approved_to_publish": False,
        "approver": None,
        "notes": (
            "Preencher após o Time responder o pacote de negócio. "
            "Sem approved_to_publish=true a capability permanece unavailable."
        ),
    }


def load_gates(data_dir: Path) -> Dict[str, Any]:
    path = gates_path(data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.is_file():
        data = default_gates()
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return data
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        raw = default_gates()
        path.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return raw
    # ensure keys
    base = default_gates()
    answers = dict(base["answers"])
    answers.update((raw.get("answers") or {}) if isinstance(raw.get("answers"), dict) else {})
    return {
        **base,
        **{k: raw.get(k, base.get(k)) for k in base},
        "answers": answers,
        "approved_to_publish": bool(raw.get("approved_to_publish")),
    }


def save_gates(data_dir: Path, data: Dict[str, Any]) -> Dict[str, Any]:
    path = gates_path(data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return data


def missing_gate_fields(gates: Dict[str, Any]) -> List[str]:
    answers = gates.get("answers") or {}
    missing = [k for k in REQUIRED_ANSWERS if not answers.get(k)]
    if not gates.get("approved_to_publish"):
        missing.append("approved_to_publish")
    if gates.get("approved_to_publish") and not (gates.get("approver") or "").strip():
        missing.append("approver")
    return missing


def can_publish_sales_summary(data_dir: Path) -> tuple[bool, List[str]]:
    gates = load_gates(data_dir)
    missing = missing_gate_fields(gates)
    return (len(missing) == 0, missing)
