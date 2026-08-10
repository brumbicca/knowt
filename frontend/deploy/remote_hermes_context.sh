#!/bin/bash
set -euo pipefail
cd /root/fiestaup/fiesta-api
./venv/bin/python scripts/configure_hermes_fiesta_phase63.py
cp /root/fiestaup/docs/hermes/fiesta-bi/SKILL.md /root/.hermes/skills/fiesta-bi/SKILL.md 2>/dev/null || true
supervisorctl restart fiesta-agent-bridge
sleep 2
echo "CHAT COM CONTEXTO PAINEL SEMANA:"
curl -s -H 'Content-Type: application/json' -d '{
  "message": "Quanto vendemos hoje e por marketplace?",
  "context": {
    "periodo": "semana",
    "range_label": "2026-07-13 → 2026-07-15",
    "vendas_fmt": "R$ 2.360,51",
    "liquido_fmt": "R$ 1.954,68",
    "pedidos": 33,
    "canais": [
      {"name": "Shein", "value": 1332, "vendas_fmt": "R$ 1.332,00"},
      {"name": "Shopee", "value": 1028.23, "vendas_fmt": "R$ 1.028,23"}
    ]
  }
}' http://127.0.0.1:8765/assistant/chat
echo
