"""Catálogo + parsing Hermes (sem rede)."""
from __future__ import annotations

from knowt.agent_catalog import (
    agent_catalog_payload,
    is_allowed_agent_path,
    live_bridge_paths,
    normalize_bridge_path,
)
from knowt.hermes_chat import parse_hermes_chat_output


def test_catalog_has_core_paths():
    paths = live_bridge_paths()
    assert "/vendas/periodo" in paths
    assert "/discovery/dossier" in paths
    assert "/catalog" in paths
    payload = agent_catalog_payload()
    assert payload["service"] == "knowt-agent-gateway"
    assert payload["stats"]["live"] >= 5


def test_path_normalize_and_allow():
    assert normalize_bridge_path("/dashboard/stats/period") == "/vendas/periodo"
    assert is_allowed_agent_path("/vendas/periodo")
    assert not is_allowed_agent_path("/vendas/shopee-semana")


def test_parse_hermes_output_strips_noise():
    raw = "session_id: abc-1\nLoading tools...\nAqui vai a resposta final.\n"
    sid, reply = parse_hermes_chat_output(raw)
    assert sid == "abc-1"
    assert "Aqui vai a resposta final" in reply
    assert "Loading" not in reply


def test_resume_only_hermes_session_ids():
    from knowt.hermes_chat import _HERMES_RESUME_RE

    assert _HERMES_RESUME_RE.fullmatch("20260809_201559_66b44d")
    assert not _HERMES_RESUME_RE.fullmatch("tg-99")
    assert not _HERMES_RESUME_RE.fullmatch("smoke-hermes-tg")
