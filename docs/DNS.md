# DNS + HTTPS knowt — quando o humano avisar

## O que o humano faz

1. No DNS do domínio knowt (Cloudflare ou Hostinger), registo **A**:
   - nome: `@` (e opcional `api` / `www`)
   - valor: `179.198.118.171`
   - proxy: pode ficar **DNS only** no 1º dia; Cloudflare proxy depois (como Fiesta)
2. Firewall Hostinger · grupo `knowt`: **Accept 80** e **Accept 443** (manter SSH/22)
3. Avisar o agente no chat: «DNS feito»

## O que o agente faz a seguir (sem password)

1. Instalar nginx + certbot se faltar
2. Activar `deploy/nginx-knowt.example.conf` com o `server_name` real
3. `certbot --nginx -d <domínio>`
4. Smoke `https://<domínio>/health` + `POST /v1/chat/answer` com Bearer

## Já preparado sem DNS

- API só em `127.0.0.1:8766` (systemd)
- `KNOWT_API_TOKEN` obrigatório em produção para `/v1/*`
- Health público (sem token)
