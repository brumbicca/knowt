#!/usr/bin/env python3
import json
import os
import subprocess
import urllib.request
from pathlib import Path


def load_env(path="/root/knowt/.env"):
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
token = os.environ.get("KNOWT_API_TOKEN") or ""
req = urllib.request.Request(
    "http://127.0.0.1:8766/api/bridge/catalog",
    headers={"X-Knowt-Token": token},
)
with urllib.request.urlopen(req, timeout=30) as resp:
    d = json.loads(resp.read().decode())
print("catalog", d.get("service"), d.get("stats"))

print("--- mcp ---")
p = subprocess.run(
    ["hermes", "mcp", "test", "knowt-gateway"],
    capture_output=True,
    text=True,
    timeout=90,
)
print(((p.stdout or "") + (p.stderr or ""))[-1500:])
print("mcp_exit", p.returncode)

print("--- chat ---")
p2 = subprocess.run(
    [
        "hermes",
        "chat",
        "-q",
        "Quantos pedidos esta semana no Tiny? Usa knowt_query path=/vendas/periodo periodo=semana.",
        "-Q",
        "--skills",
        "knowt",
        "--accept-hooks",
    ],
    capture_output=True,
    text=True,
    timeout=150,
    env={**os.environ, "HERMES_ACCEPT_HOOKS": "1"},
)
out = ((p2.stdout or "") + "\n" + (p2.stderr or "")).strip()
print(out[-2000:])
print("chat_exit", p2.returncode)
