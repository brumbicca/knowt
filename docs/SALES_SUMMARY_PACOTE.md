# Pacote knowt — sales.summary / margem (sem publicar cego)

**Actualizado:** 2026-08-09  
**Capability:** `sales.summary` + `margins.summary` → **unavailable** até gates  
**Herdança:** espírito do Fiesta `docs/TINY_MARGEM_28c1_PACOTE_NEGOCIO.md` (§28c.1)

**Smoke produção (2026-08-09):** probe live gravou evidence (~3375 ped. / 7d; soma valor só pág.1);
`can_publish=false`; gates em falta; `sales.summary` permanece `unavailable`.
Bridge: `GET /api/bridge/sales/probe/latest` e `/insights/plano` (Bearer).

## O que o knowt faz agora

1. **Probe técnico** (`python scripts/run_sales_probe.py`)  
   - Conta pedidos do período (live `orders.list`)  
   - Soma `valor` **só da 1ª página** Tiny (evidência; **não** extrapola)  
   - Amostra `pedido.obter` (valor_total) em poucos ids  
   - **Não** calcula CMV/margem  
   - Grava em `KNOWT_DATA_DIR/evidence/sales_probe_*.json` + `sales_probe_latest.json`

2. **Checklist de negócio** (`KNOWT_DATA_DIR/sales_summary_gates.json`)  
   Campos obrigatórios antes de qualquer publish:

   | Chave | Pergunta |
   |---|---|
   | `cost_field` | `preco_custo` ou `preco_custo_medio` (ou `defer`) |
   | `matches_official_report` | Amostra aproxima relatório oficial? (`yes`/`no`/`unknown`) |
   | `missing_cost_policy` | Sem custo: `exclude` / `zero` / `block_metric` |
   | `cmv_composition_ok` | CMV só produto ou inclui imposto/frete? |
   | `approved_to_publish` | `true` só após dono de negócio |
   | `approver` | Quem aprovou |

3. **Publish** (`publish_sales_summary_live`) recusa se faltar gate — erro explícito.

## O que NÃO fazer

- Extrapolação inventada de receita (página × N páginas) como fato  
- Publicar margem “estimada” como `machine_validated`  
- Usar Mongo/`bi_tinyerp` do Fiesta como verdade do knowt  
- Média cega entre campos de custo

## Texto curto para o Time (adaptado knowt)

> Estamos a preparar vendas/margem no **knowt** (chat + Insights), ligados à Tiny, sem inventar números.  
> No cadastro Tiny, o CMV de produto que usam no dia a dia é **preço de custo** ou **preço de custo médio**?  
> Produto sem custo: excluimos, zeramos, ou bloqueamos a métrica até o cadastro estar completo?  
> Impostos/frete/taxas entram no CMV de vocês neste piloto, ou deixamos CMV só de produto?  
> Quando tiveremos um relatório oficial do mesmo período para cruzar a amostra do probe?

## Depois das respostas

1. Preencher `sales_summary_gates.json`  
2. Expandir enrich/amostra se necessário  
3. Reconciliar 1 período com relatório Tiny  
4. Só então `publish_sales_summary_live` (+ margins quando aplicável)
