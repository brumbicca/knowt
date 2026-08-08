#!/usr/bin/env python3
"""Extract Tiny token to a 0600 file — prints only metadata."""
from pathlib import Path

text = Path("/root/fiestaup/fiesta-api/.env.production").read_text(
    encoding="utf-8", errors="ignore"
)
wanted = {}
for line in text.splitlines():
    if not line or line.strip().startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    k, v = k.strip(), v.strip().strip('"').strip("'")
    if k in ("TINY_V2_API_KEY", "TINY_ERP_BI_TOKEN") and v:
        wanted[k] = v
token = wanted.get("TINY_V2_API_KEY") or wanted.get("TINY_ERP_BI_TOKEN") or ""
if not token:
    raise SystemExit("NO_TOKEN")
src = "TINY_V2_API_KEY" if "TINY_V2_API_KEY" in wanted else "TINY_ERP_BI_TOKEN"
out = Path("/tmp/knowt_tiny_xfer.env")
out.write_text("KNOWT_SECRET_TINY_TOKEN=%s\n" % token, encoding="utf-8")
out.chmod(0o600)
print("WROTE_OK len=%d source=%s" % (len(token), src))
