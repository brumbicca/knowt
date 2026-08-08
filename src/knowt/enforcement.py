"""Enforcement de chat — sem capability live não vira fato (zero verdade silenciosa)."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Tuple

from knowt.models import Capability
from knowt.sources import SourceRegistry

# (capability_id preferida, padrões)
_INTENT_RULES: List[Tuple[str, Tuple[str, ...]]] = [
    (
        "sales.summary",
        (
            r"\bvendas?\b",
            r"\bfaturamento\b",
            r"\breceita\b",
            r"\bsales?\b",
        ),
    ),
    (
        "orders.list",
        (
            r"\bpedidos?\b",
            r"\borders?\b",
        ),
    ),
]


@dataclass
class EnforcementResult:
    allow_llm: bool
    mode: str  # fact | refuse | catalog
    message: str
    capability_id: Optional[str] = None
    reason_code: Optional[str] = None
    source_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def classify_intent(text: str) -> Optional[str]:
    msg = (text or "").strip().lower()
    if not msg:
        return None
    for cap_id, patterns in _INTENT_RULES:
        for pat in patterns:
            if re.search(pat, msg, flags=re.I):
                return cap_id
    return None


def enforce(
    registry: SourceRegistry,
    *,
    message: str,
    source_id: str,
) -> EnforcementResult:
    src = registry.get(source_id)
    if not src:
        return EnforcementResult(
            allow_llm=False,
            mode="refuse",
            message="Fonte desconhecida. Sem fonte validada não há resposta factual.",
            reason_code="SOURCE_NOT_FOUND",
            source_id=source_id,
        )

    cap_id = classify_intent(message)
    if not cap_id:
        return EnforcementResult(
            allow_llm=True,
            mode="catalog",
            message=(
                "Pergunta fora dos domínios com regras de capability neste MVP. "
                "Posso falar do catálogo/estado da fonte, não inventar métricas."
            ),
            source_id=source_id,
            reason_code="NO_DOMAIN_MATCH",
        )

    cap: Optional[Capability] = registry.get_capability(source_id, cap_id)
    if not cap or cap.status != "live":
        return EnforcementResult(
            allow_llm=False,
            mode="refuse",
            message=(
                f"A capacidade `{cap_id}` ainda não está publicada como live "
                f"para `{source_id}`. Não transformo hipótese em fato."
            ),
            capability_id=cap_id,
            reason_code="CAPABILITY_UNAVAILABLE",
            source_id=source_id,
        )

    if cap.quality != "machine_validated":
        return EnforcementResult(
            allow_llm=True,
            mode="estimate",
            message=(
                f"`{cap_id}` está live com qualidade `{cap.quality}` — "
                "respostas devem ser marcadas como estimativa, não fato."
            ),
            capability_id=cap_id,
            reason_code="QUALITY_BELOW_FACT",
            source_id=source_id,
        )

    return EnforcementResult(
        allow_llm=True,
        mode="fact",
        message=f"Capability `{cap_id}` live e machine_validated — pode responder como fato.",
        capability_id=cap_id,
        reason_code="OK",
        source_id=source_id,
    )
