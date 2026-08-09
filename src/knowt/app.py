"""API mínima knowt (health + chat web + registry + pedidos Tiny)."""
from __future__ import annotations

from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from pathlib import Path

from knowt import __version__
from knowt.answers import answer_chat
from knowt.audit import append_answer_audit, audit_path_for
from knowt.auth import extract_bearer
from knowt.bi_bridge import create_bi_bridge_blueprint
from knowt.config import Settings
from knowt.discovery import run_discovery_stub
from knowt.enforcement import enforce
from knowt.publish import (
    ensure_tiny_capability_slots,
    publish_orders_detail_live,
    publish_orders_list_live,
)
from knowt.sources import SourceRegistry, seed_tiny_draft
from knowt.tiny_order_detail import fetch_order_detail
from knowt.tiny_orders import fetch_orders_page
from knowt.vault import resolve_secret


def _load_dotenv_into_environ(path) -> None:
    import os

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
    ensure_tiny_capability_slots(registry, "tinyerp")

    app = Flask(
        "knowt",
        template_folder=str(Path(__file__).resolve().parent / "templates"),
    )
    app.secret_key = settings.secret_key
    app.config["KNOWT_SETTINGS"] = settings
    app.config["KNOWT_REGISTRY"] = registry
    app.register_blueprint(
        create_bi_bridge_blueprint(
            registry,
            data_dir=settings.data_dir,
            api_token=settings.api_token,
        )
    )

    @app.before_request
    def _auth_v1():
        if not request.path.startswith("/v1/"):
            return None
        expected = (settings.api_token or "").strip()
        if not expected:
            return None
        got = extract_bearer(request)
        if got != expected:
            return (
                jsonify(
                    {
                        "ok": False,
                        "reason_code": "UNAUTHORIZED",
                        "message": "Token knowt em falta ou inválido.",
                    }
                ),
                401,
            )
        return None

    def _chat_logged_in() -> bool:
        if not settings.chat_password:
            return settings.env != "production"
        return bool(session.get("knowt_chat_ok"))

    @app.get("/")
    def home():
        return render_template(
            "chat.html",
            logged_in=_chat_logged_in(),
            login_error=None,
        )

    @app.post("/login")
    def login():
        password = (request.form.get("password") or "").strip()
        if settings.chat_password and password == settings.chat_password:
            session["knowt_chat_ok"] = True
            return redirect(url_for("home"))
        return (
            render_template(
                "chat.html",
                logged_in=False,
                login_error="Senha incorrecta.",
            ),
            401,
        )

    @app.get("/logout")
    def logout():
        session.clear()
        return redirect(url_for("home"))

    @app.post("/chat")
    def chat_web():
        if not _chat_logged_in():
            return jsonify({"ok": False, "message": "Faça login no chat."}), 401
        registry.load()
        payload = request.get_json(silent=True) or {}
        message = (payload.get("message") or "").strip()
        source_id = (payload.get("source_id") or "tinyerp").strip()
        if not message:
            return jsonify({"ok": False, "message": "Mensagem vazia."}), 400
        result = answer_chat(
            registry,
            message=message,
            source_id=source_id,
            data_dir=settings.data_dir,
        )
        try:
            append_answer_audit(
                audit_path_for(settings.data_dir),
                message=message,
                source_id=source_id,
                result=result,
            )
        except OSError:
            pass
        return jsonify({"ok": True, **result})

    @app.get("/health")
    def health():
        return jsonify(
            {
                "ok": True,
                "service": "knowt",
                "version": __version__,
                "env": settings.env,
                "org_id": settings.org_id,
                "auth_required": bool(settings.api_token),
                "chat": True,
            }
        )

    @app.post("/v1/chat/enforce")
    def chat_enforce():
        registry.load()
        payload = request.get_json(silent=True) or {}
        message = (payload.get("message") or "").strip()
        source_id = (payload.get("source_id") or "tinyerp").strip()
        result = enforce(registry, message=message, source_id=source_id)
        return jsonify({"ok": True, "enforcement": result.to_dict()})

    @app.post("/v1/chat/answer")
    def chat_answer():
        registry.load()
        payload = request.get_json(silent=True) or {}
        message = (payload.get("message") or "").strip()
        source_id = (payload.get("source_id") or "tinyerp").strip()
        result = answer_chat(
            registry,
            message=message,
            source_id=source_id,
            data_dir=settings.data_dir,
        )
        try:
            append_answer_audit(
                audit_path_for(settings.data_dir),
                message=message,
                source_id=source_id,
                result=result,
            )
        except OSError:
            pass
        return jsonify({"ok": True, **result})

    @app.get("/v1/sources")
    def list_sources():
        registry.load()
        rows = [s.to_dict() for s in registry.list(org_id=settings.org_id)]
        return jsonify({"ok": True, "sources": rows})

    @app.get("/v1/sources/<source_id>")
    def get_source(source_id: str):
        registry.load()
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
        src = registry.get(source_id)
        if not src:
            return jsonify({"ok": False, "reason_code": "SOURCE_NOT_FOUND"}), 404
        ensure_tiny_capability_slots(registry, source_id)
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

    @app.post("/v1/sources/<source_id>/capabilities/orders.detail/publish")
    def publish_orders_detail(source_id: str):
        src = registry.get(source_id)
        if not src:
            return jsonify({"ok": False, "reason_code": "SOURCE_NOT_FOUND"}), 404
        ensure_tiny_capability_slots(registry, source_id)
        ref = (src.secret_refs or {}).get("api_token") or "KNOWT_SECRET_TINY_TOKEN"
        token = resolve_secret(ref, required=True)
        order_id = (request.args.get("order_id") or "").strip()
        if not order_id:
            page = fetch_orders_page(token, page=1)
            if not page.ok or not page.order_ids:
                return (
                    jsonify(
                        {
                            "ok": False,
                            "reason_code": "PUBLISH_BLOCKED_NO_SAMPLE",
                            "page": page.to_dict() if page else None,
                        }
                    ),
                    409,
                )
            order_id = page.order_ids[0]
        detail = fetch_order_detail(token, order_id)
        if not detail.ok:
            return (
                jsonify(
                    {
                        "ok": False,
                        "reason_code": "PUBLISH_BLOCKED_PROBE",
                        "detail": detail.to_dict(),
                    }
                ),
                409,
            )
        cap = publish_orders_detail_live(registry, source_id)
        return jsonify(
            {
                "ok": True,
                "capability": cap.to_dict(),
                "evidence_detail": detail.to_dict(),
            }
        )

    return app


def main() -> None:
    from pathlib import Path

    _load_dotenv_into_environ(Path.cwd() / ".env")
    settings = Settings.from_env()
    app = create_app(settings)
    app.run(host=settings.host, port=settings.port, debug=settings.env != "production")


if __name__ == "__main__":
    main()
