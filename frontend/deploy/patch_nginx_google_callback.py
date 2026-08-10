#!/usr/bin/env python3
"""Insere location OAuth Google no nginx do BI se ainda não existir."""
from pathlib import Path
import glob
import sys

candidates = glob.glob("/etc/nginx/sites-enabled/*bi*") + [
    "/etc/nginx/sites-enabled/bi.fiestaup.toteus.cloud",
    "/etc/nginx/sites-available/bi.fiestaup.toteus.cloud",
]
path = next((Path(p) for p in candidates if Path(p).is_file()), None)
if not path:
    print("nginx_conf_not_found")
    sys.exit(1)
text = path.read_text(encoding="utf-8")
if "agenda/google/callback" in text:
    print("nginx_already_ok", path)
    sys.exit(0)
needle = "location /api/bridge/ {"
if needle not in text:
    print("nginx_needle_missing", path)
    sys.exit(1)
block = """    location /api/bridge/agenda/google/callback {
        proxy_pass http://127.0.0.1:8765/agenda/google/callback;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

"""
path.write_text(text.replace(needle, block + needle, 1), encoding="utf-8")
print("nginx_patched", path)
