from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from knowt.agenda_store import add_event, list_events
from knowt.tasks_store import add_task, complete_task, list_tasks

TZ = ZoneInfo("America/Sao_Paulo")


def test_tasks_crud(tmp_path: Path):
    t = add_task(tmp_path, "Revisar Tiny", priority="high")
    assert t["status"] == "open"
    assert t["source"] == "knowt_local"
    open_tasks = list_tasks(tmp_path, status="open")
    assert len(open_tasks) == 1
    assert open_tasks[0]["title"] == "Revisar Tiny"
    done = complete_task(tmp_path, t["id"])
    assert done["status"] == "done"
    assert list_tasks(tmp_path, status="open") == []
    assert len(list_tasks(tmp_path, status="all")) == 1
    assert (tmp_path / "tasks.json").is_file()


def test_agenda_crud(tmp_path: Path):
    start = datetime.now(TZ).replace(hour=15, minute=0, second=0, microsecond=0)
    ev = add_event(tmp_path, "Call Tiny", start.isoformat(), kind="reuniao")
    assert ev["source"] == "knowt_local"
    d0 = start.date()
    d1 = d0 + timedelta(days=1)
    events = list_events(tmp_path, d0, d1)
    assert len(events) == 1
    assert events[0]["title"] == "Call Tiny"
    assert (tmp_path / "agenda.json").is_file()
