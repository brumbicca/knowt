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
        from knowt.tiny_order_detail import fetch_order_detail
        from knowt.tiny_orders import fetch_orders_page

        page = fetch_orders_page(token, page=1)
        sample_id = page.order_ids[0] if page.ok and page.order_ids else None
        if sample_id:
            det = fetch_order_detail(token, sample_id)
            evidence.append(
                "tiny_pedido_obter:ok=%s:id=%s:reason=%s:situacao=%s"
                % (det.ok, sample_id, det.reason_code, det.situacao)
            )
            if det.ok:
                hypotheses.append(
                    "pedido.obter responde para id amostral — candidata a "
                    "orders.detail após publish explícito"
                )
            else:
                hypotheses.append(
                    f"pedido.obter falhou ({det.reason_code}) — "
                    "não publicar orders.detail"
                )
        else:
            evidence.append("tiny_pedido_obter:skipped_no_sample_id")

        # Evidência UI (Playwright) se já corrida — não bloqueia nem publica.
        from knowt.config import Settings
        from knowt.discovery_ui import has_storage_state, load_latest_product_cost_probe

        data_dir = Settings.from_env().data_dir
        if has_storage_state(data_dir, source_id):
            evidence.append("ui_storage_state:present")
        else:
            evidence.append("ui_storage_state:missing")
        ui = load_latest_product_cost_probe(data_dir)
        if ui:
            evidence.append(
                "ui_product_cost:ok=%s:error=%s"
                % (ui.get("ok"), ui.get("error") or "none")
            )
            for field in ui.get("fields") or []:
                if field.get("found"):
                    evidence.append(
                        "ui_cost_field:%s=%s"
                        % (field.get("api_key"), field.get("raw_value"))
                    )
            hypotheses.append(
                "UI aba Custos observada (Playwright) — cost_field do gate "
                "continua decisão humana"
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
