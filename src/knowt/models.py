"""Modelos mínimos do registry (sem inferir significado de negócio)."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Literal, Optional

CapabilityStatus = Literal["live", "unavailable", "pending"]
Quality = Literal["machine_validated", "estimate", "unknown"]


@dataclass
class Capability:
    id: str
    domain: str
    status: CapabilityStatus = "unavailable"
    quality: Quality = "unknown"
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Source:
    source_id: str
    system: str
    org_id: str = "default"
    status: str = "draft"  # draft | active | suspended
    secret_refs: Dict[str, str] = field(default_factory=dict)
    capabilities: List[Capability] = field(default_factory=list)
    notes: str = ""
    kill_switch_reason: Optional[str] = None
    kill_switch_at: Optional[str] = None
    kill_switch_actor: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        return d


@dataclass
class DiscoveryReport:
    source_id: str
    status: Literal["stub", "running", "complete", "blocked"]
    evidence: List[str] = field(default_factory=list)
    hypotheses: List[str] = field(default_factory=list)
    blocked_reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
