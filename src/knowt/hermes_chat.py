"""Invoca `hermes chat -q` (cérebro LLM + MCP knowt)."""
from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

HERMES_BIN = os.environ.get("KNOWT_HERMES_BIN") or shutil.which("hermes") or "hermes"
HERMES_CHAT_TIMEOUT = int(os.environ.get("KNOWT_HERMES_CHAT_TIMEOUT") or "120")
HERMES_CHAT_SOURCE = os.environ.get("KNOWT_HERMES_CHAT_SOURCE") or "knowt-bridge"
_SESSION_RE = re.compile(r"session[_ ]?id[:=]\s*([^\s]+)", re.I)
# IDs reais do Hermes CLI (ex.: 20260809_201559_66b44d) — não tg-123
_HERMES_RESUME_RE = re.compile(r"^\d{8}_\d{6}_[0-9a-f]+$", re.I)
_NOISE_LINE_RE = re.compile(
    r"^(?:\x1b\[[0-9;]*m)*(?:ℹ|✔|⚠|Loading|Thinking|Tool call|MCP|session|Use a session)",
    re.I,
)


def hermes_available() -> bool:
    explicit = (os.environ.get("KNOWT_HERMES_BIN") or "").strip()
    if explicit and Path(explicit).is_file():
        return True
    found = shutil.which("hermes")
    return bool(found and Path(found).is_file())


def parse_hermes_chat_output(text: str) -> Tuple[Optional[str], str]:
    session_id = None
    m = _SESSION_RE.search(text or "")
    if m:
        session_id = m.group(1).strip()
    lines = (text or "").replace("\r\n", "\n").split("\n")
    body_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            body_lines.append(line)
            continue
        if _SESSION_RE.match(stripped) or _NOISE_LINE_RE.match(stripped):
            continue
        cleaned = re.sub(
            r"\s*↻\s*Resumed session\s+\S+.*$",
            "",
            line,
            flags=re.I,
        ).rstrip()
        if cleaned.strip():
            body_lines.append(cleaned)
    reply = "\n".join(body_lines).strip()
    return session_id, reply


def run_hermes_chat(
    message: str,
    *,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    msg = (message or "").strip()
    if not msg:
        return {"ok": False, "error": "message_required"}
    if len(msg) > 4000:
        return {"ok": False, "error": "message_too_long"}

    guided = (
        "[knowt · Tiny piloto] Responde em pt-BR. "
        "Usa knowt_catalog / knowt_query. "
        "Pedidos: /vendas/periodo periodo=semana|mes|hoje. "
        "Discovery: /discovery/dossier. "
        "Receita/margem → n/d (não inventar R$). "
        "Preferir intro curta + tabela Indicador|Valor quando houver números. "
        "Sem clichés de atendimento.\n"
        "Pergunta do utilizador:\n"
        + msg
    )
    skills = (os.environ.get("KNOWT_HERMES_CHAT_SKILLS") or "knowt").strip()
    cmd = [
        HERMES_BIN,
        "chat",
        "-q",
        guided,
        "-Q",
        "--accept-hooks",
        "--source",
        HERMES_CHAT_SOURCE,
    ]
    if skills:
        cmd.extend(["--skills", skills])
    if session_id and _HERMES_RESUME_RE.fullmatch(session_id):
        cmd.extend(["--resume", session_id])

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=HERMES_CHAT_TIMEOUT,
            env={**os.environ, "HERMES_ACCEPT_HOOKS": "1"},
        )
    except FileNotFoundError:
        return {
            "ok": False,
            "error": "hermes_not_found",
            "message": f"Binário não encontrado: {HERMES_BIN}",
        }
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "error": "timeout",
            "message": f"Hermes excedeu {HERMES_CHAT_TIMEOUT}s",
        }

    combined = ((proc.stdout or "") + "\n" + (proc.stderr or "")).strip()
    out_session, reply = parse_hermes_chat_output(combined)
    if proc.returncode != 0 and not reply:
        return {
            "ok": False,
            "error": "hermes_failed",
            "exit_code": proc.returncode,
            "message": combined[-800:] or f"exit {proc.returncode}",
        }
    if not reply:
        return {
            "ok": False,
            "error": "empty_reply",
            "session_id": out_session or session_id,
        }
    return {
        "ok": True,
        "reply": reply,
        "session_id": out_session or session_id,
        "source": HERMES_CHAT_SOURCE,
        "engine": "hermes",
    }


def assistant_engine() -> str:
    """deterministic (padrão) | hermes | auto (hermes se binário existir)."""
    raw = (os.environ.get("KNOWT_ASSISTANT_ENGINE") or "deterministic").strip().lower()
    if raw in ("hermes", "llm"):
        return "hermes"
    if raw == "auto":
        return "hermes" if hermes_available() else "deterministic"
    return "deterministic"
