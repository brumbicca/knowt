# Banco de dados no knowt — o que temos e o que virá

**Actualizado:** 2026-08-08

## Resposta curta

Hoje o knowt **não usa Mongo/Postgres**.  
Os dados “de sistema” (fontes, capabilities, audit) ficam em **ficheiros** em `/root/knowt-data`.  
Os **pedidos** vêm **ao vivo da Tiny** (API), não de um espelho local tipo Fiesta `bi_tinyerp`.

## Comparação com o Fiesta

| | Fiesta | knowt (agora) |
|---|---|---|
| Pedidos / BI | Mongo `bi_*` (espelho + sync) | Leitura directa Tiny quando perguntas |
| Registry / capabilities | Mistura DB + código | `sources.json` no disco |
| Porquê | Operação + dashboards + sync | Chat-first, zero espelho obrigatório |

Isto é **de propósito** na visão: o knowt não depende de copiar o Mongo do Fiesta.

## O que existe em disco

```
/root/knowt-data/
  sources.json          # fontes + capabilities (live / unavailable)
  audit/answers.jsonl   # log das perguntas/respostas (sem secrets)
```

Segredos (token Tiny, API Bearer, senha do chat) ficam em `/root/knowt/.env` (não no “banco”).

## Quando terá Mongo (ou outro DB)?

Só quando fizer sentido de produto, por exemplo:

1. **Histórico de conversas** / multi-utilizador  
2. **Cache / materialização** se a Tiny for lenta ou rate-limit apertar  
3. **Insights** persistidos (tendências, alertas)  
4. **Multi-tenant** SaaS (várias empresas)

Aí sim: **Mongo próprio na VPS knowt** (ou Postgres) — **nunca** o Mongo da VPS Fiesta.

## Regra

- Fonte de verdade dos pedidos piloto = **Tiny**.  
- knowt guarda **contratos + enforcement + audit**, não um segundo ERP silencioso.
