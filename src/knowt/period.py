"""Parsing leve de período em pt-BR → datas Tiny (dd/mm/yyyy)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional, Tuple
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Sao_Paulo")


@dataclass(frozen=True)
class Period:
    start: date
    end: date
    label: str

    def tiny_bounds(self) -> Tuple[str, str]:
        return (
            self.start.strftime("%d/%m/%Y"),
            self.end.strftime("%d/%m/%Y"),
        )


def today_br() -> date:
    return datetime.now(TZ).date()


def parse_period(text: str) -> Optional[Period]:
    msg = (text or "").strip().lower()
    if not msg:
        return None
    hoje = today_br()

    if re.search(r"\bhoje\b", msg):
        return Period(hoje, hoje, "hoje")
    if re.search(r"\bontem\b", msg):
        d = hoje - timedelta(days=1)
        return Period(d, d, "ontem")
    if re.search(
        r"\b(?:esta|essa|desta)\s+semana\b|\bsemana\s+atual\b",
        msg,
    ):
        start = hoje - timedelta(days=hoje.weekday())
        return Period(start, hoje, "esta semana")
    if re.search(r"\beste\s+m[eê]s\b|\bm[eê]s\s+atual\b|\besse\s+m[eê]s\b", msg):
        start = hoje.replace(day=1)
        return Period(start, hoje, "este mês")
    if re.search(r"\b[uú]ltimos?\s+7\s+dias\b", msg):
        return Period(hoje - timedelta(days=6), hoje, "últimos 7 dias")

    m = re.search(
        r"\bde\s+(\d{1,2}/\d{1,2}/\d{4})\s+a(?:té)?\s+(\d{1,2}/\d{1,2}/\d{4})\b",
        msg,
    )
    if m:
        try:
            d0 = datetime.strptime(m.group(1), "%d/%m/%Y").date()
            d1 = datetime.strptime(m.group(2), "%d/%m/%Y").date()
            if d1 < d0:
                d0, d1 = d1, d0
            return Period(d0, d1, f"{m.group(1)} a {m.group(2)}")
        except ValueError:
            return None
    return None
