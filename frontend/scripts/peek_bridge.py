#!/usr/bin/env python3
import json
import urllib.request

url = "http://127.0.0.1:8765/vendas/dashboard-completo?periodo=semana"
with urllib.request.urlopen(url, timeout=30) as r:
    d = json.loads(r.read().decode())
print("top", list(d.keys()))
dash = d.get("dashboard") or {}
print("dash keys", list(dash.keys()) if isinstance(dash, dict) else type(dash))
if isinstance(dash, dict):
    for k, v in dash.items():
        s = json.dumps(v, ensure_ascii=False)[:400]
        print(f"--- {k} ({type(v).__name__}) ---")
        print(s)
