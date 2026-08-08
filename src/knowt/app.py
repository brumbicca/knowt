"""API mínima knowt (health + registry + enforcement + pedidos Tiny)."""
from __future__ import annotations

from flask import Flask, jsonify, request

from knowt import __version__
from knowt.answers import answer_chat
from knowt.config import Settings
from knowt.discovery import run_discovery_stub
from knowt.enforcement import enforce
from knowt.publish import publish_orders_list_live
from knowt.sources import SourceRegistry, seed_tiny_draft
from knowt.tiny_orders import fetch_orders_page
from knowt.vault import resolve_secret


def _load_dotenv_into_environ(path) -> None:
    import os
    from pathlib import Path

    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def create_app(settings: Settings | None = None) -> Flask:
    settings = settings or Settings.from_env()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    registry = SourceRegistry(settings.data_dir / "sources.json")
    seed_tiny_draft(registry, org_id=settings.org_id)

    app = Flask("knowt")
    app.config["KNOWT_SETTINGS"] = settings
    app.config["KNOWT_REGISTRY"] = registry

    @app.get("/health")
    def health():
        return jsonify(
            {
                "ok": True,
                "service": "knowt",
                "version": __version__,
                "env": settings.env,
                "org_id": settings.org_id,
            }
        )

    @app.get("/v1/sources")
    def list_sources():
        rows = [s.to_dict() for s in registry.list(org_id=settings.org_id)]
        return jsonify({"ok": True, "sources": rows})

    @app.get("/v1/sources/<source_id>")
    def get_source(source_id: str):
        src = registry.get(source_id)
        if not src:
            return jsonify({"ok": False, "reason_code": "SOURCE_NOT_FOUND"}), 404
        return jsonify({"ok": True, "source": src.to_dict()})

    @app.post("/v1/sources/<source_id>/discovery")
    def discovery(source_id: str):
        report = run_discovery_stub(registry, source_id)
        status = 404 if "SOURCE_NOT_FOUND" in report.blocked_reasons else 200
        return jsonify({"ok": True, "report": report.to_dict()}), status

    @app.get("/v1/sources/<source_id>/orders/page")
    def orders_page(source_id: str):
        src = registry.get(source_id)
        if not src:
            return jsonify({"ok": False, "reason_code": "SOURCE_NOT_FOUND"}), 404
        page_n = int(request.args.get("page") or 1)
        ref = (src.secret_refs or {}).get("api_token") or "KNOWT_SECRET_TINY_TOKEN"
        token = resolve_secret(ref, required=True)
        result = fetch_orders_page(token, page=page_n)
        code = 200 if result.ok else 502
        return jsonify({"ok": result.ok, "page": result.to_dict()}), code

    @app.post("/v1/sources/<source_id>/capabilities/orders.list/publish")
    def publish_orders(source_id: str):
        """Publica orders.list só após leitura OK da página 1."""
        src = registry.get(source_id)
        if not src:
            return jsonify({"ok": False, "reason_code": "SOURCE_NOT_FOUND"}), 404
        ref = (src.secret_refs or {}).get("api_token") or "KNOWT_SECRET_TINY_TOKEN"
        token = resolve_secret(ref, required=True)
        page = fetch_orders_page(token, page=1)
        if not page.ok:
            return (
                jsonify(
                    {
                        "ok": False,
                        "reason_code": "PUBLISH_BLOCKED_PROBE",
                        "page": page.to_dict(),
                    }
                ),
                409,
            )
        cap = publish_orders_list_live(registry, source_id)
        return jsonify(
            {
                "ok": True,
                "capability": cap.to_dict(),
                "evidence_page": page.to_dict(),
            }
        )

    @app.post("/v1/chat/enforce")
    def chat_enforce():
        payload = request.get_json(silent=True) or {}
        message = (payload.get("message") or "").strip()
        source_id = (payload.get("source_id") or "tinyerp").strip()
        result = enforce(registry, message=message, source_id=source_id)
        return jsonify({"ok": True, "enforcement": result.to_dict()})

    @app.post("/v1/chat/answer")
    def chat_answer():
        payload = request.get_json(silent=True) or {}
        message = (payload.get("message") or "").strip()
        source_id = (payload.get("source_id") or "tinyerp").strip()
        result = answer_chat(registry, message=message, source_id=source_id)
        return jsonify({"ok": True, **result})

    return app


def main() -> None:
    from pathlib import Path

    _load_dotenv_into_environ(Path.cwd() / ".env")
    settings = Settings.from_env()
    app = create_app(settings)
    app.run(host=settings.host, port=settings.port, debug=settings.env != "production")


if __name__ == "__main__":
    main()
