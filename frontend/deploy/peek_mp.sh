#!/bin/bash
echo "=== HOJE ==="
curl -s http://127.0.0.1:8765/resumo/dia
echo
echo "=== SEMANA ==="
for m in "" shopee ml shein amazon tray tiktok; do
  if [ -z "$m" ]; then
    echo "-- total"
    curl -s "http://127.0.0.1:8765/vendas/periodo?periodo=semana"
  else
    echo "-- $m"
    curl -s "http://127.0.0.1:8765/vendas/periodo?periodo=semana&marketplace=$m"
  fi
  echo
done
