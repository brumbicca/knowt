import json
import os
import urllib.error
import urllib.request
from pathlib import Path


def load_env(path: Path) -> None:
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def main() -> None:
    load_env(Path("/root/knowt/.env"))
    token = (os.environ.get("KNOWT_API_TOKEN") or "").strip()
    assert token, "missing KNOWT_API_TOKEN"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }

    # health open
    with urllib.request.urlopen("http://127.0.0.1:8766/health", timeout=15) as r:
        health = json.loads(r.read().decode())
    print("health_ok", health.get("ok"), "auth_required", health.get("auth_required"))

    # unauthorized without token
    req = urllib.request.Request("http://127.0.0.1:8766/v1/sources")
    try:
        urllib.request.urlopen(req, timeout=15)
        print("unauth_unexpected_ok")
    except urllib.error.HTTPError as exc:
        print("unauth_status", exc.code)

    for msg in [
        "pedidos cancelados esta semana",
        "o que podes responder?",
    ]:
        req = urllib.request.Request(
            "http://127.0.0.1:8766/v1/chat/answer",
            data=json.dumps({"message": msg, "source_id": "tinyerp"}).encode(),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            out = json.loads(r.read().decode())
        print("---", msg)
        print(
            out["enforcement"]["mode"],
            out["enforcement"].get("capability_id"),
            out["enforcement"].get("reason_code"),
        )
        print((out.get("answer") or "")[:360])

    audit = Path("/root/knowt-data/audit/answers.jsonl")
    print("audit_exists", audit.exists())
    if audit.exists():
        lines = audit.read_text(encoding="utf-8").strip().splitlines()
        print("audit_lines", len(lines))


if __name__ == "__main__":
    main()
