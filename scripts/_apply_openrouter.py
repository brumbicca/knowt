#!/usr/bin/env python3
from pathlib import Path
import base64

b64_path = Path("/tmp/or_key.b64")
raw = b64_path.read_text(encoding="ascii").strip()
line = base64.b64decode(raw).decode("ascii").strip()
assert line.startswith("OPENROUTER_API_KEY=")
env = Path("/root/.hermes/.env")
text = env.read_bytes().decode("latin-1")
lines = [
    ln.rstrip("\r")
    for ln in text.splitlines()
    if not ln.startswith("OPENROUTER_API_KEY=")
]
while lines and not lines[-1].strip():
    lines.pop()
lines.append(line)
env.write_text("\n".join(lines) + "\n", encoding="utf-8")
env.chmod(0o600)
b64_path.unlink(missing_ok=True)
for k in ("OPENROUTER_API_KEY", "VOICE_TOOLS_OPENAI_KEY"):
    ok = any(l.startswith(k + "=") and len(l) > len(k) + 5 for l in lines)
    print(k + ("=set" if ok else "=missing"))
