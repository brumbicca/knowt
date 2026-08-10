"""Mapeamento leve situacao Tiny a partir de pt-BR no chat.

Valores de filtro validados na API 2.0 ``pedidos.pesquisa`` (piloto Tiny):
aberto, aprovado, cancelado, faturado, enviado, entregue,
preparando_envio, pronto_envio, dados_incompletos, nao_entregue.
``preparado`` sozinho a API rejeita/esvazia — usar ``preparando_envio``.
"""
from __future__ import annotations

import re
from typing import List, Optional, Tuple

# (padrão texto, label humana, valor API Tiny)
_RULES: Tuple[Tuple[str, str, str], ...] = (
    (r"\bcancelad", "cancelado", "cancelado"),
    (r"\baprovad", "aprovado", "aprovado"),
    (r"\bdados\s*incomplet", "dados incompletos", "dados_incompletos"),
    (r"\bn[aã]o\s*entreg", "não entregue", "nao_entregue"),
    (r"\bprontos?\s*(?:para\s*)?envio|pronto_envio", "pronto para envio", "pronto_envio"),
    (r"\bpreparand|\bpreparad", "preparando envio", "preparando_envio"),
    (r"\bfaturad", "faturado", "faturado"),
    (r"\benviad(?!o\s+para)", "enviado", "enviado"),
    (r"\bentregu", "entregue", "entregue"),
    (r"\babert|em\s+aberto", "em aberto", "aberto"),
)

# Contagens usadas no breakdown (ordem de exibição) — label, api.
BREAKDOWN_SITUACOES: List[Tuple[str, str]] = [
    ("em aberto", "aberto"),
    ("aprovado", "aprovado"),
    ("dados incompletos", "dados_incompletos"),
    ("faturado", "faturado"),
    ("preparando envio", "preparando_envio"),
    ("pronto para envio", "pronto_envio"),
    ("enviado", "enviado"),
    ("entregue", "entregue"),
    ("cancelado", "cancelado"),
    ("não entregue", "nao_entregue"),
]

_BREAKDOWN_PATTERNS = (
    r"\bpor\s+situa",
    r"\bdistribui",
    r"\bbreakdown\b",
    r"\bresumo\b",
    r"\bquebra\b",
    r"\bdetalhe\s+por\s+situa",
    r"\bsitua[cç][oõ]es\b",
    # follow-ups curtos pós «pedidos esta semana»
    r"^\s*(?:ok|certo|sim)[,!.]?\s*(?:por\s+situa|situa)",
    r"^\s*por\s+situa",
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
