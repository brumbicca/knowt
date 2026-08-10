# Dossiê Discovery — Tiny / Olist (knowt)

**Fonte:** `tinyerp` · evidências Playwright + probe API (sem publish cego)

## Resumo

- Mapa base: **9** páginas
- Expand menus: **41** links · **41/41** visitadas OK
- Relatórios oficiais de margem: **2** OK · tabela gerada: **2**/2
- Amostra aba Custos: **ok**
- Probe vendas (7d): **3503** pedidos
- Recon relatório oficial ↔ probe: **aligned_sample**
- Gate `cost_field`: **`defer`**
- `approved_to_publish`: **False**

## Bloqueios para publish

- cost_field=defer (aguardar dono)
- approved_to_publish=false

## Relatórios oficiais de margem

### Tiny - Avaliação de margem
- URL: `https://erp.olist.com/relatorios_personalizados#/view/27`
- Geração tabela: **ok** · linhas amostra: **100** · atalho: `ultimos_7_dias`
- Cabeçalhos gerados: Natureza de operação, Número, Canal de venda, Identificador do pedido e-commerce, Total Produtos, Valor total da venda, Desconto, Comissão canal de venda, Frete pago pelo cliente, Frete pago pela empresa, UF, Valor ICMS
- Colunas seleccionadas (amostra): Início, Cadastros, Suprimentos, Vendas, Finanças, Fixar menu, ferramentas, relatórios personalizados, Natureza de operação, Número, Canal de venda, Identificador do pedido e-commerce
- No catálogo «adicionar colunas»: **Preço de custo atual, Custo médio atual**

### Margem de Contribuição
- URL: `https://erp.olist.com/relatorios_personalizados#/view/17`
- Geração tabela: **ok** · linhas amostra: **100** · atalho: `ultimos_7_dias`
- Cabeçalhos gerados: Número, Data da venda, Quantidade de produtos, Valor de desconto, Valor total da venda
- Colunas seleccionadas (amostra): Início, Cadastros, Suprimentos, Vendas, Finanças, Fixar menu, ferramentas, relatórios personalizados, Número, Data da venda, Quantidade de produtos, Valor de desconto
- No catálogo «adicionar colunas»: **Preço de custo atual, Custo médio atual**


## Reconciliação relatório oficial ↔ probe

- Verdict: **aligned_sample**
- Situações (selecionar todas): **True**
- Probe pedidos 7d: **3503** · página relatório: **100** linhas / **54** nº únicos
- Valor 1ª página: relatório **3737.42** · API **4905.63**
- Overlap números (amostra): 380980, 380981
- Relatório UI 1ª página ≈ pedidos mais recentes (Nº alto).
- API page_bounds: 36 páginas · total 3503.
- Situações selecionar todas no relatório: True.
- overlap última página API ∩ relatório: 2 → ['380980', '380981']
- valor 1ª pág relatório=3737.42 · API pág1=4905.63 · API última=104.68

## Amostra aba Custos (produto)

- Produto: Balão Redondo Liso 10" Azul Cromado Bello Festas c/50 un
- URL: `https://erp.olist.com/produtos#edit/746881543`

- **Preço custo** (`preco_custo`) = 0,81
- **Custo médio** (`preco_custo_medio`) = 18,31

## Módulos / páginas observadas (expand)

- Home — `https://erp.olist.com/`
- Pedidos de Venda — `https://erp.olist.com/vendas#list`
- Pedidos no e-commerce — `https://erp.olist.com/lista_pedidos_ecommerce`
- Notas Fiscais — `https://erp.olist.com/notas_fiscais#list`
- Relatórios (vendas) — `https://erp.olist.com/relatorios_sistema?id=3`
- Produtos — `https://erp.olist.com/produtos#list`
- Clientes — `https://erp.olist.com/contatos#/`
- Estoque / depósitos — `https://erp.olist.com/depositos#list`
- Contas a receber — `https://erp.olist.com/contas_receber#list`
- Início — `https://erp.olist.com/index`
- Suprimentos — `https://erp.olist.com/estoques`
- Vendas — `https://erp.olist.com/crm#list`
- Finanças — `https://erp.olist.com/caixa`
- Anúncios — `https://erp.olist.com/anuncios`
- Categorias dos Produtos — `https://erp.olist.com/produto_categorias`
- Vendedores — `https://erp.olist.com/vendedores#list`
- Embalagens — `https://erp.olist.com/embalagens`
- adicionar integração — `https://erp.olist.com/integracoes#/new?onboarding=1`
- Envios Fulfillment — `https://erp.olist.com/envios_fulfillment#/`
- Ordens de Compra — `https://erp.olist.com/pedidos_compra#list`
- Notas de Entrada — `https://erp.olist.com/notas_entrada#list`
- Conferência de compra — `https://erp.olist.com/entrada_de_mercadorias`
- Necessidades de Compra — `https://erp.olist.com/relatorio_necessidade_compra`
- Giro de Estoque — `https://erp.olist.com/giro_estoque`
- Painel de Automações — `https://erp.olist.com/automacoes`
- PDV — `https://erp.olist.com/pdv`
- Propostas Comerciais — `https://erp.olist.com/orcamentos#list`
- Comissões — `https://erp.olist.com/comissoes#list`
- Performance de Vendas — `https://erp.olist.com/metas_venda#list`
- Margem Contribuição — `https://erp.olist.com/margem_contribuicao`
- Custos do e-commerce — `https://erp.olist.com/custos_ecommerce#list`
- Google Shopping — `https://erp.olist.com/google_shopping_configuracoes`
- Separação — `https://erp.olist.com/separacao`
- Expedição — `https://erp.olist.com/expedicao`
- Devoluções de venda — `https://erp.olist.com/devolucoes_vendas`
- Perguntas do e-commerce — `https://erp.olist.com/perguntas_ecommerce`
- Pós-venda Mercado Livre — `https://erp.olist.com/ecommerce_pos_venda`
- Transações de vendas — `https://erp.olist.com/demonstrativo_de_vendas#/`
- Contas a Pagar — `https://erp.olist.com/contas_pagar`
- Cobranças Bancárias — `https://erp.olist.com/cobrancas_registradas#remessas`

## Perguntas humanas em aberto

- No CMV do piloto: usar Preço de custo ou Custo médio (ambos existem na aba Custos e no catálogo dos relatórios oficiais)?

---

Gerado a partir de `evidence/*_latest.json`. Regenerar: `python scripts/build_discovery_dossier.py`.
