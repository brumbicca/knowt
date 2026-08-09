# HANDOFF — knowt (sucessor / continuidade)

**Actualizado:** 2026-08-08  
**Origem da conversa de produto:** workspace Fiesta `c:\Apps\fiestaup` · doc espelho `docs/VISAO_FABRICA_COMPREENSAO_SISTEMAS.md`

## O que é isto

Produto **knowt**: onboarding autónomo de sistemas externos → contratos → chat (Rica/Telegram/WhatsApp) + Insights.  
**Não** é fork do Fiesta; Fiesta permanece e desenvolve-se à parte.

## Decisões fechadas

| Tema | Decisão |
|---|---|
| Nome / domínio | knowt (domínio reservado) |
| Narrativa vs Fiesta | Distinta |
| Piloto | Tiny ERP / Olist |
| Tenancy MVP | Single-tenant (arquitectura ciente de org_id depois) |
| Repo | `c:\Apps\knowt` (git local; remoto TBD) |
| VPS | Nova · `179.198.118.171` · SSH verificado 2026-08-08 |
| Hermes | Instância **nova** (não o da VPS Fiesta) |

## O que NÃO fazer

- Apontar Hermes ou Mongo da VPS Fiesta (`187.77.225.234`) para o knowt.
- Refactorizar `fiesta-api` / `fiesta-financial` para “ser” o knowt.
- Publicar capability / margem / KPI sem validação (mesmo padrão do plano Fiesta §28c.1).
- Prometer cobertura total do Tiny no dia 1.

## Onde está o aprendizado

| Tema | No Fiesta (referência, só leitura / cópia) |
|---|---|
| Plano onboarding | `c:\Apps\fiestaup\docs\PLANO_ONBOARDING_AUTONOMO_SISTEMAS.md` |
| Visão knowt (espelho) | `c:\Apps\fiestaup\docs\VISAO_FABRICA_COMPREENSAO_SISTEMAS.md` |
| Piloto Tiny §28c | mesmo plano, secção 28c |
| Pacote margem Tiny | `docs/TINY_MARGEM_28c1_PACOTE_NEGOCIO.md` |
| Discovery / semântica / capabilities | `fiesta-api/scripts/fiesta_discovery_*.py`, `fiesta_semantic_engine.py`, etc. — ver `docs/HERANCA_FIESTA.md` |

## Infra (a preencher quando existir)

| Item | Valor |
|---|---|
| VPS host | `root@179.198.118.171` (`srv1890207.hstgr.cloud`) |
| SSH key | `%USERPROFILE%\.ssh\id_ed25519_knowt` (comentário `knowt-vps`) |
| API / chat URL | https://knowt.com.br (TLS 2026-08-08) |
| Mongo | instância própria na VPS knowt (_ainda não_) |
| Hermes home | SPA Insights+Chat (cópia fiesta-bi) em https://knowt.com.br · assistente via `/api/bridge` |
| Frontend | `knowt/frontend` · temas Fiesta no arranque · fonte Tiny |
| Firewall Hostinger | grupo `knowt` · Accept 22/80/443 + Drop Any |
| Vault Tiny | `KNOWT_SECRET_TINY_TOKEN` em `/root/knowt/.env` (copiado de Fiesta `TINY_V2_API_KEY`, 2026-08-08) |
| Tiny `orders.list` | **live** — contagem por período, situação, **resumo/breakdown** por situação |
| Tiny `orders.detail` | **live** — situação, cliente, itens, ecommerce, valor Tiny (sem CMV) |
| Tiny `sales.summary` | ainda `unavailable` — probe ok; gates parciais (falta `approved_to_publish`) · `docs/SALES_SUMMARY_PACOTE.md` |
| Tiny `margins.summary` | `unavailable` (slot criado; sem publish) |
| Evidence sales | `/root/knowt-data/evidence/sales_probe_*.json` + `sales_summary_gates.json` |
| Data path | `/root/knowt-data` |
| API local (systemd) | `knowt-api` · `127.0.0.1:8766` · unit `deploy/knowt-api.service` |
| Chat answer | `POST /v1/chat/answer` · períodos + situação · Bearer `KNOWT_API_TOKEN` |
| Contagem período | 1ª+última página Tiny (`page_bounds`) — sem varrer todas as páginas |
| Agenda / tarefas | JSON local `agenda.json` + `tasks.json` via `/api/bridge` (sem Google no MVP) |
| Audit | `/root/knowt-data/audit/answers.jsonl` |
| Nginx / TLS | rascunho `deploy/nginx-knowt.example.conf` — ver `docs/DNS.md` |

### Precisa do humano (avisar quando feito)

Ver `docs/DNS.md`. Em resumo:

1. DNS A knowt → `179.198.118.171`
2. Firewall Hostinger: Accept **80** + **443**
3. Mensagem no chat: «DNS feito»

Até lá a API fica só em loopback + Bearer `KNOWT_API_TOKEN`.

### O que enviar ao agente após criar VPS + GitHub

1. URL do repo GitHub (ex. `https://github.com/<org>/knowt`)
2. IP da VPS + user SSH (ex. `root@x.x.x.x`)
3. Confirmar se a chave pública `id_ed25519_knowt.pub` já está em `authorized_keys`
4. Domínio(s) apontados (A/AAAA) para o IP
5. **Não** enviar password root no chat

## Próximos passos técnicos (ordem)

1. ~~Visão + scaffold repo~~  
2. ~~Provisionar VPS~~ · ~~bootstrap `/root/knowt`~~ · DNS knowt ainda TBD  
3. ~~MVP 0 código~~ (vault, sources, discovery stub, enforcement, health) — ver `docs/MVP0.md`  
4. ~~Tiny `orders.list` live + answer determinístico~~ · ~~períodos pt-BR~~ · ~~systemd `knowt-api`~~ · ~~contagem page_bounds~~ · ~~orders.detail + catálogo no chat~~ · ~~resumo por situação + amostra/ecommerce~~  
5. Extrair/adaptar discovery real Tiny (mais endpoints)  
6. ~~DNS knowt + Nginx/TLS (+ firewall 80/443)~~  
7. ~~Chat web piloto em knowt.com.br~~ · Hermes Telegram/WhatsApp ainda TBD  
8. ~~Pacote técnico sales.summary (probe + gates, sem publish)~~ · publish live só após checklist de negócio  
9. Hermes Telegram/WhatsApp ainda TBD  

## Agente

Pode continuar o mesmo agente de desenvolvimento do Fiesta **desde que** trabalhe neste repo e respeite a fronteira. Qualquer sucessor deve conseguir operar **só** com este `HANDOFF.md` + `docs/`.
