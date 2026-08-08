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
| VPS | Nova, **ainda não provisionada** |
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
| VPS host | _TBD — utilizador a provisionar_ |
| SSH key | Sugerido: `%USERPROFILE%\.ssh\id_ed25519_knowt` (dedicada; não misturar com Fiesta) |
| API / chat URL | domínio knowt (_subdomínios TBD_) |
| Mongo | instância própria na VPS knowt |
| Hermes home | isolado do Fiesta |
| GitHub | https://github.com/brumbicca/knowt |
| Supervisor / serviços | _TBD_ |

### O que enviar ao agente após criar VPS + GitHub

1. URL do repo GitHub (ex. `https://github.com/<org>/knowt`)
2. IP da VPS + user SSH (ex. `root@x.x.x.x`)
3. Confirmar se a chave pública `id_ed25519_knowt.pub` já está em `authorized_keys`
4. Domínio(s) apontados (A/AAAA) para o IP
5. **Não** enviar password root no chat

## Próximos passos técnicos (ordem)

1. ~~Visão + scaffold repo~~  
2. Provisionar VPS + DNS knowt + checklist `docs/VPS_CHECKLIST.md`  
3. MVP 0 código: cofre + source registry + discovery stub + gateway chat enforcement  
4. Extrair/adaptar módulos do mapa de herança (sem S1 sync)  
5. Piloto Tiny no knowt (narrativa própria; token/credencial knowt, não “muleta S1” opaca)  
6. Hermes novo + SOUL/catálogo DoD  

## Agente

Pode continuar o mesmo agente de desenvolvimento do Fiesta **desde que** trabalhe neste repo e respeite a fronteira. Qualquer sucessor deve conseguir operar **só** com este `HANDOFF.md` + `docs/`.
