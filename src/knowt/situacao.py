"""Mapeamento leve situacao Tiny a partir de pt-BR no chat."""
from __future__ import annotations

import re
from typing import List, Optional, Tuple

# (label humana, valor API Tiny aproximado)
_RULES: Tuple[Tuple[str, str, str], ...] = (
    (r"\bcancelad", "cancelado", "cancelado"),
    (r"\baprovad", "aprovado", "aprovado"),
    (r"\babert", "aberto", "aberto"),
    (r"\bpreparad", "preparado", "preparado"),
    (r"\bfaturad", "faturado", "faturado"),
    (r"\benviad(?!o\s+para)", "enviado", "enviado"),
    (r"\bentregu", "entregue", "entregue"),
    (r"\bpronto\s*(?:para\s*)?envio|pronto_envio", "pronto_envio", "pronto_envio"),
)

# Contagens usadas no breakdown (ordem de exibição).
BREAKDOWN_SITUACOES: List[Tuple[str, str]] = [
    ("aberto", "aberto"),
    ("aprovado", "aprovado"),
    ("faturado", "faturado"),
    ("preparado", "preparado"),
    ("enviado", "enviado"),
    ("entregue", "entregue"),
    ("cancelado", "cancelado"),
]

_BREAKDOWN_PATTERNS = (
    r"\bpor\s+situa",
    r"\bdistribui",
    r"\bbreakdown\b",
    r"\bresumo\b",
    r"\bquebra\b",
)


def parse_situacao(text: str) -> Optional[Tuple[str, str]]:
    """Devolve (label, valor_api) ou None."""
    msg = (text or "").strip().lower()
    if not msg:
        return None
    for pat, label, api_val in _RULES:
        if re.search(pat, msg, flags=re.I):
            return label, api_val
    return None


def wants_situacao_breakdown(text: str) -> bool:
    """True quando o utilizador pede distribuição / resumo por situação."""
    msg = (text or "").strip().lower()
    if not msg:
        return False
    return any(re.search(p, msg, flags=re.I) for p in _BREAKDOWN_PATTERNS)
