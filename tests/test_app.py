from pathlib import Path

from knowt.app import create_app
from knowt.audit import append_answer_audit, audit_path_for
from knowt.config import Settings


def _settings(tmp_path: Path, *, api_token: str = "", chat_password: str = "") -> Settings:
    return Settings(
        env="test",
        data_dir=tmp_path,
        org_id="default",
        host="127.0.0.1",
        port=8766,
        api_token=api_token,
        chat_password=chat_password,
        secret_key="test-secret",
    )



def test_health_and_enforce(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("KNOWT_SECRET_TINY_TOKEN", raising=False)
    app = create_app(_settings(tmp_path))
    client = app.test_client()

    h = client.get("/health")
    assert h.status_code == 200
    assert h.get_json()["service"] == "knowt"
    assert h.get_json()["auth_required"] is False

    s = client.get("/v1/sources")
    assert s.status_code == 200
    assert any(x["source_id"] == "tinyerp" for x in s.get_json()["sources"])

    e = client.post(
        "/v1/chat/enforce",
        json={"message": "quais os pedidos?", "source_id": "tinyerp"},
    )
    assert e.status_code == 200
    body = e.get_json()["enforcement"]
    assert body["reason_code"] == "CAPABILITY_UNAVAILABLE"
    assert body["allow_llm"] is False


def test_api_token_required(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("KNOWT_SECRET_TINY_TOKEN", raising=False)
    app = create_app(_settings(tmp_path, api_token="secret-token"))
    client = app.test_client()

    assert client.get("/health").status_code == 200
    assert client.get("/v1/sources").status_code == 401
    ok = client.get("/v1/sources", headers={"Authorization": "Bearer secret-token"})
    assert ok.status_code == 200


def test_audit_append(tmp_path: Path):
    path = audit_path_for(tmp_path)
    append_answer_audit(
        path,
        message="ping",
        source_id="tinyerp",
        result={
            "enforcement": {"mode": "catalog", "reason_code": "CATALOG"},
            "answer": "ola",
            "data": None,
        },
    )
    assert path.exists()
    assert "ping" in path.read_text(encoding="utf-8")


def test_chat_requires_login_when_password_set(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("KNOWT_SECRET_TINY_TOKEN", raising=False)
    app = create_app(_settings(tmp_path, chat_password="segredo"))
    client = app.test_client()
    home = client.get("/")
    assert home.status_code == 200
    assert b"Senha do chat" in home.data
    denied = client.post("/chat", json={"message": "pedidos"})
    assert denied.status_code == 401
    login = client.post("/login", data={"password": "segredo"}, follow_redirects=True)
    assert login.status_code == 200
    # sem token Tiny continua a responder (catálogo / refuse), mas autenticado
    ok = client.post("/chat", json={"message": "o que podes responder?"})
    assert ok.status_code == 200
    assert ok.get_json()["ok"] is True
