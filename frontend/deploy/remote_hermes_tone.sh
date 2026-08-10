#!/bin/bash
set -euo pipefail
cd /root/fiestaup/fiesta-api
./venv/bin/python scripts/configure_hermes_fiesta_phase63.py
supervisorctl restart fiesta-agent-bridge
sleep 2
echo "CHAT:"
curl -s -H 'Content-Type: application/json' \
  -d '{"message":"Quanto vendemos hoje e por marketplace?"}' \
  http://127.0.0.1:8765/assistant/chat
echo
