"""API mínima knowt (health + registry + enforcement)."""
from __future__ import annotations

from flask import Flask, jsonify, request

from knowt import __version__
from knowt.config import Settings
from knowt.discovery import run_discovery_stub
from knowt.enforcement import enforce
from knowt.sources import SourceRegistry, seed_tiny_draft


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

    @app.post("/v1/chat/enforce")
    def chat_enforce():
        payload = request.get_json(silent=True) or {}
        message = (payload.get("message") or "").strip()
        source_id = (payload.get("source_id") or "tinyerp").strip()
        result = enforce(registry, message=message, source_id=source_id)
        code = 200 if result.mode != "refuse" or result.reason_code == "NO_DOMAIN_MATCH" else 200
        return jsonify({"ok": True, "enforcement": result.to_dict()}), code

    return app


def main() -> None:
    settings = Settings.from_env()
    app = create_app(settings)
    app.run(host=settings.host, port=settings.port, debug=settings.env != "production")


if __name__ == "__main__":
    main()
