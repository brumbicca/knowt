# Visão — knowt (fábrica de compreensão de sistemas)

**Estado:** piloto Tiny em curso · critério de fecho abaixo (§3.5)  
**Data:** 2026-08-08 (decisões) · **actualizado:** 2026-08-10 (checklist Tiny fechado)  
**Relação com Fiesta:** **Fiesta permanece tal qual** (`fiesta-api`, `fiesta-financial`, BI, espelhos, sync). Este documento descreve o produto **knowt**, ao lado, que herda o *plano* e o *aprendizado*, não o monólito operacional.

**Nome do produto:** **knowt** (domínio + VPS + repo activos — ver `c:\Apps\knowt\HANDOFF.md`).  
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

### 3.5 Critério «Tiny fechado» (decisão 2026-08-10)

**Fonte operacional no repo knowt:** `c:\Apps\knowt\docs\PILOTO_TINY_FECHADO.md` (checklist espelhada abaixo).

**Princípio:** fechar o **loop do plano com Tiny** antes de qualquer 2ª fonte.  
“Plano completo com Tiny” = loop de verdade comprovado no piloto — **não** implementar cada parágrafo do doc de onboarding (codegen §8.12, multi-SaaS, etc. ficam **fora** deste critério).

**Prioridade de trabalho até green:** só Tiny + operação do piloto.  
**Proibido até green:** 2ª fonte, multi-tenant SaaS, gerador genérico de conector.

#### Checklist (fonte de verdade também em `c:\Apps\knowt\HANDOFF.md`)

| # | Critério | Estado | Notas |
|---|---|---|---|
| T1 | `orders.list` + `orders.detail` **live** + contagem/período/situação | **OK** | API Tiny ao vivo; sem inventar R$ |
| T2 | Chat recusa o que não é live (`sales`/`margins`) | **OK** | Enforcement + reason codes |
| T3 | Hermes/Telegram respondem dentro do catálogo (DoD paths) | **OK** | Motor hermes; breakdown situação → determinístico |
| T4 | Contratos versionados (`orders.v1` published, `sales.v1` draft) | **OK** | Hash + registry em `data/contracts` |
| T5 | Kill switch por fonte + chat respeita `SOURCE_SUSPENDED` | **OK** | Manual; nunca auto no drift |
| T6 | Drift (schema/contrato) com alerta `suggest_kill_switch` | **OK** | API; cron+alerta em T8 |
| T7 | Discovery/dossiê consultável e alinhado ao que o chat diz | **parcial** | Dossiê existe; reforçar smoke guião vs API |
| T8 | Drift em **cron** VPS + alerta (Telegram ou log watchdog) | **OK** | timer 2 h · `run_drift_cron.py` |
| T9 | Recon amostra/oficial alinhada às respostas do chat (pedidos) | **parcial** | Há aligned_sample sales; fechar smoke demo pedidos |
| T10 | `sales.summary` / margem **ou** decisão explícita «piloto sem receita até CMV» | **bloqueado negócio** | Humano: `cost_field` + `approved_to_publish` |
| T11 | Guião demo estável (web + Telegram) com números batendo | **pendente** | Checklist de perguntas fixas + evidência |
| T12 | Commit/push do estado actual no GitHub knowt | **OK** | fatia drift/kill + cron |

**Green do piloto** = T1–T6 OK + T8 + T11 + (T10 resolvido **ou** decisão escrita «sem receita no piloto»).  
T7/T9: fechar com smoke, não com refactor grande.

**Depois do green (não antes):** 2ª fonte mínima · WhatsApp com Meta · Google OAuth com credenciais · codegen §8.12.

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

## 6. Roadmap de amadurecimento

Ordem saudável (actualizado 2026-08-10):

1. ~~Congelar frase de produto~~ · ~~mapa de herança~~ · ~~repo + VPS + Tiny~~  
2. **Agora — só Tiny até green** (§3.5): ~~T8 cron~~ · T11 guião demo · T10 CMV ou decisão «sem receita» · fechar T7/T9.  
3. **Depois do green:** 2ª fonte mínima (prova reutilização) · opcional WhatsApp/Google com credenciais.  
4. **Mais tarde:** codegen conector (§8.12), multi-tenant SaaS, BI rico.

**Não fazer agora:** 2ª fonte; bifucar `fiesta-api`; prometer receita/margem sem gates; “responde tudo o ERP” em landing.

---

## 7. Decisões em aberto (preencher juntos)

| Tema | Opções | Estado |
|---|---|---|
| Nome do produto | knowt | **Decidido** (domínio reservado) |
| Repo | `c:\Apps\knowt` · GitHub `brumbicca/knowt` | **Decidido** |
| VPS | Nova `179.198.118.171` · knowt.com.br | **Decidido** (activa) |
| Multi-tenant no dia 1? | Single-tenant MVP; multi depois | **Decidido** (2026-08-08) |
| Primeiro piloto knowt | Tiny ERP / Olist | **Decidido** |
| Fecho do piloto | Checklist §3.5 «Tiny fechado» — **só Tiny até green** | **Decidido** (2026-08-10) |
| 2ª fonte | Só **depois** do green Tiny | **Decidido** (adiada) |
| BI visual | Só Insights+chat / BI mínimo depois | **Proposta: chat+Insights primeiro** |
| Relação comercial com Fiesta | Narrativas distintas | **Decidido** (por ora) |

---

## 8. Resumo em uma página

- Fiesta **continua** (narrativa própria).  
- **knowt** = produto à parte (domínio + VPS + Hermes próprios), mesma filosofia do plano de onboarding.  
- Piloto knowt: **Tiny** — fechar §3.5 **antes** de 2ª fonte.  
- Leva Discovery, contratos, enforcement, Insights, Hermes DoD, kill, drift.  
- Não leva espelho operacional nem stack S1/S2 como núcleo.  
- Chat responde o que estiver **comprovado**; cobertura cresce com validação, não com adivinhação.

---

*Documento vivo — §3.5 é o critério operacional actual do piloto.*
