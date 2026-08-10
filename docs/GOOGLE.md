# Google Calendar + Tasks (knowt)

Agenda e tarefas funcionam **sempre** em JSON local (`agenda.json` / `tasks.json`).  
Com OAuth configurado e conta autorizada, o bridge passa a **ler/escrever também no Google**.

## Variáveis

| Env | Obrigatório | Notas |
|---|---|---|
| `KNOWT_GOOGLE_CLIENT_ID` | sim (para Google) | OAuth Client ID (Web) |
| `KNOWT_GOOGLE_CLIENT_SECRET` | sim | Secret do client |
| `KNOWT_GOOGLE_REDIRECT_URI` | não | Default: `https://knowt.com.br/api/bridge/agenda/google/callback` |
| `KNOWT_GOOGLE_TOKEN_PATH` | não | Default: `{KNOWT_DATA_DIR}/google_tokens.json` |
| `KNOWT_GOOGLE_STATE_PATH` | não | Default: `{KNOWT_DATA_DIR}/google_oauth_state.json` |

Aliases aceites (compat Fiesta): `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`.

## Google Cloud (humano)

1. [Google Cloud Console](https://console.cloud.google.com/) → projecto knowt (ou existente).
2. **APIs & Services → Enable**: Google Calendar API + Google Tasks API.
3. **OAuth consent screen** (External ou Internal) · scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/tasks`
4. **Credentials → Create OAuth client ID → Web application**
   - Authorized redirect URI: exactamente  
     `https://knowt.com.br/api/bridge/agenda/google/callback`
5. Copiar Client ID + Secret para `/root/knowt/.env` na VPS (nunca no chat).
6. `systemctl restart knowt-api`

## Ligar a conta (uma vez)

```bash
# na VPS (com Bearer)
curl -sS -H "X-Fiesta-Bi-Key: $KNOWT_API_TOKEN" \
  http://127.0.0.1:8766/api/bridge/agenda/google/auth-url
```

Abrir o `auth_url` no browser → autorizar → callback grava tokens em  
`/root/knowt-data/google_tokens.json` (modo `600`).

Health passa a mostrar `google_connected: true` e `google_credentials_configured: true`.

## Endpoints

| Método | Path | Auth | Função |
|---|---|---|---|
| GET | `/api/bridge/agenda/google/auth-url` | Bearer | Gera URL OAuth |
| GET | `/api/bridge/agenda/google/callback` | **público** | Troca `code` por tokens |
| GET | `/api/bridge/agenda/periodo` | Bearer | Eventos locais (+ Google se ligado) |
| POST | `/api/bridge/agenda/eventos` | Bearer | Cria no Google se ligado + espelho local |
| GET | `/api/bridge/tarefas` | Bearer | Locais (+ Google Tasks se scope OK) |
| POST | `/api/bridge/tarefas` | Bearer | Cria no Google se ligado |
| POST | `/api/bridge/tarefas/concluir` | Bearer | `gtask:…` → API Google; senão local |

Sem credenciais: auth-url devolve `400` + `google_credentials_missing`; o resto continua só local.

## Segurança

- Callback é público (necessário para o redirect do Google) mas só troca código com `state` CSRF gravado no disco.
- Tokens e state ficam fora do git, em `KNOWT_DATA_DIR`.
- Não colar Client Secret / refresh token no chat.
