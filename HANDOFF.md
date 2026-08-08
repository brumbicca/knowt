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
| API / chat URL | domínio knowt (_DNS TBD_) |
| Mongo | instância própria na VPS knowt (_ainda não_) |
| Hermes home | isolado do Fiesta (_ainda não_) |
| GitHub | https://github.com/brumbicca/knowt |
| OS | Ubuntu 24.04.4 LTS · KVM 2 (~8 GB RAM · 2 vCPU) |
| Firewall Hostinger | grupo `knowt` Ativo · Accept SSH/22 (+ Drop Any) |
| Vault Tiny | `KNOWT_SECRET_TINY_TOKEN` em `/root/knowt/.env` (copiado de Fiesta `TINY_V2_API_KEY`, 2026-08-08) |
| Tiny `orders.list` | **live** / `machine_validated` (2026-08-08) — página 1 = 100 pedidos · 3796 páginas |
| Tiny `sales.summary` | ainda `unavailable` |
| Data path | `/root/knowt-data` |
| Supervisor / serviços | _TBD_ |

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
4. Extrair/adaptar módulos Fiesta com valor (discovery real Tiny)  
5. Piloto Tiny no knowt (credencial knowt; capabilities live só após validação)  
6. DNS knowt + Nginx/TLS  
7. Hermes novo + SOUL/catálogo DoD  

## Agente

Pode continuar o mesmo agente de desenvolvimento do Fiesta **desde que** trabalhe neste repo e respeite a fronteira. Qualquer sucessor deve conseguir operar **só** com este `HANDOFF.md` + `docs/`.
