# Critério «Tiny fechado» (piloto knowt)

**Decisão:** 2026-08-10  
**Âncoras:** `docs/VISAO.md` §3.5 · `HANDOFF.md` · plano Fiesta (filosofia, não cópia cega)

## Princípio

Fechar o **loop do plano com Tiny** antes de qualquer 2ª fonte.  
Não é “implementar o PDF inteiro”; é provar no Tiny: descoberta → evidência → contrato → capability → chat → kill → drift → (receita só com gate humano).

**Até green:** só Tiny + operação do piloto.  
**Proibido até green:** 2ª fonte · multi-tenant SaaS · codegen §8.12.

## Checklist

| # | Critério | Estado | Notas |
|---|---|---|---|
| T1 | `orders.list` + `orders.detail` **live** + contagem/período/situação | **OK** | API Tiny ao vivo; sem inventar R$ |
| T2 | Chat recusa o que não é live (`sales`/`margins`) | **OK** | Enforcement + reason codes |
| T3 | Hermes/Telegram dentro do catálogo (DoD) | **OK** | Breakdown situação → determinístico |
| T4 | Contratos (`orders.v1` published, `sales.v1` draft) | **OK** | `docs/DRIFT_KILL_CONTRATOS.md` |
| T5 | Kill switch + `SOURCE_SUSPENDED` no chat | **OK** | Manual; nunca auto no drift |
| T6 | Drift schema/contrato + `suggest_kill_switch` | **OK** | API; falta cron |
| T7 | Discovery/dossiê alinhado ao chat | **OK** | smoke guião passo discovery |
| T8 | Drift **cron** VPS + alerta | **OK** | timer 2 h · `run_drift_cron.py` · alerta se suggest (+ `KNOWT_DRIFT_ALERT_CHAT_IDS`) |
| T9 | Recon amostra pedidos vs respostas chat | **OK** | smoke: chat == `/vendas/periodo?periodo=semana` |
| T10 | `sales.summary`/margem **ou** decisão «piloto sem receita até CMV» | **bloqueado negócio** | Humano: cost_field + approved_to_publish |
| T11 | Guião demo estável (web + Telegram) | **OK** | `docs/GUIAO_DEMO_TINY.md` · evidência `guiao_demo_latest.json` |
| T12 | GitHub knowt com código = VPS | **OK** | push fatia drift/kill + cron |

## Green

**Green** = T1–T6 OK + **T8** + **T11** + (**T10** resolvido **ou** nota escrita «sem receita no piloto»).

T7/T9 fecham com smoke, não com refactor.

## Ordem de execução (só Tiny)

1. ~~T12 — commit/push~~  
2. ~~T8 — cron drift + alerta~~  
3. ~~T11 (+ T7/T9) — guião demo e smoke~~  
4. **T10** — esperar dono CMV **ou** decidir explicitamente piloto sem receita  

## Depois do green

2ª fonte mínima · WhatsApp (Meta) · Google OAuth (credenciais) · codegen / SaaS.
