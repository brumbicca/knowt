# Telegram / WhatsApp — knowt

## Estado

- **Chat web + bridge** já respondem em https://knowt.com.br
- **Telegram:** bot fino (long poll) → `POST http://127.0.0.1:8766/api/bridge/assistant/chat`
- **WhatsApp:** webhook Cloud API pronto (`/api/bridge/whatsapp/webhook`) — falta credenciais Meta; ver `docs/WHATSAPP.md`
- **Hermes completo (SOUL/MCP):** instalado — ver `docs/HERMES.md`.
- **Telegram:** bot fino → bridge com **`KNOWT_ASSISTANT_ENGINE=hermes`** (LLM + MCP). Typing indicator enquanto gera. Fallback determinístico se Hermes falhar.

## Activar Telegram

1. No Telegram, fala com [@BotFather](https://t.me/BotFather) → `/newbot` → copia o token.
2. Na VPS knowt (`/root/knowt/.env`):

```bash
KNOWT_TELEGRAM_BOT_TOKEN=123456:ABC...
# Opcional: só estes chat_id (vírgula). Vazio ou * = qualquer.
# KNOWT_TELEGRAM_CHAT_IDS=123456789
# KNOWT_TELEGRAM_SOURCE_ID=tinyerp
```

3. Descobrir o teu `chat_id`: manda `/id` ao bot (com allowlist aberta) ou usa um bot `@userinfobot`.

4. Instalar / reiniciar unit:

```bash
cp /root/knowt/deploy/knowt-telegram.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now knowt-telegram
systemctl status knowt-telegram --no-pager
journalctl -u knowt-telegram -n 50 --no-pager
```

5. Smoke: no Telegram «pedidos esta semana» ou «o que já conhecemos do Tiny?» — deve bater com o chat web.

## Segurança

- Token só no `.env` da VPS knowt (nunca no chat do Cursor).
- Preferir `KNOWT_TELEGRAM_CHAT_IDS` com os IDs da equipa.
- **Não** apontar para Hermes/Mongo da VPS Fiesta.

## Sem token

O serviço sai com código **2** e o systemd **não** reinicia em loop (`RestartPreventExitStatus=2`).
Depois de preencher o token: `systemctl restart knowt-telegram`.
