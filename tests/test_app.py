from pathlib import Path

from knowt.app import create_app
from knowt.config import Settings


def test_health_and_enforce(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("KNOWT_SECRET_TINY_TOKEN", raising=False)
    settings = Settings(
        env="test",
        data_dir=tmp_path,
        org_id="default",
        host="127.0.0.1",
        port=8766,
    )
    app = create_app(settings)
    client = app.test_client()

    h = client.get("/health")
    assert h.status_code == 200
    assert h.get_json()["service"] == "knowt"

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
