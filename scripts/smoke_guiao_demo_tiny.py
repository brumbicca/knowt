#!/usr/bin/env python3
"""Smoke do guião demo Tiny (T7/T9/T11).

Corre as perguntas do docs/GUIAO_DEMO_TINY.md contra o bridge,
reconcilia contagem com /vendas/periodo e grava evidência.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from knowt.guiao_demo import (  # noqa: E402
    GUIAO_STEPS,
    check_catalog,
    check_discovery,
    check_pedidos_recon,
    check_receita_blocked,
    check_situacao,
    extract_pedidos_count,
)


def load_env(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def req(method: str, path: str, body=None, timeout: float = 120.0) -> dict:
    tok = (os.environ.get("KNOWT_API_TOKEN") or "").strip()
    base = (
        os.environ.get("KNOWT_TELEGRAM_BRIDGE_URL") or "http://127.0.0.1:8766"
    ).rstrip("/")
    if not base.endswith("/api/bridge"):
        # accept http://127.0.0.1:8766
        url = base + "/api/bridge" + path
    else:
        url = base + path
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "X-Knowt-Token": tok,
            "Content-Type": "application/json",
            "X-Fiesta-Bi-Key": tok,
        },
    )
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def chat(message: str, *, tone_channel: str, engine: str) -> dict:
    ctx: dict = {"source_id": "tinyerp", "engine": engine}
    if tone_channel:
        ctx["channel"] = tone_channel
    return req(
        "POST",
        "/assistant/chat",
        {
            "message": message,
            "session_id": "guiao-demo-tiny",
            "context": ctx,
        },
    )


def main() -> int:
    env = Path(os.environ.get("KNOWT_ENV_FILE") or "/root/knowt/.env")
    if not env.is_file():
        env = ROOT / ".env"
    load_env(env)
    data_dir = Path(os.environ.get("KNOWT_DATA_DIR") or "/root/knowt-data")
    evidence_dir = data_dir / "evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)

    results: list[dict] = []
    all_ok = True

    # pré: fonte não suspensa
    try:
        st = req("GET", "/fonte/status?source_id=tinyerp", timeout=90)
        if (st.get("kill_switch") or {}).get("suspended"):
            print(json.dumps({"ok": False, "error": "source_suspended"}, ensure_ascii=False))
            return 2
    except Exception as exc:
        print(json.dumps({"ok": False, "error": "fonte_status_failed", "detail": str(exc)[:160]}))
        return 2

    bridge_semana = None
    try:
        bridge_semana = req("GET", "/vendas/periodo?periodo=semana", timeout=90)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": "vendas_periodo_failed", "detail": str(exc)[:160]}))
        return 2

    for step in GUIAO_STEPS:
        sid = step["id"]
        channel = "telegram" if step.get("tone") == "casual" else ""
        try:
            resp = chat(step["message"], tone_channel=channel, engine=step.get("engine") or "deterministic")
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")[:300]
            results.append({"id": sid, "ok": False, "errors": [f"http_{exc.code}"], "detail": body})
            all_ok = False
            continue
        except Exception as exc:
            results.append({"id": sid, "ok": False, "errors": ["request_failed"], "detail": str(exc)[:160]})
            all_ok = False
            continue

        reply = resp.get("reply") or resp.get("answer") or ""
        html = resp.get("reply_html") or ""
        enf = resp.get("enforcement") or {}
        errs: list[str] = []

        if sid == "catalog":
            errs = check_catalog(reply, enf)
        elif sid == "pedidos_semana":
            n = int(bridge_semana.get("pedidos_validos") or 0)
            errs = check_pedidos_recon(reply, n)
        elif sid == "situacao_semana":
            errs = check_situacao(reply, enf, html)
        elif sid == "receita_bloqueada":
            errs = check_receita_blocked(reply, enf)
        elif sid == "discovery":
            errs = check_discovery(reply, enf)

        ok = not errs
        all_ok = all_ok and ok
        results.append(
            {
                "id": sid,
                "ok": ok,
                "errors": errs,
                "message": step["message"],
                "engine": resp.get("engine"),
                "reason_code": enf.get("reason_code"),
                "capability_id": enf.get("capability_id"),
                "extracted_pedidos": extract_pedidos_count(reply),
                "reply_preview": (reply or "")[:280],
            }
        )

    evidence = {
        "at": datetime.now(timezone.utc).isoformat(),
        "ok": all_ok,
        "bridge_semana_pedidos": bridge_semana.get("pedidos_validos") if bridge_semana else None,
        "bridge_semana_raw": (bridge_semana or {}).get("raw"),
        "steps": results,
        "docs": "docs/GUIAO_DEMO_TINY.md",
        "criteria": ["T11", "T7", "T9"],
    }
    latest = evidence_dir / "guiao_demo_latest.json"
    stamped = evidence_dir / f"guiao_demo_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    payload = json.dumps(evidence, ensure_ascii=False, indent=2) + "\n"
    latest.write_text(payload, encoding="utf-8")
    stamped.write_text(payload, encoding="utf-8")

    print(json.dumps({"ok": all_ok, "evidence": str(latest), "steps": [
        {"id": r["id"], "ok": r["ok"], "errors": r["errors"]} for r in results
    ]}, ensure_ascii=False))
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
