# Hermes knowt (SOUL + MCP)

**Estado:** fatia SOUL + MCP no bridge knowt (2026-08-09).  
**Não** usa o Hermes / SOUL / Mongo da VPS Fiesta.

## Peças

| Peça | Path |
|------|------|
| Catálogo | `src/knowt/agent_catalog.py` |
| MCP stdio | `scripts/hermes_knowt_mcp.py` |
| Config SOUL/MCP | `scripts/configure_hermes_knowt.py` |
| Skill | `docs/hermes/knowt/SKILL.md` |
| Chat LLM helper | `src/knowt/hermes_chat.py` |
| Bridge | `GET /api/bridge/catalog` · `POST /api/bridge/assistant/chat` |

## Bridge

- Base: `http://127.0.0.1:8766/api/bridge`
- Auth: `KNOWT_API_TOKEN` (`X-Knowt-Token` / Bearer)
- Health: `hermes_bin`, `assistant_engine`

## Motor do assistente

| `KNOWT_ASSISTANT_ENGINE` | Comportamento |
|--------------------------|---------------|
| `deterministic` | Respostas factuais + HTML Telegram (sem LLM) |
| `hermes` | `hermes chat -q` + MCP (**Telegram em produção**) |
| `auto` | Hermes se o binário existir |

Override por pedido: `context.engine=hermes|deterministic` no body do chat.  
Telegram também aceita `KNOWT_TELEGRAM_ENGINE=hermes` (força no bot independente do bridge).

Telegram continua no **bot fino** (`knowt-telegram`) → bridge.  
**Não** activar Telegram no `hermes-gateway` com o mesmo token (duplicaria).

### Activar LLM no Telegram (VPS)

```bash
# em /root/knowt/.env
KNOWT_ASSISTANT_ENGINE=hermes
KNOWT_TELEGRAM_ENGINE=hermes
KNOWT_HERMES_CHAT_TIMEOUT=120
KNOWT_TELEGRAM_BRIDGE_TIMEOUT=150

cp /root/knowt/deploy/knowt-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl restart knowt-api knowt-telegram
curl -s http://127.0.0.1:8766/api/bridge/health
# expect: "assistant_engine":"hermes","hermes_bin":true
```

## Instalar / aplicar na VPS

```bash
# 1) Instalar Hermes (uma vez)
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash

# 2) Chave LLM em /root/.hermes/.env (OPENROUTER_API_KEY=…)

# 3) Configurar MCP + SOUL
cd /root/knowt
set -a && . ./.env && set +a
python3 scripts/configure_hermes_knowt.py

# 4) Smoke MCP
hermes mcp test knowt-gateway

# 5) Smoke chat LLM (opcional)
hermes chat -q "Pedidos esta semana no Tiny" -Q --skills knowt
```

## DoD

Ver `.cursor/rules/hermes-contract-dod.mdc`: path no bridge + entrada no catálogo + SOUL se atalho + smoke.
