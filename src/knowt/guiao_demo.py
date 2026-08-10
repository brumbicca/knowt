"""Helpers do guião demo Tiny (T7/T9/T11) — extração e checks sem rede."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional


GUIAO_STEPS: List[Dict[str, Any]] = [
    {
        "id": "catalog",
        "message": "o que podes consultar?",
        "tone": "default",
        "engine": "deterministic",
    },
    {
        "id": "pedidos_semana",
        "message": "Pedidos esta semana",
        "tone": "casual",
        "engine": "deterministic",
        "recon_periodo": "semana",
    },
    {
        "id": "situacao_semana",
        "message": "pedidos por situação esta semana",
        "tone": "casual",
        "engine": "deterministic",
    },
    {
        "id": "receita_bloqueada",
        "message": "qual a receita desta semana?",
        "tone": "default",
        "engine": "deterministic",
    },
    {
        "id": "discovery",
        "message": "o que já conhecemos do Tiny?",
        "tone": "casual",
        "engine": "deterministic",
    },
]


def extract_pedidos_count(text: str) -> Optional[int]:
    """Extrai contagem de pedidos de respostas knowt típicas."""
    raw = text or ""
    patterns = [
        r"(?:há|tem|foram)\s+\*?\*?(\d{1,3}(?:\.\d{3})*|\d+)\*?\*?\s+pedidos?",
        r"\*?\*?(\d{1,3}(?:\.\d{3})*|\d+)\*?\*?\s+pedidos?\b",
        r"Indicador[^\n]*Pedidos[^\n]*\n[^\n]*?(\d{1,3}(?:\.\d{3})*|\d+)",
        r"\|\s*Pedidos\s*\|\s*(\d{1,3}(?:\.\d{3})*|\d+)\s*\|",
    ]
    for pat in patterns:
        m = re.search(pat, raw, flags=re.I)
        if m:
            return int(m.group(1).replace(".", ""))
    return None


def check_catalog(reply: str, enf: dict) -> List[str]:
    errs: List[str] = []
    blob = (reply or "") + " " + str(enf.get("message") or "")
    low = blob.lower()
    if "orders.list" not in low and "pedidos" not in low:
        errs.append("catalog_missing_orders")
    if enf.get("reason_code") not in (None, "CATALOG", "NO_DOMAIN_MATCH", "OK"):
        # catalog mode is fine
        if enf.get("mode") not in ("catalog", "fact"):
            errs.append(f"catalog_unexpected_mode:{enf.get('mode')}")
    return errs


def check_pedidos_recon(reply: str, bridge_n: int) -> List[str]:
    errs: List[str] = []
    n = extract_pedidos_count(reply)
    if n is None:
        errs.append("pedidos_count_not_found_in_reply")
        return errs
    if int(bridge_n) != int(n):
        errs.append(f"pedidos_mismatch_chat={n}_bridge={bridge_n}")
    return errs


def check_situacao(reply: str, enf: dict, html: str = "") -> List[str]:
    errs: List[str] = []
    blob = (reply or "") + "\n" + (html or "")
    if "situa" not in blob.lower() and "Situação" not in blob:
        errs.append("situacao_label_missing")
    # pelo menos um número de pedidos no breakdown
    if not re.search(r"\d+\s*pedidos?", blob, flags=re.I) and extract_pedidos_count(blob) is None:
        # tabela pode ter só totais por linha
        if not re.search(r"\|\s*\d+\s*\|", blob):
            errs.append("situacao_rows_missing")
    if enf.get("capability_id") not in (None, "orders.list"):
        if enf.get("reason_code") == "CAPABILITY_UNAVAILABLE":
            errs.append("situacao_capability_unavailable")
    return errs


def check_receita_blocked(reply: str, enf: dict) -> List[str]:
    errs: List[str] = []
    if enf.get("reason_code") != "CAPABILITY_UNAVAILABLE" and enf.get("mode") != "refuse":
        # algumas respostas incluem mensagem sem reason exact
        low = (reply or "").lower()
        if "não" not in low and "nao" not in low:
            errs.append("receita_not_refused")
        if "live" not in low and "publicad" not in low and "dispon" not in low:
            if enf.get("reason_code") != "CAPABILITY_UNAVAILABLE":
                errs.append(f"receita_unexpected_code:{enf.get('reason_code')}")
    # não pode inventar montante em R$
    if re.search(r"R\$\s*\d", reply or ""):
        errs.append("receita_invented_brl")
    return errs


def check_discovery(reply: str, enf: dict) -> List[str]:
    errs: List[str] = []
    code = enf.get("reason_code")
    cap = enf.get("capability_id")
    low = (reply or "").lower()
    if code != "DISCOVERY_OBSERVATION" and cap != "discovery.dossier":
        if "dossi" not in low and "discovery" not in low and "conhec" not in low:
            errs.append(f"discovery_unexpected:{code}/{cap}")
    if len((reply or "").strip()) < 40:
        errs.append("discovery_reply_too_short")
    return errs
