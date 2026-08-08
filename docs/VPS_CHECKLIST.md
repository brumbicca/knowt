# Checklist — VPS knowt

Dominio já reservado. **VPS ainda não existe.** Preencher ao provisionar.

## Antes de comprar / criar

- [ ] Escolher provider (ex.: Hostinger VPS, como Fiesta, ou outro)
- [ ] Região / tamanho (MVP: 2–4 GB RAM costuma bastar para API + Mongo + Hermes leve)
- [ ] Chave SSH **dedicada** no PC: `%USERPROFILE%\.ssh\id_ed25519_knowt`
- [ ] **Não** reutilizar password root no chat; BatchMode com chave

## No provisionamento

- [ ] IP público anotado aqui: `________________`
- [ ] DNS knowt → IP (API / app conforme subdomínios escolhidos)
- [ ] User `root` ou deploy user + `authorized_keys`
- [ ] Firewall: 22 (restrito se possível), 80/443
- [ ] Docker ou serviços nativos (decidir na 1ª instalação)

## Stack mínima sugerida

- [ ] Nginx + TLS (Let's Encrypt)
- [ ] MongoDB **só** knowt (não o da Fiesta)
- [ ] Runtime API knowt (TBD stack — não copiar supervisor Fiesta à cegas)
- [ ] Hermes **novo** (home isolado, SOUL knowt)
- [ ] Redis só se o desenho MVP exigir filas

## Isolamento da Fiesta

- [ ] Confirmar que **nada** aponta para `187.77.225.234` / Mongo Fiesta / `.hermes` Fiesta
- [ ] Actualizar tabela em `HANDOFF.md`

## Depois do 1º SSH

- [ ] `hostname`, `ufw`/firewall, falha2ban opcional
- [ ] Deploy path: ex. `/root/knowt`
- [ ] Smoke HTTP health do domínio
