"""Discovery stub — estrutura de dossiê, sem transformar hipótese em fato."""
from __future__ import annotations

from knowt.models import DiscoveryReport
from knowt.sources import SourceRegistry
from knowt.vault import VaultError, has_secret, public_ref_status


def run_discovery_stub(registry: SourceRegistry, source_id: str) -> DiscoveryReport:
    src = registry.get(source_id)
    if not src:
        return DiscoveryReport(
            source_id=source_id,
            status="blocked",
            blocked_reasons=["SOURCE_NOT_FOUND"],
        )

    evidence: list[str] = [f"source_registered:{src.source_id}:{src.system}"]
    hypotheses: list[str] = [
        "API ou outro canal pode existir — ainda não validado",
    ]
    blocked: list[str] = []

    for name, ref in (src.secret_refs or {}).items():
        st = public_ref_status(ref)
        evidence.append(f"secret_ref:{name}:{'present' if st.get('present') else 'missing'}")
        if not st.get("present"):
            blocked.append(f"SECRET_MISSING:{name}")

    if blocked:
        return DiscoveryReport(
            source_id=source_id,
            status="blocked",
            evidence=evidence,
            hypotheses=hypotheses,
            blocked_reasons=blocked,
        )

    # Segredos presentes ≠ compreensão. Mantém stub até pipeline real.
    evidence.append("credentials_resolvable")
    hypotheses.append(
        "Com token presente, o passo seguinte é probe seguro da API (não implementado no MVP 0)"
    )
    return DiscoveryReport(
        source_id=source_id,
        status="stub",
        evidence=evidence,
        hypotheses=hypotheses,
        blocked_reasons=["DISCOVERY_PIPELINE_NOT_IMPLEMENTED"],
    )


def assert_no_silent_truth(report: DiscoveryReport) -> None:
    """Gates de teste: stub/blocked não pode marcar hipóteses como validadas."""
    if report.status in ("stub", "blocked") and not report.blocked_reasons:
        raise AssertionError("relatório incompleto sem blocked_reasons")
    _ = has_secret  # noqa: F841 — API pública reutilizável
    _ = VaultError
