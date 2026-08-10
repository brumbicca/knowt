#!/usr/bin/env python3
"""Configura Hermes (instância knowt) → MCP knowt-gateway + SOUL.

Idempotente. Correr na VPS knowt após instalar o binário `hermes`.

  HERMES_HOME=/root/.hermes python3 scripts/configure_hermes_knowt.py
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML required (pip install pyyaml)", file=sys.stderr)
    raise SystemExit(1)

HERMES_HOME = Path(os.environ.get("HERMES_HOME", "/root/.hermes"))
CONFIG_PATH = HERMES_HOME / "config.yaml"
SOUL_PATH = HERMES_HOME / "SOUL.md"
HERMES_PY = Path(
    os.environ.get(
        "HERMES_PYTHON",
        "/usr/local/lib/hermes-agent/venv/bin/python",
    )
)
REPO_ROOT = Path(__file__).resolve().parent.parent
MCP_SCRIPT = Path(
    os.environ.get("KNOWT_MCP_SCRIPT", str(REPO_ROOT / "scripts" / "hermes_knowt_mcp.py"))
)
SKILL_SRC = REPO_ROOT / "docs" / "hermes" / "knowt" / "SKILL.md"
SKILL_DST = HERMES_HOME / "skills" / "knowt" / "SKILL.md"
MCP_SERVER_NAME = "knowt-gateway"
BRIDGE = os.environ.get("KNOWT_AGENT_BRIDGE", "http://127.0.0.1:8766/api/bridge").rstrip("/")

KNOWT_SOUL = """## knowt (assistente de compreensão Tiny ERP)

És o assistente do **knowt** — piloto Tiny ERP / Olist. Não és o Hermes da Fiesta.

### Tom

1. Português do Brasil, natural e directo (Telegram / chat).
2. Preferência visual: intro curta + tabela simples (Indicador | Valor) quando houver números.
3. Fecha com **uma** pergunta útil — nunca clichés («à disposição», «caso precise…»).
4. Fonte activa do piloto: **tinyerp**. Não inventes outras empresas nem marketplaces Fiesta.

### Zero verdade silenciosa

- `orders.list` / contagem de pedidos: **live** — usa `knowt_query`.
- Receita, taxas, líquido, **margem/CMV**: ainda **unavailable** até aprovação de negócio — responde **n/d**, nunca inventa R$.
- Discovery / dossiê: observação (não publish). Path `/discovery/dossier`.

### Fluxo obrigatório

1. **`knowt_catalog`** — mapa de paths.
2. **`knowt_query`** — GET com `path` do catálogo + `periodo=` quando fizer sentido.
3. **`knowt_action`** — só agenda/tarefas locais (`/tarefas`, `/tarefas/concluir`, `/agenda/eventos`).
4. Responde só com dados retornados. Se falhar, diz o erro e para.

### Atalhos (`knowt_query`)

| Pergunta | path | params |
|----------|------|--------|
| Pedidos esta semana | `/vendas/periodo` | `periodo=semana` |
| Pedidos do mês | `/vendas/periodo` | `periodo=mes` |
| Pedidos hoje | `/vendas/periodo` | `periodo=hoje` |
| O que já conhecemos do Tiny? | `/discovery/dossier` | — |
| Status da fonte | `/fonte/status` | `source_id=tinyerp` |
| Insights / o que destaco | `/insights/resumo` | `periodo=semana` |
| Agenda | `/agenda/periodo` | `periodo=semana` |
| Tarefas | `/tarefas` | `status=open` |
| Catálogo | `/catalog` | — |

### Proibido

- Inventar paths fora do catálogo.
- Usar ferramentas / SOUL / bridge da Fiesta.
- Tratar margem como facto antes do publish.
"""


def _load_token() -> str:
    token = (os.environ.get("KNOWT_API_TOKEN") or "").strip()
    if token:
        return token
    env_path = Path("/root/knowt/.env")
    if env_path.is_file():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("KNOWT_API_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def patch_mcp_server(cfg: dict) -> bool:
    token = _load_token()
    entry = {
        "command": str(HERMES_PY if HERMES_PY.is_file() else sys.executable),
        "args": [str(MCP_SCRIPT)],
        "enabled": True,
        "env": {
            "KNOWT_AGENT_BRIDGE": BRIDGE,
            "KNOWT_API_TOKEN": token,
            "PYTHONPATH": str(REPO_ROOT / "src"),
        },
        "tools": {
            "include": ["knowt_catalog", "knowt_query", "knowt_action"],
        },
    }
    servers = cfg.setdefault("mcp_servers", {})
    prev = servers.get(MCP_SERVER_NAME)
    if prev == entry:
        return False
    servers[MCP_SERVER_NAME] = entry
    return True


def patch_soul() -> bool:
    HERMES_HOME.mkdir(parents=True, exist_ok=True)
    marker = "## knowt (assistente de compreensão Tiny ERP)"
    if not SOUL_PATH.is_file():
        SOUL_PATH.write_text(KNOWT_SOUL.strip() + "\n", encoding="utf-8")
        return True
    text = SOUL_PATH.read_text(encoding="utf-8")
    if marker in text:
        # substituir bloco knowt se já existir
        parts = text.split("---")
        rebuilt: list[str] = []
        for part in parts:
            if marker in part:
                continue
            rebuilt.append(part)
        base = "---".join(rebuilt).rstrip()
        new_text = (base + "\n\n---\n\n" + KNOWT_SOUL.strip() + "\n") if base else (
            KNOWT_SOUL.strip() + "\n"
        )
        if new_text == text:
            return False
        SOUL_PATH.write_text(new_text, encoding="utf-8")
        return True
    SOUL_PATH.write_text(text.rstrip() + "\n\n---\n\n" + KNOWT_SOUL.strip() + "\n", encoding="utf-8")
    return True


def sync_skill() -> bool:
    if not SKILL_SRC.is_file():
        print("skill_src_missing", SKILL_SRC)
        return False
    SKILL_DST.parent.mkdir(parents=True, exist_ok=True)
    new = SKILL_SRC.read_text(encoding="utf-8")
    old = SKILL_DST.read_text(encoding="utf-8") if SKILL_DST.is_file() else None
    if old == new:
        return False
    SKILL_DST.write_text(new, encoding="utf-8")
    return True


def main() -> int:
    if not MCP_SCRIPT.is_file():
        print("mcp_script_missing", MCP_SCRIPT, file=sys.stderr)
        return 1
    HERMES_HOME.mkdir(parents=True, exist_ok=True)
    if CONFIG_PATH.is_file():
        cfg = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8")) or {}
    else:
        cfg = {
            "model": {
                "default": "openai/gpt-4o-mini",
                "provider": "openrouter",
                "base_url": "https://openrouter.ai/api/v1",
                "max_tokens": 2048,
            }
        }
        print("config_created")

    if patch_mcp_server(cfg):
        print("mcp_server_updated")
    else:
        print("mcp_server_ok")

    CONFIG_PATH.write_text(
        yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )

    if patch_soul():
        print("soul_updated")
    else:
        print("soul_ok")

    if sync_skill():
        print("skill_updated")
    else:
        print("skill_ok")

    hermes = shutil.which("hermes") or "/usr/local/bin/hermes"
    if Path(hermes).is_file() or shutil.which("hermes"):
        try:
            out = subprocess.run(
                [hermes, "mcp", "test", MCP_SERVER_NAME],
                capture_output=True,
                text=True,
                timeout=90,
            )
            print((out.stdout or out.stderr or "")[-1200:])
            if out.returncode == 0:
                print("mcp_test_ok")
            else:
                print("mcp_test_exit", out.returncode)
        except Exception as exc:
            print("mcp_test_skip", type(exc).__name__, exc)
    else:
        print("hermes_bin_missing — instale antes do mcp test")

    # reinício opcional do gateway (só se o unit existir e não partilhar Telegram com bot fino)
    if shutil.which("systemctl"):
        r = subprocess.run(
            ["systemctl", "is-active", "hermes-gateway"],
            capture_output=True,
            text=True,
        )
        if (r.stdout or "").strip() == "active":
            subprocess.run(["systemctl", "restart", "hermes-gateway"], check=False)
            print("hermes_gateway_restarted")
        else:
            print("hermes_gateway_inactive_ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
