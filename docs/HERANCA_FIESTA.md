# Herança Fiesta → knowt

Origem de referência (não dependência de runtime): `c:\Apps\fiestaup`.

## MVP 0 — levar / desacoplar primeiro

| Peça Fiesta | Caminho típico | No knowt |
|---|---|---|
| Discovery Engine | `fiesta-api/scripts/fiesta_discovery_engine.py` | Núcleo |
| Discovery UI (Playwright) | `fiesta-api/scripts/fiesta_discovery_ui.py` | Núcleo |
| Reason codes | `fiesta-api/scripts/fiesta_reason_codes.py` | Núcleo |
| Semantic engine / gates | `fiesta-api/scripts/fiesta_semantic_engine.py` | Núcleo |
| Capabilities registry | `fiesta-api/scripts/fiesta_capabilities_registry.py` | Núcleo |
| Chat enforcement | `fiesta-api/scripts/fiesta_chat_enforcement.py` | Núcleo |
| Insights | `fiesta-api/scripts/fiesta_insights_engine.py` | Adaptar UI |
| Sources / connections | `fiesta_bi_sources.py`, `fiesta_bi_connections.py` | Renomear; `org_id` opcional no MVP |
| Drift | `fiesta_drift_engine.py`, cron | Obrigatório cedo |
| Bridge + catalog pattern | `hermes_fiesta_bridge.py`, `agent_catalog.py` | Hermes **knowt** |
| DoD Hermes | `.cursor/rules/hermes-contract-dod.mdc` | Copiado/adaptado |

## Adaptar

- Prefixos `fiesta_*` / `bi_*` → `knowt_*` (ou neutro).
- Bind Tiny “via S1” → conexão first-class no knowt.
- Shadow materializado: opcional; default chat-first pode ser cache/TTL + capability.
- SOUL: sem marketplaces Fiesta Party.

## Não levar como núcleo

- `unified_sync_service` / Celery marketplaces  
- OAuth Shopee, ML, Shein, TikTok, Amazon, Tray como produto  
- `fiesta-financial` completo  
- Deploy / nginx da API Fiesta  

## Piloto Tiny

Reusar **aprendizado** do §28c (o que validar, o que bloquear na margem).  
Implementação knowt = onboarding Tiny **na stack knowt**, não partilhar `bi_tinyerp` de produção Fiesta como fonte canónica do produto.
