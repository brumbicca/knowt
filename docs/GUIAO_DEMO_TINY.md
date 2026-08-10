# Guião demo Tiny (piloto knowt) — T11

**Objectivo:** demonstração estável (web https://knowt.com.br + Telegram) com as **mesmas perguntas**.  
**Smoke automatizado:** `scripts/smoke_guiao_demo_tiny.py` (também fecha T7/T9).  
**Evidência:** `{KNOWT_DATA_DIR}/evidence/guiao_demo_latest.json`

## Antes de começar

1. `knowt-api` e `knowt-telegram` activos  
2. Fonte Tiny **não** suspensa (`GET /api/bridge/fonte/status`)  
3. `sales.summary` continua unavailable — a demo **deve** recusar receita/margem  

## Roteiro (ordem)

| # | Pergunta (colar tal qual) | Canal | Esperado |
|---|---|---|---|
| 1 | `o que podes consultar?` | web / TG | Catálogo; `orders.list` live; sales/margins unavailable |
| 2 | `Pedidos esta semana` | web / TG | Contagem = `GET /vendas/periodo?periodo=semana` · `pedidos_validos` |
| 3 | `pedidos por situação esta semana` | web / TG | Tabela Situação\|Pedidos; engine determinístico no Telegram |
| 4 | `qual a receita desta semana?` | web / TG | Recusa — capability sales não live (não inventa R$) |
| 5 | `o que já conhecemos do Tiny?` | web / TG | Dossiê discovery (observação; sem publish cego) |
| 6 | _(opcional UI)_ abrir Insights / strip da fonte | web | health ok · kill switch off |

## Critérios pass/fail

- **T11:** passos 1–5 passam no smoke (`ok: true`)  
- **T9:** passo 2 — número do chat == bridge  
- **T7:** passo 5 — reason `DISCOVERY_OBSERVATION` ou texto de dossiê presente  

## Corrida do smoke (VPS)

```bash
/root/knowt/.venv/bin/python /root/knowt/scripts/smoke_guiao_demo_tiny.py
```

Exit code `0` = guião verde. Regravar evidência e actualizar `docs/PILOTO_TINY_FECHADO.md`.

## Nota Telegram

O bot usa o mesmo `POST /assistant/chat` com `channel=telegram`.  
Não é preciso UI Telegram no smoke — paridade de contrato é suficiente; validação visual ocasional no telemóvel.
