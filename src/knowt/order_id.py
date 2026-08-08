"""Extrai id Tiny de perguntas do tipo «pedido 752095868» / «detalhe do pedido …»."""
from __future__ import annotations

import re
from typing import Optional


def extract_order_id(text: str) -> Optional[str]:
    msg = (text or "").strip()
    if not msg:
        return None
    patterns = (
        r"\bpedidos?\s+(?:n[ºo°.]?\s*)?#?\s*(\d{5,})\b",
        r"\b(?:detalhe|consulta|obter|abre|mostra)\s+(?:do\s+)?pedidos?\s+#?\s*(\d{5,})\b",
        r"\bid\s+(?:do\s+)?pedidos?\s+#?\s*(\d{5,})\b",
        r"\b#(\d{5,})\b",
    )
    for pat in patterns:
        m = re.search(pat, msg, flags=re.I)
        if m:
            return m.group(1)
    return None
