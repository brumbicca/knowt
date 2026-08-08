# knowt

Compreensão de sistemas — **chat-first**, multi-fonte (ERP / CRM / banco / plataforma).

> Autonomia máxima, **zero verdade silenciosa**.

**Narrativa:** produto **distinto** do Fiesta.

| | |
|---|---|
| Domínio | reservado (knowt) · DNS TBD |
| VPS | `179.198.118.171` · `/root/knowt` |
| Piloto | Tiny ERP / Olist (draft) |
| Tenancy | single-tenant no MVP |
| Repo | https://github.com/brumbicca/knowt |

## Documentos

- [`docs/VISAO.md`](docs/VISAO.md)
- [`docs/HERANCA_FIESTA.md`](docs/HERANCA_FIESTA.md)
- [`docs/MVP0.md`](docs/MVP0.md)
- [`docs/VPS_CHECKLIST.md`](docs/VPS_CHECKLIST.md)
- [`HANDOFF.md`](HANDOFF.md) · [`AGENTS.md`](AGENTS.md)

## MVP 0 (código)

```powershell
cd c:\Apps\knowt
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONPATH="src"
pytest -q
python -m knowt.app
```

- `GET /health`
- `GET /v1/sources`
- `POST /v1/chat/enforce`
- `POST /v1/sources/<id>/discovery`

## Estado

MVP 0 esqueleto (**2026-08-08**). Fiesta em `c:\Apps\fiestaup` continua independente.
