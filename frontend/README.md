# Frontend knowt (cópia adaptada do fiesta-bi)

## O que é

SPA **Insights + Chat** (Command Center), copiado do `fiesta-bi` do Fiesta e
desacoplado no repo `knowt`. Temas Fiesta mantidos no arranque.

## Stack

Vite + React + TS + MUI · API via `/api/bridge` → Flask knowt (`bi_bridge.py`).

## Dev

```powershell
cd c:\Apps\knowt\frontend
npm ci
# VITE_BI_BRIDGE_KEY = mesmo valor de KNOWT_API_TOKEN
npm run dev
```

## Produção

Build com `VITE_BI_BRIDGE_KEY` = token da API; nginx serve `frontend/dist` e
proxy `/api/` para `127.0.0.1:8766`.
