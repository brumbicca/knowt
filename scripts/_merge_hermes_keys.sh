#!/bin/bash
# Run ON knowt VPS after keys file is placed at /tmp/_hk.env
set -euo pipefail
touch /root/.hermes/.env
while IFS= read -r line || [ -n "$line" ]; do
  [ -z "$line" ] && continue
  case "$line" in \#*) continue ;; esac
  key="${line%%=*}"
  [ -z "$key" ] && continue
  if grep -q "^${key}=" /root/.hermes/.env 2>/dev/null; then
    # escape for sed
    esc=$(printf '%s\n' "$line" | sed 's/[\/&]/\\&/g')
    sed -i "s/^${key}=.*/${esc}/" /root/.hermes/.env
  else
    echo "$line" >> /root/.hermes/.env
  fi
done < /tmp/_hk.env
rm -f /tmp/_hk.env
grep -E '^(OPENROUTER_API_KEY|VOICE_TOOLS_OPENAI_KEY)=' /root/.hermes/.env | sed 's/=.*/=set/'
chmod 600 /root/.hermes/.env
