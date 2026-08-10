#!/bin/bash
set -euo pipefail
cd /root/fiestaup/fiesta-api
# Atualiza SOUL + skill fiesta-bi a partir do repo
ENVIRONMENT=production ./venv/bin/python scripts/configure_hermes_fiesta_phase63.py || true
supervisorctl restart fiesta-agent-bridge
sleep 2
echo "RESUMO:"
curl -s http://127.0.0.1:8765/resumo/dia | head -c 700
echo
echo
echo "CHAT TEST:"
curl -s -H 'Content-Type: application/json' \
  -d '{"message":"Quanto vendemos hoje e por marketplace? Responda com total e cada canal (Shein, Shopee, Mercado Livre). Números exactos."}' \
  http://127.0.0.1:8765/assistant/chat | head -c 1200
echo
