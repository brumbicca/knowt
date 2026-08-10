# Banco de dados no knowt — o que temos e o que virá

**Actualizado:** 2026-08-10

## Resposta curta

- **Mongo próprio** na VPS knowt: `127.0.0.1:27017`, DB `knowt` — **instalado** (health `mongo_ok`).
- Pedidos do piloto **continuam** a vir da **API Tiny** (sem espelho obrigatório tipo Fiesta `bi_tinyerp`).
- Registry / agenda / audit ainda em **ficheiros** em `/root/knowt-data` (migração gradual depois).

## Comparação com o Fiesta

| | Fiesta | knowt (agora) |
|---|---|---|
| Pedidos / BI | Mongo `bi_*` (espelho + sync) | Leitura directa Tiny; Mongo pronto para cache/histórico |
| Registry / capabilities | Mistura DB + código | `sources.json` no disco |
| Mongo | VPS Fiesta | **VPS knowt** (nunca o da Fiesta) |

## Config

```bash
KNOWT_MONGO_URI=mongodb://127.0.0.1:27017
KNOWT_MONGO_DB=knowt
```

Instalação: `deploy/install_mongodb.sh` (só loopback).

## O que existe em disco

```
/root/knowt-data/
  sources.json
  audit/answers.jsonl
  agenda.json
  tasks.json
```

## Próximos usos do Mongo (ainda não)

1. Histórico de conversas / multi-utilizador  
2. Cache / materialização se Tiny for lenta  
3. Insights persistidos  
4. Multi-tenant  

## Regra

- Fonte de verdade dos pedidos piloto = **Tiny**.  
- Mongo knowt **≠** copiar o Mongo Fiesta.
