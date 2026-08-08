"""Publicação explícita de capabilities (não automática no discovery)."""
from __future__ import annotations

from knowt.models import Capability
from knowt.sources import SourceRegistry


def set_capability_status(
    registry: SourceRegistry,
    *,
    source_id: str,
    capability_id: str,
    status: str,
    quality: str,
    description: str | None = None,
) -> Capability:
    src = registry.get(source_id)
    if not src:
        raise KeyError(source_id)
    found = None
    for cap in src.capabilities:
        if cap.id == capability_id:
            cap.status = status  # type: ignore[assignment]
            cap.quality = quality  # type: ignore[assignment]
            if description is not None:
                cap.description = description
            found = cap
            break
    if found is None:
        found = Capability(
            id=capability_id,
            domain=capability_id.split(".", 1)[0],
            status=status,  # type: ignore[arg-type]
            quality=quality,  # type: ignore[arg-type]
            description=description or "",
        )
        src.capabilities.append(found)
    registry.upsert(src)
    return found


def publish_orders_list_live(registry: SourceRegistry, source_id: str = "tinyerp") -> Capability:
    return set_capability_status(
        registry,
        source_id=source_id,
        capability_id="orders.list",
        status="live",
        quality="machine_validated",
        description=(
            "Lista/página de pedidos Tiny v2 (pedidos.pesquisa) — "
            "contagem e ids da página; sem margem/CMV"
        ),
    )
