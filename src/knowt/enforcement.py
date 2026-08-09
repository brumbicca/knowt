"""Enforcement de chat — sem capability live não vira fato (zero verdade silenciosa)."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Tuple

from knowt.models import Capability
from knowt.order_id import extract_order_id
from knowt.sources import SourceRegistry

# (capability_id preferida, padrões) — ordem importa
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
            r"\bpor\s+situa",
            r"\bdistribui",
            r"\bbreakdown\b",
        ),
    ),
]

_CATALOG_PATTERNS = (
    r"\bcat[aá]logo\b",
    r"\bcapabilities?\b",
    r"\bo\s+que\s+(?:podes|consegues|sabes)\b",
    r"\bo\s+que\s+(?:est[aá]|fica)\s+(?:live|publicado)\b",
    r"\bquais\s+(?:perguntas|dados)\b",
)


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


def wants_catalog(text: str) -> bool:
    msg = (text or "").strip().lower()
    if not msg:
        return False
    return any(re.search(p, msg, flags=re.I) for p in _CATALOG_PATTERNS)


_DISCOVERY_DOSSIER_PATTERNS = (
    r"\bdiscovery\b",
    r"\bdossi[eê]\b",
    r"\binvent[aá]rio\b",
    r"\bo\s+que\s+j[aá]\s+conhec",
    r"\bo\s+que\s+conhecemos\b",
    r"\bconhecemos\s+do\s+tiny\b",
    r"\bmapa\s+do\s+(?:sistema|erp|tiny)\b",
    r"\bplaywright\b",
)


def wants_discovery_dossier(text: str) -> bool:
    msg = (text or "").strip().lower()
    if not msg:
        return False
    if wants_catalog(msg):
        return False
    return any(re.search(p, msg, flags=re.I) for p in _DISCOVERY_DOSSIER_PATTERNS)


def classify_intent(text: str) -> Optional[str]:
    msg = (text or "").strip().lower()
    if not msg:
        return None
    if extract_order_id(msg):
        return "orders.detail"
    if wants_catalog(msg):
        return None  # tratado como catalog no enforce
    for cap_id, patterns in _INTENT_RULES:
        for pat in patterns:
            if re.search(pat, msg, flags=re.I):
                return cap_id
    return None


def format_source_catalog(registry: SourceRegistry, source_id: str) -> str:
    src = registry.get(source_id)
    if not src:
        return "Fonte desconhecida."
    lines = [f"Fonte `{source_id}` ({src.system}) · estado `{src.status}`:"]
    for cap in sorted(src.capabilities, key=lambda c: c.id):
        lines.append(
            f"- `{cap.id}` → **{cap.status}** / {cap.quality}"
            + (f" — {cap.description}" if cap.description else "")
        )
    lines.append(
        "Posso responder como fato só o que está **live** + "
        "`machine_validated`. Vendas/margem ficam bloqueadas até validação."
    )
    lines.append(
        "Exemplos: «pedidos esta semana», «pedidos cancelados últimos 7 dias», "
        "«resumo de pedidos esta semana», «pedido 752095868», "
        "«o que já conhecemos do Tiny?», «cria uma tarefa Revisar Tiny», "
        "«agenda call amanhã às 15h»."
    )
    return "\n".join(lines)


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

    if wants_catalog(message):
        return EnforcementResult(
            allow_llm=True,
            mode="catalog",
            message=format_source_catalog(registry, source_id),
            source_id=source_id,
            reason_code="CATALOG",
        )

    cap_id = classify_intent(message)
    if not cap_id:
        return EnforcementResult(
            allow_llm=True,
            mode="catalog",
            message=(
                format_source_catalog(registry, source_id)
                + "\nPergunta fora dos domínios com regras neste MVP — "
                "não invento métricas."
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
