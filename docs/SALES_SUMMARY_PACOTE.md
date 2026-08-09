# Pacote knowt — sales.summary / margem (sem publicar cego)

**Actualizado:** 2026-08-09  
**Capability:** `sales.summary` + `margins.summary` → **unavailable** até gates  
**Herdança:** espírito do Fiesta `docs/TINY_MARGEM_28c1_PACOTE_NEGOCIO.md` (§28c.1)

**Smoke produção (2026-08-09):** probe live gravou evidence (~3375 ped. / 7d; soma valor só pág.1);
`sales.summary` permanece `unavailable`.
Bridge: `GET /api/bridge/sales/probe/latest` e `/insights/plano` (Bearer).

**Gates (2026-08-09):** VPS `sales_summary_gates.json` —
`cost_field=defer`, `missing_cost_policy=block_metric`, `cmv_composition_ok=product_only`,
`matches_official_report=yes` (amostra 3/3 na UI + contagem ~3465/3467).
**`approved_to_publish=false`** (falta dono + `cost_field` ≠ defer antes de publish).

## Como exportar no Tiny (mesmo período do probe)

**Alvo do probe** (não reabrir data à sorte — usar estas):

| Item | Valor |
|---|---|
| Período | **03/08/2026 → 09/08/2026** (datas Tiny `dataInicial`/`dataFinal`) |
| Contagem API | **3375** pedidos (`page_bounds`, 34 páginas) |
| Receita período | **não** fechar ainda — API só somou página 1 = **R$ 4.905,63** (100 pedidos) |
| Amostra p/ bater valor | ids `758016016` (30,64), `758016114` (7,74), `758016270` (35,18) |

### Passo a passo (UI Tiny ERP)

1. Entrar em [erp.tiny.com.br](https://erp.tiny.com.br) na **mesma conta** do token knowt.
2. Ir a **Vendas → Pedidos de venda** (lista de pedidos; não “orçamentos”).
3. Filtros:
   - **Data inicial** = `03/08/2026`
   - **Data final** = `09/08/2026`
   - Usar o filtro de **data do pedido** (o que a Tiny usa na pesquisa — o mesmo critério da API `pedidos.pesquisa`).
   - **Situação** = todas / sem filtro (o probe não filtrou situação).
   - **Ecommerce / vendedor / depósito** = sem filtro extra.
4. Anotar o **total de pedidos** que a lista/paginação mostra (canto da listagem ou última página × tamanho).
5. Abrir **3 pedidos da amostra** acima e copiar: nº, data, situação, valor total.
6. (Opcional) Em **Relatórios → Vendas** (ou equivalente “pedidos por período”), gerar o mesmo intervalo e anotar **qtd + faturamento total** se o relatório existir — marcar se o relatório exclui cancelados.

### O que me enviar no chat (cola assim)

```
período: 03/08/2026–09/08/2026
total_pedidos_ui: <n>
filtros: data do pedido, sem situação
faturamento_relatorio: <R$ ou n/d>
amostra:
  758016016 → valor UI: … situação: …
  758016114 → valor UI: … situação: …
  758016270 → valor UI: … situação: …
diferença_contagem: <ui − 3375>
notas: …
```

### Critério para `matches_official_report`

| Resultado | Gate |
|---|---|
| Contagem UI ≈ 3375 (± poucos / mesma regra de data) e amostra de valor bate | `yes` |
| Contagem ou amostra diverge e não há explicação (cancelados, outro filtro de data) | `no` |
| Ainda sem export / dúvida de filtro | `unknown` (como agora) |

**Não** marcar `approved_to_publish=true` só porque a contagem bate — falta ainda `cost_field` ≠ `defer` (ou decisão explícita) + dono.

## Discovery UI Playwright (conhecer o sistema)

```text
pip install "playwright>=1.40,<2"
python -m playwright install chromium
python scripts/run_discovery_ui.py login
# mapa do ERP (navegação + páginas-chave):
python scripts/run_discovery_ui.py probe-system
# fatia margem (não preenche gate):
python scripts/run_discovery_ui.py probe-cost --product-id 747196165
```

- Sessão: `$KNOWT_DATA_DIR/discovery/tinyerp/storage_state.json`
- Mapa: `evidence/ui_system_map_*.json`
- Custos: `evidence/ui_tiny_product_cost_*.json`
- **Não** publica capability nem preenche `cost_field` sozinho

`cost_field` fica **`defer`** até o dono escolher preço custo vs custo médio  
(evidência: SKU balão UI/API 0,81 vs 18,31).

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
