from datetime import date
from pathlib import Path
from unittest.mock import patch

from knowt.answers import answer_chat
from knowt.chat_actions import parse_create_agenda, parse_create_task, try_chat_action
from knowt.sources import SourceRegistry, seed_tiny_draft


def test_parse_create_task():
    p = parse_create_task("cria uma tarefa para rever a Shein")
    assert p is not None
    assert p.title == "rever a Shein"
    assert parse_create_task("criar tarefa Revisar CMV").title == "Revisar CMV"
    assert parse_create_task("pedidos esta semana") is None


def test_parse_create_agenda():
    with patch("knowt.chat_actions.today_br", return_value=date(2026, 8, 9)):
        p = parse_create_agenda("agenda call amanhã às 15h")
        assert not isinstance(p, dict)
        assert p.title.lower() == "call"
        assert p.when.day == 10
        assert p.when.hour == 15
        assert p.when.minute == 0

        need_time = parse_create_agenda("agenda call amanhã")
        assert isinstance(need_time, dict) and need_time["error"] == "missing_time"

        need_day = parse_create_agenda("agenda call às 15h")
        assert isinstance(need_day, dict) and need_day["error"] == "missing_day"


def test_try_chat_action_persists(tmp_path: Path):
    with patch("knowt.chat_actions.today_br", return_value=date(2026, 8, 9)):
        out_t = try_chat_action(tmp_path, "cria uma tarefa Smoke chat")
        assert out_t["enforcement"]["mode"] == "action"
        assert out_t["data"]["task"]["title"] == "Smoke chat"
        assert (tmp_path / "tasks.json").is_file()

        out_a = try_chat_action(tmp_path, "agenda alinhamento Tiny amanhã às 10:30")
        assert out_a["enforcement"]["mode"] == "action"
        assert "alinhamento Tiny" in out_a["data"]["event"]["title"]
        assert (tmp_path / "agenda.json").is_file()


def test_answer_chat_prefers_local_action(tmp_path: Path):
    reg = SourceRegistry(tmp_path / "sources.json")
    seed_tiny_draft(reg)
    out = answer_chat(
        reg,
        message="cria uma tarefa via answer_chat",
        source_id="tinyerp",
        data_dir=tmp_path,
    )
    assert out["enforcement"]["mode"] == "action"
    assert "via answer_chat" in out["answer"]
