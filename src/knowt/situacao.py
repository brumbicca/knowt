"""Mapeamento leve situacao Tiny a partir de pt-BR no chat."""
from __future__ import annotations

import re
from typing import Optional, Tuple

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


def parse_situacao(text: str) -> Optional[Tuple[str, str]]:
    """Devolve (label, valor_api) ou None."""
    msg = (text or "").strip().lower()
    if not msg:
        return None
    for pat, label, api_val in _RULES:
        if re.search(pat, msg, flags=re.I):
            return label, api_val
    return None
