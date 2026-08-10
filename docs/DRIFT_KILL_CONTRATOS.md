# Drift, kill switch e contratos (knowt)

Alinha com o plano completo (`PLANO_ONBOARDING_AUTONOMO_SISTEMAS` · §8.11, Gates 5/10, **Fase 2** contratos, **Fase 9** drift) e com a visão knowt (mesmo núcleo, sem espelho `bi_*` Fiesta).

## Contratos (fábrica)

Pasta: `{KNOWT_DATA_DIR}/contracts/`

| Contrato | Versão | Status seed | Notas |
|---|---|---|---|
| `orders.v1` | `1.0.0` | **published** | campo obrigatório `id`; opcionais situacao/valor/… |
| `sales.v1` | `1.0.0` | **draft** | bloqueado até gates de negócio (CMV) |

Cada documento inclui hash SHA-256, timezone, moeda, limitações, producer/consumers, aprovações.

```http
GET  /api/bridge/contratos
GET  /api/bridge/contratos/{id}/{version}
POST /api/bridge/contratos/{id}/{version}/status
     {"status":"approved|published|deprecated","actor":"…","note":"…"}
```

Publicar capability **não** é automático a partir do contrato — continua via `publish.py` + gates.

## Kill switch

Suspende a **fonte** (não o Hermes inteiro). Chat e `/fonte/status` respeitam.

```http
POST /api/bridge/fontes/tinyerp/kill-switch
{"suspended": true, "reason": "incidente recon", "actor": "ops"}

POST /api/bridge/fontes/tinyerp/kill-switch
{"suspended": false, "actor": "ops"}
```

- `suspended=true` exige `reason`
- Enforcement: `SOURCE_SUSPENDED` (também no canal Hermes)
- **Nunca** é activado só pelo cron/check de drift

## Drift

Persistência: `{KNOWT_DATA_DIR}/drift/` (`baseline_*.json`, `events.jsonl`, `last_*.json`)

Tipos de alerta:

| Tipo | Exemplos de code |
|---|---|
| schema_drift | `NO_BASELINE_DRIFT`, `FIELD_SET_CHANGED` |
| contract_break | `CONTRACT_FIELD_MISSING` |
| reconciliation_drift | `API_UNREACHABLE`, `RECON_SAMPLE_EMPTY` |

```http
POST /api/bridge/drift/check
{"source_id":"tinyerp","actor":"ops"}

GET  /api/bridge/drift/events?source_id=tinyerp&limite=20
GET  /api/bridge/fonte/status?source_id=tinyerp
```

`suggest_kill_switch=true` quando há severidade error/critical — **sem** auto-suspender.

Opcional agressivo: `KNOWT_DRIFT_AUTO_DEMOTE=1` demove capabilities `orders.*` live → `pending` (ainda sem kill da fonte). Off por defeito.

## Reason codes

Ver `src/knowt/reason_codes.py` (catálogo curto alinhado ao Fiesta Fase 5).

## Cron (VPS)

Unit: `deploy/knowt-drift-cron.service` + `knowt-drift-cron.timer` (cada 2 h).

```bash
cp /root/knowt/deploy/knowt-drift-cron.service /etc/systemd/system/
cp /root/knowt/deploy/knowt-drift-cron.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now knowt-drift-cron.timer
systemctl start knowt-drift-cron.service   # corre já
journalctl -u knowt-drift-cron.service -n 30 --no-pager
```

Script: `scripts/run_drift_cron.py` → `run_drift_check` + alerta Telegram se `suggest_kill_switch`.

Alertas: definir `KNOWT_DRIFT_ALERT_CHAT_IDS` (IDs numéricos). Se `KNOWT_TELEGRAM_CHAT_IDS=*` o cron **não** envia alerta (evita spam/indiscriminado).

```bash
# exemplo: cada 2 h (equivale ao timer)
curl -sS -X POST -H "X-Knowt-Token: $KNOWT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source_id":"tinyerp","actor":"cron"}' \
  http://127.0.0.1:8766/api/bridge/drift/check
```

## O que isto ainda não é

- Gerador completo de conector a partir do contrato (§8.12 codegen)
- Drift semântico de distribuição/margem (depende de `sales.v1` published)
- Multi-fonte genérico além do piloto Tiny
