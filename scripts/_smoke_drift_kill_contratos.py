#!/usr/bin/env python3
"""Smoke drift/kill/contratos na VPS — não imprime tokens."""
from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path


def load_env(path: str = "/root/knowt/.env") -> None:
    p = Path(path)
    if not p.is_file():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def req(method: str, path: str, body=None):
    tok = os.environ.get("KNOWT_API_TOKEN", "").strip()
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(
        "http://127.0.0.1:8766/api/bridge" + path,
        data=data,
        method=method,
        headers={"X-Knowt-Token": tok, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(r, timeout=90) as resp:
        return json.loads(resp.read().decode())


def main() -> None:
    load_env()
    c = req("GET", "/contratos")
    print("contratos", c.get("summary"))
    d = req("POST", "/drift/check", {"source_id": "tinyerp", "actor": "deploy"})
    e = d.get("event") or {}
    print(
        "drift",
        {
            "alerts": e.get("alert_count"),
            "suggest": e.get("suggest_kill_switch"),
            "auto": e.get("auto_kill"),
            "codes": [a.get("code") for a in (e.get("alerts") or [])],
        },
    )
    s = req("GET", "/fonte/status?source_id=tinyerp")
    print(
        "fonte",
        {
            "health": s.get("health"),
            "kill": (s.get("kill_switch") or {}).get("suspended"),
            "contracts": ((s.get("coverage") or {}).get("contracts") or {}).get("count"),
            "has_drift_last": bool((s.get("drift") or {}).get("last")),
        },
    )


if __name__ == "__main__":
    main()
