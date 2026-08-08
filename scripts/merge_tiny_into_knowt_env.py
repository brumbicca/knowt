#!/usr/bin/env python3
"""Merge /tmp/knowt_tiny_xfer.env into /root/knowt/.env — metadata only on stdout."""
from pathlib import Path

src = Path("/tmp/knowt_tiny_xfer.env")
line = src.read_text(encoding="utf-8").strip().splitlines()[0]
if not line.startswith("KNOWT_SECRET_TINY_TOKEN="):
    raise SystemExit("BAD_FILE")
val = line.split("=", 1)[1].strip()
if not val:
    raise SystemExit("EMPTY")

env_path = Path("/root/knowt/.env")
lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.exists() else []
out = []
replaced = False
for ln in lines:
    if ln.startswith("KNOWT_SECRET_TINY_TOKEN="):
        out.append("KNOWT_SECRET_TINY_TOKEN=" + val)
        replaced = True
    else:
        out.append(ln)
if not replaced:
    if out and out[-1].strip():
        out.append("")
    out.append("KNOWT_SECRET_TINY_TOKEN=" + val)

defaults = {
    "KNOWT_ENV": "production",
    "KNOWT_DATA_DIR": "/root/knowt-data",
    "KNOWT_ORG_ID": "default",
    "KNOWT_HOST": "127.0.0.1",
    "KNOWT_PORT": "8766",
}
keys_present = {
    ln.split("=", 1)[0]
    for ln in out
    if "=" in ln and not ln.strip().startswith("#")
}
for k, v in defaults.items():
    if k not in keys_present:
        out.insert(0, "%s=%s" % (k, v))

env_path.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8")
env_path.chmod(0o600)
src.unlink(missing_ok=True)
print("KNOWT_ENV_OK present_len=%d" % len(val))
