"""Catálogo de reason codes (plano §8 / Fase 5) — knowt.

`blocks_publish`: se True, não marcar capability como machine_validated/live.
"""
from __future__ import annotations

from typing import Any, Dict

REASON_CODES: Dict[str, Dict[str, Any]] = {
    "OK": {
        "severity": "info",
        "blocks_publish": False,
        "description_pt": "Operação dentro do esperado.",
    },
    "SOURCE_SUSPENDED": {
        "severity": "critical",
        "blocks_publish": True,
        "description_pt": "Kill switch activo — fonte não consultável.",
    },
    "CAPABILITY_UNAVAILABLE": {
        "severity": "error",
        "blocks_publish": True,
        "description_pt": "Capability não publicada como live.",
    },
    "CHAT_CAPABILITY_UNAVAILABLE": {
        "severity": "error",
        "blocks_publish": True,
        "description_pt": "Chat recusou claim — capability unavailable.",
    },
    "QUALITY_BELOW_FACT": {
        "severity": "warning",
        "blocks_publish": False,
        "description_pt": "Qualidade abaixo de machine_validated — só estimativa.",
    },
    "FIELD_GAP_REQUIRED": {
        "severity": "error",
        "blocks_publish": True,
        "description_pt": "Campo obrigatório do contrato ausente na amostra.",
    },
    "NO_BASELINE_DRIFT": {
        "severity": "info",
        "blocks_publish": False,
        "description_pt": "Sem baseline de drift — criado neste check.",
    },
    "FIELD_SET_CHANGED": {
        "severity": "warning",
        "blocks_publish": False,
        "description_pt": "Conjunto de campos da amostra mudou vs baseline.",
    },
    "CONTRACT_FIELD_MISSING": {
        "severity": "error",
        "blocks_publish": True,
        "description_pt": "Amostra não cobre campo obrigatório do contrato published.",
    },
    "CONTRACT_BREAK": {
        "severity": "critical",
        "blocks_publish": True,
        "description_pt": "Quebra de contrato — amostra incompatível com versão published.",
    },
    "RECON_SAMPLE_EMPTY": {
        "severity": "warning",
        "blocks_publish": False,
        "description_pt": "Amostra de reconciliação vazia (não tratar como zero).",
    },
    "API_UNREACHABLE": {
        "severity": "error",
        "blocks_publish": True,
        "description_pt": "API da fonte inacessível no check de drift.",
    },
    "MARGIN_RULE_NOT_VALIDATED": {
        "severity": "warning",
        "blocks_publish": True,
        "description_pt": "Regra de margem/CMV ainda sem validação de negócio.",
    },
    "CONTRACT_PUBLISHED": {
        "severity": "info",
        "blocks_publish": False,
        "description_pt": "Contrato canónico published no registry.",
    },
    "KILL_SWITCH_ON": {
        "severity": "critical",
        "blocks_publish": True,
        "description_pt": "Operador activou kill switch da fonte.",
    },
    "KILL_SWITCH_OFF": {
        "severity": "info",
        "blocks_publish": False,
        "description_pt": "Operador reactivou a fonte.",
    },
}


def reason_payload(code: str, **extra: Any) -> Dict[str, Any]:
    meta = REASON_CODES.get(code) or {
        "severity": "warning",
        "blocks_publish": False,
        "description_pt": code,
    }
    out = {"code": code, **meta}
    out.update(extra)
    return out
