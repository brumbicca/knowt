# MVP 0 — knowt (2026-08-08)

## Objectivo

Esqueleto **sem** verdade silenciosa: cofre (refs), registry de fontes, discovery stub, enforcement de chat, health HTTP.

## O que existe

| Módulo | Pasta |
|---|---|
| Config | `src/knowt/config.py` |
| Vault / secret refs | `src/knowt/vault.py` |
| Sources + seed Tiny draft | `src/knowt/sources.py` |
| Discovery stub | `src/knowt/discovery.py` |
| Chat enforcement | `src/knowt/enforcement.py` |
| Flask app | `src/knowt/app.py` |

## Corrida local

```powershell
cd c:\Apps\knowt
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONPATH="src"
pytest -q
python -m knowt.app
```

Health: `GET http://127.0.0.1:8766/health`

## Gates

- Tiny nasce com capabilities **unavailable**
- Discovery com token ainda devolve `stub` + `DISCOVERY_PIPELINE_NOT_IMPLEMENTED`
- Perguntas de vendas/pedidos → `CAPABILITY_UNAVAILABLE` até publicação humana/pipeline

## Não incluído (próximas fatias)

- Probe real Tiny API
- Hermes / SOUL
- Nginx / TLS / DNS
- Multi-tenant SaaS
