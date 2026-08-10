"""Organizações (tenancy) — MVP: 1 org piloto + API de listagem.

Persistência: Mongo `orgs` se disponível; senão JSON em data_dir/orgs.json.
"""
from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class Org:
    org_id: str
    name: str
    status: str = "active"  # active | suspended
    product: str = "knowt"
    notes: str = ""
    created_at: str = ""
    meta: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def default_org_id() -> str:
    return (os.environ.get("KNOWT_ORG_ID") or "default").strip() or "default"


class OrgRegistry:
    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.path = self.data_dir / "orgs.json"
        self._orgs: Dict[str, Org] = {}
        self.load()

    def load(self) -> None:
        # Prefer Mongo se ping OK
        from knowt.mongo import get_client, mongo_db_name, ping_mongo

        mongo = ping_mongo()
        if mongo.get("ok"):
            try:
                client = get_client()
                if client is not None:
                    rows = list(client[mongo_db_name()]["orgs"].find({}, {"_id": 0}))
                    if rows:
                        self._orgs = {
                            r["org_id"]: Org(**{k: r[k] for k in Org.__dataclass_fields__ if k in r})
                            for r in rows
                            if r.get("org_id")
                        }
                        return
            except Exception:
                pass
        if not self.path.exists():
            self._orgs = {}
            return
        raw = json.loads(self.path.read_text(encoding="utf-8"))
        orgs = {}
        for item in raw.get("orgs") or []:
            if not item.get("org_id"):
                continue
            orgs[item["org_id"]] = Org(
                **{k: item[k] for k in Org.__dataclass_fields__ if k in item}
            )
        self._orgs = orgs

    def save(self) -> None:
        payload = {"orgs": [o.to_dict() for o in self._orgs.values()]}
        self.path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        from knowt.mongo import get_client, mongo_db_name, ping_mongo

        if not ping_mongo().get("ok"):
            return
        try:
            client = get_client()
            if client is None:
                return
            col = client[mongo_db_name()]["orgs"]
            for org in self._orgs.values():
                col.update_one(
                    {"org_id": org.org_id},
                    {"$set": org.to_dict()},
                    upsert=True,
                )
        except Exception:
            pass

    def upsert(self, org: Org) -> Org:
        if not org.created_at:
            org.created_at = _now()
        self._orgs[org.org_id] = org
        self.save()
        return org

    def get(self, org_id: str) -> Optional[Org]:
        return self._orgs.get(org_id)

    def list(self) -> List[Org]:
        return sorted(self._orgs.values(), key=lambda o: o.org_id)


def seed_default_org(registry: OrgRegistry, *, org_id: Optional[str] = None) -> Org:
    oid = (org_id or default_org_id()).strip() or "default"
    existing = registry.get(oid)
    if existing:
        return existing
    return registry.upsert(
        Org(
            org_id=oid,
            name="knowt piloto",
            status="active",
            notes="Org single-tenant do piloto Tiny. Multi-org SaaS vem depois.",
            created_at=_now(),
            meta={"piloto": "tinyerp"},
        )
    )


def assert_source_in_org(source_org_id: str, request_org_id: str) -> bool:
    return (source_org_id or "default") == (request_org_id or "default")
