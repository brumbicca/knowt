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
| VPS host | _TBD_ |
| SSH key | _TBD_ (padrão sugerido: chave dedicada `id_ed25519_knowt`) |
| API / chat URL | _TBD_ (domínio knowt) |
| Mongo | _TBD_ (instância própria) |
| Hermes home | _TBD_ (não `/root/.hermes` da Fiesta sem isolamento) |
| Supervisor / serviços | _TBD_ |

## Próximos passos técnicos (ordem)

1. ~~Visão + scaffold repo~~  
2. Provisionar VPS + DNS knowt + checklist `docs/VPS_CHECKLIST.md`  
3. MVP 0 código: cofre + source registry + discovery stub + gateway chat enforcement  
4. Extrair/adaptar módulos do mapa de herança (sem S1 sync)  
5. Piloto Tiny no knowt (narrativa própria; token/credencial knowt, não “muleta S1” opaca)  
6. Hermes novo + SOUL/catálogo DoD  

## Agente

Pode continuar o mesmo agente de desenvolvimento do Fiesta **desde que** trabalhe neste repo e respeite a fronteira. Qualquer sucessor deve conseguir operar **só** com este `HANDOFF.md` + `docs/`.
