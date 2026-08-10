# WhatsApp Cloud API — knowt

**Estado:** webhook no bridge implementado (2026-08-10).  
Falta só as credenciais Meta no `.env` da VPS para activar.

## Arquitectura

```
WhatsApp (Meta) → HTTPS POST https://knowt.com.br/api/bridge/whatsapp/webhook
                → knowt-api (Flask) → assistant (Hermes ou determinístico)
                → Graph API send text
```

Mesmo cérebro do Telegram (`channel=whatsapp`, tom casual).  
Não usa Hermes Fiesta nem `hermes-gateway` com o número WhatsApp.

## Variáveis (`/root/knowt/.env`)

```bash
KNOWT_WHATSAPP_TOKEN=EAAG...                 # token permanente / system user
KNOWT_WHATSAPP_PHONE_NUMBER_ID=1234567890    # Phone number ID (não o nº E.164)
KNOWT_WHATSAPP_VERIFY_TOKEN=escolhe-um-segredo
# Opcional (recomendado):
# KNOWT_WHATSAPP_APP_SECRET=...              # valida X-Hub-Signature-256
# KNOWT_WHATSAPP_ALLOWLIST=5511999998888     # só estes WA IDs; vazio/* = qualquer
# KNOWT_WHATSAPP_SOURCE_ID=tinyerp
```

## Meta Developer — passos

1. [Meta for Developers](https://developers.facebook.com/) → app **Business** → produto **WhatsApp**.
2. Em **API Setup**: copia **Temporary/ Permanent token** e **Phone number ID**.
3. **Configuration → Webhook**:
   - Callback URL: `https://knowt.com.br/api/bridge/whatsapp/webhook`
   - Verify token: o mesmo `KNOWT_WHATSAPP_VERIFY_TOKEN`
   - Subscrever campo `messages`
4. Na VPS: preencher `.env` → `systemctl restart knowt-api`
5. Clicar **Verify and save** no Meta
6. Smoke: manda «pedidos esta semana» do número de teste (ou allowlist)

## Verificar localmente / VPS

```bash
curl -sS 'https://knowt.com.br/api/bridge/health' | python3 -m json.tool
# whatsapp_configured: true quando token+phone id existem

# Challenge (como a Meta):
curl -sS 'https://knowt.com.br/api/bridge/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=SEU_VERIFY&hub.challenge=ping'
# → ping
```

## Segurança

- Tokens só no `.env` (nunca no chat).
- Preferir `KNOWT_WHATSAPP_APP_SECRET` + allowlist.
- Nginx já faz proxy de `/api/` com `proxy_read_timeout 180s` (Hermes pode demorar).

## Código

| Peça | Path |
|------|------|
| Helpers | `src/knowt/whatsapp.py` |
| Rotas | `GET/POST /api/bridge/whatsapp/webhook` em `bi_bridge.py` |
