# HANDOFF — knowt (sucessor / continuidade)

**Actualizado:** 2026-08-10  
**Origem da conversa de produto:** workspace Fiesta `c:\Apps\fiestaup` · visão `docs/VISAO.md` (espelho em fiestaup)

## Prioridade actual (ler primeiro)

**Só Tiny até green.** Critério e checklist: **`docs/PILOTO_TINY_FECHADO.md`** (também `docs/VISAO.md` §3.5).

Não abrir 2ª fonte, SaaS multi-tenant nem codegen de conector antes do green.

| # | Critério | Estado |
|---|---|---|
| T1–T6 | orders live, enforcement, Hermes, contratos, kill, drift API | **OK** |
| T7 | Discovery/dossiê alinhado ao chat | **OK** |
| T8 | Cron drift + alerta | **OK** |
| T9 | Recon pedidos vs chat (smoke) | **OK** |
| T10 | sales/margem ou decisão «sem receita» | bloqueado negócio |
| T11 | Guião demo estável | **OK** |
| T12 | GitHub = código da VPS | **OK** |

**Green** = T1–T6 + T8 + T11 + (T10 ou decisão escrita sem receita).

### Ordem até green

1. ~~T12 · T8 · T11/T7/T9~~  
2. **T10** — CMV humano ou decisão «piloto sem receita»

## O que é isto

Produto **knowt**: onboarding autónomo de sistemas externos → contratos → chat (Rica/Telegram/WhatsApp) + Insights.  
**Não** é fork do Fiesta; Fiesta permanece e desenvolve-se à parte.

## Decisões fechadas

| Tema | Decisão |
|---|---|
| Nome / domínio | knowt (domínio reservado) |
| Narrativa vs Fiesta | Distinta |
| Piloto | Tiny ERP / Olist |
| Fecho do piloto | Checklist Tiny fechado — **só Tiny até green** (2026-08-10) |
| 2ª fonte | Só **depois** do green |
| Tenancy MVP | Single-tenant com **org registry** (`default`) · API `/organizacoes` · ver `docs/ORGS.md` |
| Repo | `c:\Apps\knowt` · origin `https://github.com/brumbicca/knowt.git` |
| VPS | Nova · `179.198.118.171` · SSH verificado 2026-08-08 |
| Hermes | Instância **nova** (não o da VPS Fiesta) |

## O que NÃO fazer

- Apontar Hermes ou Mongo da VPS Fiesta (`187.77.225.234`) para o knowt.
- Refactorizar `fiesta-api` / `fiesta-financial` para “ser” o knowt.
- Publicar capability / margem / KPI sem validação (mesmo padrão do plano Fiesta §28c.1).
- Prometer cobertura total do Tiny no dia 1.
- **Abrir 2ª fonte ou codegen genérico antes do green Tiny** (`docs/PILOTO_TINY_FECHADO.md`).

## Onde está o aprendizado

| Tema | No Fiesta (referência, só leitura / cópia) |
|---|---|
| Plano onboarding | `c:\Apps\fiestaup\docs\PLANO_ONBOARDING_AUTONOMO_SISTEMAS.md` |
| Visão knowt (espelho) | `c:\Apps\fiestaup\docs\VISAO_FABRICA_COMPREENSAO_SISTEMAS.md` · cópia `docs/VISAO.md` |
| Piloto Tiny §28c | mesmo plano, secção 28c |
| Pacote margem Tiny | Fiesta `docs/TINY_MARGEM_28c1_PACOTE_NEGOCIO.md` / gates knowt |
| Discovery / semântica / capabilities | `fiesta-api/scripts/fiesta_discovery_*.py`, etc. — ver `docs/HERANCA_FIESTA.md` |

## Infra

| Item | Valor |
|---|---|
| VPS host | `root@179.198.118.171` (`srv1890207.hstgr.cloud`) |
| SSH key | `%USERPROFILE%\.ssh\id_ed25519_knowt` (comentário `knowt-vps`) |
| API / chat URL | https://knowt.com.br (TLS) |
| Mongo | `127.0.0.1:27017` DB `knowt` · health `mongo_ok` · **sem** espelho Tiny obrigatório (`docs/BANCO.md`) |
| Hermes home | SPA Insights+Chat · `/api/bridge` · Telegram (`knowt-telegram`) · SOUL/MCP (`docs/HERMES.md`) |
| Frontend | `knowt/frontend` · fonte Tiny |
| Firewall Hostinger | grupo `knowt` · Accept 22/80/443 + Drop Any |
| Vault Tiny | `KNOWT_SECRET_TINY_TOKEN` em `/root/knowt/.env` |
| Tiny `orders.list` / `orders.detail` | **live** |
| Tiny `sales.summary` / `margins.summary` | `unavailable` até gates · `docs/SALES_SUMMARY_PACOTE.md` |
| Discovery | dossiê · `GET /discovery/dossier` |
| Data path | `/root/knowt-data` |
| API (systemd) | `knowt-api` · `127.0.0.1:8766` |
| Agenda / tarefas | local + Google OAuth scaffold · `docs/GOOGLE.md` |
| Drift / kill / contratos | `docs/DRIFT_KILL_CONTRATOS.md` |
| Critério piloto | **`docs/PILOTO_TINY_FECHADO.md`** |
| Audit | `/root/knowt-data/audit/answers.jsonl` |

### Precisa do humano

| Item | Estado |
|---|---|
| DNS + TLS knowt.com.br | Feito |
| CMV / `cost_field` + `approved_to_publish` (T10) | **Aguarda dono** — ou decidir «piloto sem receita» |
| Google OAuth Client ID/Secret | Opcional — não bloqueia green |
| WhatsApp Meta | Pausado — depois do green |

## Próximos passos técnicos (ordem)

1. ~~Infra + MVP + orders live + DNS + chat/Telegram/Hermes~~  
2. ~~Contratos + kill + drift API~~  
3. **Agora (só Tiny / green):** ~~T12~~ · ~~T8~~ · ~~T11/T7/T9~~ · **T10**  
4. **Depois do green:** 2ª fonte · WhatsApp · Google com credenciais  

Guião demo: `docs/GUIAO_DEMO_TINY.md` · smoke `scripts/smoke_guiao_demo_tiny.py`  

Telegram: `docs/TELEGRAM.md` · Hermes: `docs/HERMES.md` · Google: `docs/GOOGLE.md` · Drift: `docs/DRIFT_KILL_CONTRATOS.md`

## Agente

Pode continuar o mesmo agente do Fiesta **desde que** trabalhe neste repo e respeite a fronteira. Sucessor opera com este `HANDOFF.md` + `docs/` — prioridade = `docs/PILOTO_TINY_FECHADO.md`.
