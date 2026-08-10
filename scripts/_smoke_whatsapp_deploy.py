#!/usr/bin/env python3
import json
import os
import secrets
import urllib.request
from pathlib import Path

env = Path("/root/knowt/.env")
text = env.read_text(encoding="utf-8", errors="replace")
lines = [ln.rstrip("\r") for ln in text.splitlines()]
keys = {
    ln.split("=", 1)[0].strip()
    for ln in lines
    if "=" in ln and not ln.strip().startswith("#")
}
if "KNOWT_WHATSAPP_VERIFY_TOKEN" not in keys:
    tok = secrets.token_urlsafe(18)
    lines.append(f"KNOWT_WHATSAPP_VERIFY_TOKEN={tok}")
    env.write_text("\n".join(lines) + "\n", encoding="utf-8")
    Path("/root/knowt-data").mkdir(parents=True, exist_ok=True)
    Path("/root/knowt-data/whatsapp_verify_token.txt").write_text(tok + "\n", encoding="utf-8")
    print("verify_token_created")
else:
    print("verify_token_exists")

os.system("systemctl restart knowt-api")
import time

time.sleep(2)

with urllib.request.urlopen("http://127.0.0.1:8766/api/bridge/health", timeout=20) as r:
    h = json.loads(r.read().decode())
print(
    "health",
    {
        k: h.get(k)
        for k in (
            "ok",
            "whatsapp_configured",
            "whatsapp_webhook",
            "assistant_engine",
            "telegram_configured",
        )
    },
)

vt = ""
for ln in Path("/root/knowt/.env").read_text(encoding="utf-8", errors="replace").splitlines():
    if ln.startswith("KNOWT_WHATSAPP_VERIFY_TOKEN="):
        vt = ln.split("=", 1)[1].strip()
url = (
    "http://127.0.0.1:8766/api/bridge/whatsapp/webhook"
    f"?hub.mode=subscribe&hub.verify_token={urllib.parse.quote(vt)}&hub.challenge=pong"
)
import urllib.parse

url = (
    "http://127.0.0.1:8766/api/bridge/whatsapp/webhook?"
    + urllib.parse.urlencode(
        {
            "hub.mode": "subscribe",
            "hub.verify_token": vt,
            "hub.challenge": "pong",
        }
    )
)
with urllib.request.urlopen(url, timeout=20) as r:
    print("challenge", r.read().decode())

try:
    with urllib.request.urlopen("https://knowt.com.br/api/bridge/health", timeout=20) as r:
        print("public_health", r.status)
except Exception as exc:
    print("public_health_err", type(exc).__name__)
