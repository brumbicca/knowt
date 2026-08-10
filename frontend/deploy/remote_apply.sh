#!/bin/bash
set -euo pipefail
KEY=7375f65b1f21563105aa4e65d7e0e80c9ce1ce4ae86a2ebf
rsync -a --delete /root/fiestaup/fiesta-bi/dist/ /var/www/fiesta-bi/
chmod -R a+rX /var/www/fiesta-bi
nginx -t
systemctl reload nginx
supervisorctl restart fiesta-agent-bridge
sleep 2
echo "HEALTH:"
curl -s -H "X-Fiesta-Bi-Key: $KEY" https://bi.fiestaup.toteus.cloud/api/bridge/health
echo
echo "CHAT (pode demorar):"
curl -s -H "X-Fiesta-Bi-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"message":"Responde só com a palavra OK e nada mais."}' \
  https://bi.fiestaup.toteus.cloud/api/bridge/assistant/chat | head -c 500
echo
