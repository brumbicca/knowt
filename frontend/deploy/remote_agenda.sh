#!/bin/bash
set -euo pipefail
cd /root/fiestaup/fiesta-api
./venv/bin/python scripts/configure_hermes_fiesta_phase63.py || true
supervisorctl restart fiesta-agent-bridge
sleep 2
echo "AGENDA HOJE:"
curl -s http://127.0.0.1:8765/agenda/hoje | head -c 800
echo
echo
echo "CHAT AGENDA:"
curl -s -H 'Content-Type: application/json' \
  -d '{"message":"O que tenho na agenda hoje?"}' \
  http://127.0.0.1:8765/assistant/chat | head -c 900
echo
