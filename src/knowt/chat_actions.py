"""Acções locais do chat (tarefa / agenda) — sem Tiny, sem inventar fatos."""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

from knowt.agenda_store import add_event
from knowt.period import today_br
from knowt.tasks_store import add_task

TZ = ZoneInfo("America/Sao_Paulo")

_TASK_RE = re.compile(
    r"^\s*(?:cria(?:r)?|nova)\s+(?:uma\s+)?tarefa(?:\s+(?:para|de|:))?\s+(.+?)\s*$",
    re.I | re.DOTALL,
)

_AGENDA_RE = re.compile(
    r"^\s*(?:agenda(?:r)?|marca(?:r)?)\s+(.+?)\s*$",
    re.I | re.DOTALL,
)

_TIME_RE = re.compile(
    r"\b(?:[aà]s|as)\s*(\d{1,2})(?::(\d{2}))?\s*h?\b|\b(\d{1,2})(?::(\d{2}))\s*h\b|\b(\d{1,2})h(?:(\d{2}))?\b",
    re.I,
)


@dataclass(frozen=True)
class ParsedTask:
    title: str


@dataclass(frozen=True)
class ParsedAgenda:
    title: str
    when: datetime


def wants_local_action(text: str) -> bool:
    msg = (text or "").strip().lower()
    if not msg:
        return False
    if _TASK_RE.match(msg):
        return True
    if _AGENDA_RE.match(msg):
        return True
    return False


def parse_create_task(text: str) -> Optional[ParsedTask]:
    m = _TASK_RE.match((text or "").strip())
    if not m:
        return None
    title = re.sub(r"\s+", " ", m.group(1)).strip(" .")
    if not title:
        return None
    return ParsedTask(title=title[:500])


def _parse_day(msg: str, hoje: date) -> Optional[date]:
    if re.search(r"\bhoje\b", msg):
        return hoje
    if re.search(r"\bamanh[aã]\b", msg):
        return hoje + timedelta(days=1)
    if re.search(r"\bdepois\s+de\s+amanh[aã]\b", msg):
        return hoje + timedelta(days=2)
    m = re.search(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", msg)
    if m:
        day = int(m.group(1))
        month = int(m.group(2))
        year_s = m.group(3)
        year = hoje.year if not year_s else int(year_s)
        if year < 100:
            year += 2000
        try:
            return date(year, month, day)
        except ValueError:
            return None
    return None


def _parse_time(msg: str) -> Optional[tuple[int, int]]:
    m = _TIME_RE.search(msg)
    if not m:
        return None
    if m.group(1) is not None:
        hour = int(m.group(1))
        minute = int(m.group(2) or 0)
    elif m.group(3) is not None:
        hour = int(m.group(3))
        minute = int(m.group(4) or 0)
    else:
        hour = int(m.group(5))
        minute = int(m.group(6) or 0)
    if hour > 23 or minute > 59:
        return None
    return hour, minute


def _strip_when_bits(title: str) -> str:
    t = title
    t = re.sub(
        r"\b(?:hoje|amanh[aã]|depois\s+de\s+amanh[aã])\b",
        " ",
        t,
        flags=re.I,
    )
    t = re.sub(r"\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b", " ", t)
    t = _TIME_RE.sub(" ", t)
    t = re.sub(r"\s+", " ", t).strip(" .,;:-")
    return t


def parse_create_agenda(text: str) -> Optional[ParsedAgenda | Dict[str, str]]:
    """Devolve ParsedAgenda, dict de erro `{error: ...}`, ou None se não for agenda."""
    raw = (text or "").strip()
    m = _AGENDA_RE.match(raw)
    if not m:
        return None
    body = re.sub(r"\s+", " ", m.group(1)).strip()
    if not body:
        return {"error": "missing_title"}
    msg = body.lower()
    day = _parse_day(msg, today_br())
    clock = _parse_time(msg)
    if day is None:
        return {"error": "missing_day"}
    if clock is None:
        return {"error": "missing_time"}
    hour, minute = clock
    title = _strip_when_bits(body)
    if not title:
        title = "Compromisso"
    when = datetime(day.year, day.month, day.day, hour, minute, tzinfo=TZ)
    return ParsedAgenda(title=title[:500], when=when)


def try_chat_action(data_dir: Path, message: str) -> Optional[Dict[str, Any]]:
    """Se a mensagem for acção local, executa e devolve payload de resposta."""
    if data_dir is None:
        return None
    path = Path(data_dir)

    task = parse_create_task(message)
    if task:
        created = add_task(path, task.title, priority="medium")
        return {
            "enforcement": {
                "allow_llm": False,
                "mode": "action",
                "message": "Acção local: criar tarefa.",
                "capability_id": "tasks.local",
                "reason_code": "LOCAL_ACTION",
                "source_id": "knowt_local",
            },
            "answer": (
                f"Tarefa criada: **{created['title']}** "
                f"(id `{created['id']}`, prioridade {created['priority']}). "
                "Vê em Insights → Agenda."
            ),
            "data": {"action": "task.create", "task": created},
        }

    agenda = parse_create_agenda(message)
    if isinstance(agenda, dict) and agenda.get("error"):
        err = agenda["error"]
        hints = {
            "missing_title": "Indica o título, ex.: «agenda call amanhã às 15h».",
            "missing_day": "Indica o dia (hoje / amanhã / dd/mm), ex.: «agenda call amanhã às 15h».",
            "missing_time": "Indica a hora, ex.: «agenda call amanhã às 15h».",
        }
        return {
            "enforcement": {
                "allow_llm": False,
                "mode": "action",
                "message": "Acção local incompleta.",
                "capability_id": "agenda.local",
                "reason_code": "LOCAL_ACTION_NEED_INFO",
                "source_id": "knowt_local",
            },
            "answer": hints.get(err, "Não entendi o compromisso. Ex.: «agenda call amanhã às 15h»."),
            "data": {"action": "agenda.create", "error": err},
        }
    if isinstance(agenda, ParsedAgenda):
        created = add_event(
            path,
            agenda.title,
            agenda.when.isoformat(),
            kind="reuniao",
        )
        when_label = agenda.when.strftime("%d/%m/%Y %H:%M")
        return {
            "enforcement": {
                "allow_llm": False,
                "mode": "action",
                "message": "Acção local: criar compromisso.",
                "capability_id": "agenda.local",
                "reason_code": "LOCAL_ACTION",
                "source_id": "knowt_local",
            },
            "answer": (
                f"Compromisso criado: **{created['title']}** em **{when_label}** "
                f"(id `{created['id']}`). Vê em Insights → Agenda."
            ),
            "data": {"action": "agenda.create", "event": created},
        }

    return None
