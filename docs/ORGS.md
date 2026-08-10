# Organizações / tenancy (knowt)

**Actualizado:** 2026-08-10

## Estado

MVP de **org real** (fundação), ainda **single-tenant** em produção:

- Org padrão: `KNOWT_ORG_ID` (default `default`) — «knowt piloto»
- Fonte Tiny seed com `org_id` dessa org
- API: `GET /api/bridge/organizacoes` · `GET /api/bridge/organizacoes/<org_id>`
- Chat/fontes recusam `org_mismatch` se `context.org_id` ≠ `source.org_id`
- Persistência: Mongo `orgs` se `mongo_ok`; senão `data_dir/orgs.json`

## O que ainda **não** é

- Login multi-empresa / convites
- Billing
- Isolamento completo de secret vault por org (vault ainda é env global da VPS)
- N orgs activas em paralelo no Telegram (um bot → org default)

## Uso

```bash
curl -sS -H "X-Knowt-Token: $KNOWT_API_TOKEN" \
  http://127.0.0.1:8766/api/bridge/organizacoes
```

No chat: `context.org_id` (opcional; default do `.env`).
