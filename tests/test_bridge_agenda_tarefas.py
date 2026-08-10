from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from knowt.app import create_app
from knowt.config import Settings

TZ = ZoneInfo("America/Sao_Paulo")


def _settings(tmp_path: Path) -> Settings:
    return Settings(
        env="test",
        data_dir=tmp_path,
        org_id="default",
        host="127.0.0.1",
        port=8766,
        api_token="tok",
        chat_password="",
        secret_key="test-secret",
        mongo_uri="mongodb://127.0.0.1:27017",
        mongo_db="knowt_test",
    )


def test_bridge_tarefas_and_agenda(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("KNOWT_SECRET_TINY_TOKEN", raising=False)
    app = create_app(_settings(tmp_path))
    client = app.test_client()
    hdr = {"X-Fiesta-Bi-Key": "tok"}

    created = client.post(
        "/api/bridge/tarefas",
        headers=hdr,
        json={"title": "Nova tarefa knowt", "priority": "high"},
    )
    assert created.status_code == 200
    task = created.get_json()["task"]
    assert task["title"] == "Nova tarefa knowt"

    listed = client.get("/api/bridge/tarefas?status=open", headers=hdr)
    assert listed.status_code == 200
    body = listed.get_json()
    assert body["count"] == 1
    assert body["tasks"][0]["id"] == task["id"]

    done = client.post("/api/bridge/tarefas/concluir", headers=hdr, json={"id": task["id"]})
    assert done.status_code == 200
    assert done.get_json()["task"]["status"] == "done"
    assert client.get("/api/bridge/tarefas?status=open", headers=hdr).get_json()["count"] == 0

    start = datetime.now(TZ).replace(hour=16, minute=0, second=0, microsecond=0)
    ev = client.post(
        "/api/bridge/agenda/eventos",
        headers=hdr,
        json={"title": "Reunião Tiny", "start": start.isoformat(), "kind": "reuniao"},
    )
    assert ev.status_code == 200
    assert ev.get_json()["event"]["title"] == "Reunião Tiny"

    peri = client.get(
        f"/api/bridge/agenda/periodo?data_inicio={start.date().isoformat()}"
        f"&data_fim={start.date().isoformat()}",
        headers=hdr,
    )
    assert peri.status_code == 200
    pdata = peri.get_json()
    assert pdata["count"] == 1
    assert pdata["events"][0]["title"] == "Reunião Tiny"
    assert pdata["google"]["google_connected"] is False

    prox = client.get("/api/bridge/agenda/periodo?periodo=proximos", headers=hdr)
    assert prox.status_code == 200
    assert prox.get_json()["count"] >= 1

    auth = client.get("/api/bridge/agenda/google/auth-url", headers=hdr)
    assert auth.status_code == 400
    assert auth.get_json()["error"] == "google_credentials_missing"

    # callback é público (sem Bearer) — falha de state, não 401
    cb = client.get("/api/bridge/agenda/google/callback?code=x&state=y")
    assert cb.status_code == 400
    assert b"Falha OAuth" in cb.data

    health = client.get("/api/bridge/health")
    assert health.status_code == 200
    h = health.get_json()
    assert h["google_connected"] is False
    assert h["google_credentials_configured"] is False
