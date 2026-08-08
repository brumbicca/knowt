"""Registry de fontes (single-tenant MVP; persistência JSON local)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional

from knowt.models import Capability, Source


class SourceRegistry:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._sources: Dict[str, Source] = {}
        self.load()

    def load(self) -> None:
        if not self.path.exists():
            self._sources = {}
            return
        raw = json.loads(self.path.read_text(encoding="utf-8"))
        sources = {}
        for item in raw.get("sources") or []:
            caps = [
                Capability(**c) if isinstance(c, dict) else c
                for c in (item.get("capabilities") or [])
            ]
            item = dict(item)
            item["capabilities"] = caps
            src = Source(**{k: item[k] for k in Source.__dataclass_fields__ if k in item})
            sources[src.source_id] = src
        self._sources = sources

    def save(self) -> None:
        payload = {"sources": [s.to_dict() for s in self._sources.values()]}
        self.path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    def upsert(self, source: Source) -> Source:
        self._sources[source.source_id] = source
        self.save()
        return source

    def get(self, source_id: str) -> Optional[Source]:
        return self._sources.get(source_id)

    def list(self, org_id: Optional[str] = None) -> List[Source]:
        rows = list(self._sources.values())
        if org_id:
            rows = [s for s in rows if s.org_id == org_id]
        return sorted(rows, key=lambda s: s.source_id)

    def get_capability(self, source_id: str, capability_id: str) -> Optional[Capability]:
        src = self.get(source_id)
        if not src:
            return None
        for cap in src.capabilities:
            if cap.id == capability_id:
                return cap
        return None


def seed_tiny_draft(registry: SourceRegistry, *, org_id: str = "default") -> Source:
    """Regista piloto Tiny como draft — sem capability live até validação."""
    existing = registry.get("tinyerp")
    if existing:
        return existing
    src = Source(
        source_id="tinyerp",
        system="tiny-erp",
        org_id=org_id,
        status="draft",
        secret_refs={"api_token": "KNOWT_SECRET_TINY_TOKEN"},
        capabilities=[
            Capability(
                id="sales.summary",
                domain="sales",
                status="unavailable",
                quality="unknown",
                description="Resumo de vendas — só live após discovery+validação",
            ),
            Capability(
                id="orders.list",
                domain="orders",
                status="unavailable",
                quality="unknown",
                description="Lista de pedidos — só live após discovery+validação",
            ),
            Capability(
                id="orders.detail",
                domain="orders",
                status="unavailable",
                quality="unknown",
                description="Detalhe de pedido — só live após discovery+validação",
            ),
        ],
        notes="Piloto knowt (narrativa distinta do bi_tinyerp Fiesta).",
    )
    return registry.upsert(src)
