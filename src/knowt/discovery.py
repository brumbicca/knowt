"""Discovery — stub + probe Tiny quando houver secret (sem publicar live)."""
from __future__ import annotations

from knowt.models import DiscoveryReport
from knowt.sources import SourceRegistry
from knowt.tiny_probe import probe_tiny_v2_orders
from knowt.vault import VaultError, has_secret, public_ref_status, resolve_secret


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
        "API Tiny pode existir — validação só com probe explícito",
    ]
    blocked: list[str] = []

    for name, ref in (src.secret_refs or {}).items():
        st = public_ref_status(ref)
        evidence.append(
            f"secret_ref:{name}:{'present' if st.get('present') else 'missing'}"
        )
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

    evidence.append("credentials_resolvable")

    if src.system == "tiny-erp" or source_id == "tinyerp":
        ref = (src.secret_refs or {}).get("api_token") or "KNOWT_SECRET_TINY_TOKEN"
        token = resolve_secret(ref, required=True)
        probe = probe_tiny_v2_orders(token)
        evidence.append(
            "tiny_probe:ok=%s:http=%s:status=%s:reason=%s"
            % (probe.ok, probe.http_status, probe.tinystatus, probe.reason_code)
        )
        if not probe.ok:
            return DiscoveryReport(
                source_id=source_id,
                status="blocked",
                evidence=evidence,
                hypotheses=hypotheses,
                blocked_reasons=[f"TINY_PROBE_FAILED:{probe.reason_code}"],
            )
        hypotheses.append(
            "Token Tiny válido para pedidos.pesquisa — capabilities continuam "
            "unavailable até publicação/validação de negócio"
        )
        return DiscoveryReport(
            source_id=source_id,
            status="complete",
            evidence=evidence,
            hypotheses=hypotheses,
            blocked_reasons=["CAPABILITIES_NOT_PUBLISHED"],
        )

    hypotheses.append(
        "Com secret presente, o próximo passo é probe do sistema (não Tiny)"
    )
    return DiscoveryReport(
        source_id=source_id,
        status="stub",
        evidence=evidence,
        hypotheses=hypotheses,
        blocked_reasons=["DISCOVERY_PIPELINE_NOT_IMPLEMENTED"],
    )


def assert_no_silent_truth(report: DiscoveryReport) -> None:
    if report.status in ("stub", "blocked") and not report.blocked_reasons:
        raise AssertionError("relatório incompleto sem blocked_reasons")
    _ = has_secret
    _ = VaultError
