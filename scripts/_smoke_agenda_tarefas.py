#!/usr/bin/env python3
import json
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Sao_Paulo")
env = Path("/root/knowt/.env").read_text(encoding="utf-8")
tok = next(
    line.split("=", 1)[1].strip()
    for line in env.splitlines()
    if line.startswith("KNOWT_API_TOKEN=")
)


def call(method: str, path: str, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        "http://127.0.0.1:8766" + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {tok}",
            "Content-Type": "application/json",
            "X-Fiesta-Bi-Key": tok,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


t = call("POST", "/api/bridge/tarefas", {"title": "Smoke tarefa knowt", "priority": "high"})
print("task", t["task"]["id"], t["task"]["title"])
listed = call("GET", "/api/bridge/tarefas?status=open")
print("open_count", listed["count"])
start = datetime.now(TZ).replace(hour=11, minute=0, second=0, microsecond=0)
ev = call(
    "POST",
    "/api/bridge/agenda/eventos",
    {"title": "Smoke call Tiny", "start": start.isoformat(), "kind": "reuniao"},
)
print("event", ev["event"]["id"])
day = start.date().isoformat()
peri = call("GET", f"/api/bridge/agenda/periodo?data_inicio={day}&data_fim={day}")
print("events_today", peri["count"], peri["events"][0]["title"] if peri["events"] else None)
print("files", sorted(p.name for p in Path("/root/knowt-data").glob("*.json")))
