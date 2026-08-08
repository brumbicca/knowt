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


def publish_orders_detail_live(
    registry: SourceRegistry, source_id: str = "tinyerp"
) -> Capability:
    return set_capability_status(
        registry,
        source_id=source_id,
        capability_id="orders.detail",
        status="live",
        quality="machine_validated",
        description=(
            "Detalhe de um pedido Tiny v2 (pedido.obter) — "
            "situação, itens e total da Tiny; sem CMV/margem recalculada"
        ),
    )


def ensure_tiny_capability_slots(
    registry: SourceRegistry, source_id: str = "tinyerp"
) -> None:
    """Garante slots sales/orders no registry sem demover o que já está live."""
    src = registry.get(source_id)
    if not src:
        return
    wanted = {
        "sales.summary": (
            "sales",
            "Resumo de vendas — só live após discovery+validação",
        ),
        "orders.list": (
            "orders",
            "Lista de pedidos — só live após discovery+validação",
        ),
        "orders.detail": (
            "orders",
            "Detalhe de pedido — só live após discovery+validação",
        ),
    }
    have = {c.id for c in src.capabilities}
    changed = False
    for cap_id, (domain, desc) in wanted.items():
        if cap_id in have:
            continue
        src.capabilities.append(
            Capability(
                id=cap_id,
                domain=domain,
                status="unavailable",
                quality="unknown",
                description=desc,
            )
        )
        changed = True
    if changed:
        registry.upsert(src)
