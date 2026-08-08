# Visão — knowt (fábrica de compreensão de sistemas)

**Estado:** ideia em amadurecimento · **não implementar ainda**  
**Data:** 2026-08-08 (decisões nome/piloto/narrativa no mesmo dia)  
**Relação com Fiesta:** **Fiesta permanece tal qual** (`fiesta-api`, `fiesta-financial`, BI, espelhos, sync). Este documento descreve o produto **knowt**, ao lado, que herda o *plano* e o *aprendizado*, não o monólito operacional.

**Nome do produto:** **knowt** (domínio já reservado; VPS ainda não).  
**Frase interna / técnica:** *fábrica de compreensão de sistemas*.  
**Frase de produto:**

> knowt — compreensão de sistemas chat-first, multi-fonte (ERP/CRM/banco/plataforma) — sem depender do espelho Fiesta — autonomia máxima, **zero verdade silenciosa**.

**Narrativa comercial:** Fiesta e knowt são **produtos / histórias distintas** por ora (irmãos de aprendizado, não a mesma marca nem o mesmo pitch).

Alinha com a tese de `docs/PLANO_ONBOARDING_AUTONOMO_SISTEMAS.md` (§§1–4), trocando o consumidor primário de “Fiesta BI + Hermes acoplado à operação Fiesta” por “chat (Rica / Telegram / WhatsApp) + Insights”, com BI opcional depois.

---

## 0. Regras de convivência com o Fiesta

1. **Não tocar** no desenvolvimento contínuo do Fiesta para “virar” este produto.
2. Fiesta (Tiny, Tray, Shopee, BI, Hermes actual) continua como **laboratório e referência** — não camisa de força.
3. Código/docs úteis são **copiados ou extrahídos** para o knowt; não se “move” o coração do Fiesta para lá.
4. Duas linhas de produto = dois ciclos de deploy, dois Hermes (recomendado), **narrativas comerciais distintas** (decidido 2026-08-08).

---

## 1. O que é / o que não é

### É

- Plataforma que: **explora → compreende → documenta → valida → publica contratos/conectores**.
- Superfície principal: **chat** + **Insights**.
- Fontes: ERPs, CRMs, bancos, plataformas próprias, APIs futuras — **o que o sistema oferecer**, sem exigir espelho estilo `bi_*` operacional Fiesta.
- Gates humanos mínimos: autorizar acesso · resolver ambiguidade crítica · aprovar publicação.
- Enforcement: o agente **só** responde dentro de capability `live` + contrato versionado.

### Não é

- Fork silencioso do Fiesta com outro nome.
- “Copia o Mongo de pedidos e responde”.
- Omnisciência no dia 1 (“absolutamente tudo” sem validação).
- Substituto imediato do Fiesta Party / marketplaces / financeiro S2.

### Promessa defensável

> Ligamos à fonte da empresa, descobrimos e validamos o que pudermos provar, e o chat responde **dentro da cobertura comprovada**. O que não estiver validado não vira fato.

### O que não prometer

- Entende qualquer sistema só com a connection string.
- Qualquer campo vira KPI / resposta automática.
- A IA nunca precisa de confirmação humana.
- Mesmo schema = mesmo significado de negócio.

---

## 2. Relação com o plano actual (herança conceptual)

| Do plano Fiesta (`PLANO_ONBOARDING_…`) | Na Fábrica |
|---|---|
| Tese “acesso ≠ compreensão” | **Igual** — núcleo |
| Discovery (API + UI + docs + recon) | **Igual** — núcleo |
| Contratos / capabilities / reason codes | **Igual** — núcleo |
| Kill switch, drift, audit | **Igual** — núcleo |
| Agent Gateway + SOUL / catálogo DoD | **Igual** — núcleo (Hermes *novo*) |
| Espelho `bi_tinyerp` / sync S1 | **Não obrigatório** — só se a fonte exigir materialização |
| Wizard dentro do BI S2 | **Adaptar** — wizard do produto novo (pode ser thin UI + chat) |
| Fiesta operacional / marketplaces | **Fica no Fiesta** |

---

## 3. Mapa do que se copia / adapta / deixa

### 3.1 Levar (núcleo — copiar e desacoplar)

Prioridade alta — já existem pedaços úteis no repo Fiesta:

| Peça | Onde hoje (referência) | Nota na Fábrica |
|---|---|---|
| Discovery Engine + UI probe | `fiesta_discovery_engine`, `fiesta_discovery_ui` | Coração do produto |
| Semântica / gates / reason codes | `fiesta_semantic_engine`, `fiesta_reason_codes` | Sem atalho “Fiesta pedido” |
| Registry fontes / conexões / authz | `fiesta_bi_sources`, `fiesta_bi_connections`, org authz | Multi-tenant desde o dia 1 se possível |
| Capabilities + chat enforcement | `fiesta_capabilities_registry`, `fiesta_chat_enforcement` | Chat-first |
| Insights engine | `fiesta_insights_engine` | Manter; reformular painéis leves |
| Drift + kill switch docs/código | drift cron, FASE kill switch | Obrigatório |
| Bridge / MCP / catálogo padrão | `hermes_fiesta_bridge`, `agent_catalog`, configure Hermes | **Novo** Hermes + paths do produto |
| Contratos `orders.v1` / `sales.v1` como *exemplos* | seeds / connectors | Templates, não destino único |
| Filosofia DoD Hermes | `.cursor/rules/hermes-contract-dod.mdc` | Adaptar regra ao repo novo |

### 3.2 Adaptar (não colar cego)

- Nomes `fiesta_*` / `bi_*` → branding e schema do produto novo.
- Bind “token S1 Tiny” → bind genérico (cofre + secret refs).
- SOUL com atalhos Fiesta Party → SOUL por **fonte instalada**, sem pressupor marketplaces.
- Espelho shadow: opcional por conector (materializar vs query sob demanda / cache TTL).
- UI: wizard + Insights + chat; **sem** obrigar `fiesta-financial`.

### 3.3 Deixar no Fiesta (não copiar como núcleo)

- Sync unificado marketplaces, Celery ETL operacional, HUB pedidos.
- OAuth Shopee/ML/Shein/TikTok/Amazon/Tray como “produto”.
- Frontend financeiro / conciliação S2.
- Dependência de `api.fiestaup…` e Mongo operacional de produção Fiesta.
- Apresentação / roteiro demo 05/08 do BI Fiesta.

### 3.4 Piloto do knowt (decidido 2026-08-08)

- **Primeiro piloto do knowt: Tiny ERP / Olist** — reaproveita o aprendizado do §28c no Fiesta, mas o knowt **não** depende do espelho/`bi_tinyerp` do Fiesta como produto; o Tiny volta a ser onboarded *na narrativa knowt* (chat + Insights + contratos).
- Tray shadow, Salesforce Bello e o próprio Fiesta operacional continuam **laboratório / referência** — não o pitch do knowt.

---

## 4. Arquitectura alvo (nível bloco)

```text
[Fontes externas] ──► [Conexões + cofre]
                           │
                           ▼
                    [Discovery Engine]
                           │
                           ▼
              [Hipóteses + evidências + dossiê]
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
     [Contratos / capabilities]   [Perguntas humanas]
              │                         │
              ▼                         │
     [Publicação aprovada] ◄────────────┘
              │
     ┌────────┴────────┐
     ▼                 ▼
 [Agent Gateway]   [Insights]
     │
     ├── Chat web (tipo Rica)
     ├── Telegram
     └── WhatsApp (quando existir)
```

**Armazenamento:** dossiê + contratos + (opcional) cache/materialização por fonte — **não** “espelho Fiesta”.  
**Hermes:** instância **nova**, SOUL e MCP próprios, regra DoD própria.

---

## 5. Repo e VPS — recomendação

### 5.1 Repositório

| Opção | Prós | Contras |
|---|---|---|
| **A — Repo novo (recomendado)** | Fronteira clara; PRs/deploys sem risco Fiesta; sucessor/agente lê um produto | Cópia inicial + sync pontual de patches úteis |
| B — Monorepo `fiestaup` pasta `factory/` | Um clone | Mistura mental, CI, regras Cursor, risco de “mexer no Fiesta sem querer” |
| C — Branch eterna no Fiesta | Rápido | Pior opção para produto separado |

**Recomendação:** **repo Git novo** + pasta local irmã (ex. `c:\Apps\knowt`), com doc “o que veio do Fiesta” e links para commits/docs de origem. Este `VISAO_…` nasceu no Fiesta e deve ser a **primeira cópia** para o repo knowt.

### 5.2 VPS

| Opção | Prós | Contras |
|---|---|---|
| **VPS nova (recomendado)** | Isolamento, Hermes novo, .env, Mongo, falhas sem derrubar Fiesta | Custo + chave SSH + deploy paralelo |
| Mesma VPS, stack isolada | Mais barato | Ruído operacional, um `supervisor` errado afecta os dois |

**Recomendação:** **VPS nova** + Hermes novo + domínio **knowt** (API/chat). Fiesta (`187.77.225.234`) intocado. Domínio já existe; VPS ainda a provisionar.

### 5.3 Continuidade do agente (eu / sucessor)

Como o utilizador confia neste fio de trabalho:

1. **Enquanto o desenho e o esqueleto nascem**, convém **continuar no mesmo contexto / regras Cursor**, com este doc como âncora.
2. **Quando existir repo + VPS próprios**, criar no repo novo:
   - `README` + esta visão;
   - `AGENTS.md` / `.cursor/rules` do produto (DoD Hermes, “não tocar Fiesta”, autonomia);
   - **`HANDOFF.md`** (sucessor): arquitectura, credenciais *onde estão*, comandos deploy, o que **nunca** fazer, estado do piloto.
3. Não é obrigatório “trocar de agente” — mas a VPS/repo novos **devem** permitir que outro agente assuma **sem depender da memória do chat Fiesta**.

**Recomendação prática:**  
- Fase visão/mapa/protótipo de docs → **aqui** (`fiestaup/docs/…`).  
- Fase código MVP Fábrica → **repo novo** + eu (ou sucessor) segue o `HANDOFF.md`.  
Preparar o sucessor **antes** do primeiro deploy na VPS nova, não depois de ter dívida implícita só no transcript.

---

## 6. Roadmap de amadurecimento (sem código de produto ainda)

Ordem saudável:

1. **Congelar a frase de produto** e o que *não* é (este doc §1) — revisão humana.
2. **Mapa de herança v1** (§3) — marcar “MVP 0” vs “depois”.
3. **Decisão repo + VPS** (§5) — registar escolha abaixo.
4. **Nome / domínio / posicionamento** (empresa única vs multi-tenant SaaS).
5. ~~**Primeiro sistema piloto**~~ — **Tiny** (knowt); Fiesta Tiny permanece laboratório paralelo.
6. Só então: esqueleto de código + Hermes na VPS nova (domínio knowt).

**Não fazer agora:** bifucar `fiesta-api` em produção; apontar Hermes Fiesta para o produto novo; prometer “responde tudo o ERP” em landing.

---

## 7. Decisões em aberto (preencher juntos)

| Tema | Opções | Estado |
|---|---|---|
| Nome do produto | knowt | **Decidido** (domínio reservado) |
| Repo | Novo vs pasta no monorepo | **Proposta: repo novo** (`knowt`) |
| VPS | Nova vs mesma isolada | **Proposta: VPS nova** (ainda sem VPS) |
| Multi-tenant no dia 1? | Sim / single-tenant primeiro | Aberto |
| Primeiro piloto knowt | Tiny ERP / Olist | **Decidido** |
| BI visual | Só Insights+chat / BI mínimo depois | **Proposta: chat+Insights primeiro** |
| Relação comercial com Fiesta | Narrativas distintas | **Decidido** (por ora) |

---

## 8. Resumo em uma página

- Fiesta **continua** (narrativa própria).  
- **knowt** = produto à parte (domínio pronto; VPS/Hermes novos), mesma filosofia do plano de onboarding.  
- Piloto knowt: **Tiny**.  
- Leva Discovery, contratos, enforcement, Insights, Hermes DoD.  
- Não leva espelho operacional nem stack S1/S2 como núcleo.  
- Preferência: **repo novo + VPS nova + Hermes novo + HANDOFF.md**.  
- Chat responde o que estiver **comprovado**; cobertura cresce com validação, não com adivinhação.

---

*Documento vivo — amadurecer em conversa antes de qualquer implementação.*
