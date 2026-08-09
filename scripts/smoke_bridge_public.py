#!/usr/bin/env python3
import json
import urllib.request
from pathlib import Path

token = ""
for line in Path("/root/knowt/.env").read_text().splitlines():
    if line.startswith("KNOWT_API_TOKEN="):
        token = line.split("=", 1)[1].strip()
headers = {"X-Fiesta-Bi-Key": token, "Content-Type": "application/json"}


def get(url: str):
    req = urllib.request.Request(url, headers={"X-Fiesta-Bi-Key": token})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def post(url: str, body: dict):
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers=headers, method="POST"
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


print("fontes", get("https://knowt.com.br/api/bridge/fontes"))
chat = post(
    "https://knowt.com.br/api/bridge/assistant/chat",
    {"message": "o que podes responder?"},
)
print("chat_ok", chat.get("ok"))
print("reply", (chat.get("reply") or "")[:280])
ins = get("https://knowt.com.br/api/bridge/insights/resumo?periodo=7d&dominio=geral")
print("insight_titulo", ins.get("titulo"))
print("insight_snippet", (ins.get("leitura") or "")[:200])
