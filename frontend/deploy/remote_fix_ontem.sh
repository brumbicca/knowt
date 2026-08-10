#!/bin/bash
set -euo pipefail
cd /root/fiestaup/fiesta-api
./venv/bin/python scripts/configure_hermes_fiesta_phase63.py
supervisorctl restart fiesta-agent-bridge
sleep 2
echo "=== RESUMO ONTEM ==="
curl -s 'http://127.0.0.1:8765/resumo/periodo?periodo=ontem'
echo
echo
echo "=== CHAT ONTEM ==="
curl -s -H 'Content-Type: application/json' \
  -d '{"message":"Quanto vendemos ontem e por marketplace? Usa /resumo/periodo com periodo=ontem."}' \
  http://127.0.0.1:8765/assistant/chat
echo
