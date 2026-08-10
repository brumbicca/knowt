#!/usr/bin/env bash
# Instala MongoDB Community na VPS knowt — só 127.0.0.1 (não expor à Internet).
set -euo pipefail

if command -v mongod >/dev/null 2>&1 && systemctl is-active --quiet mongod; then
  echo "mongod_already_active"
  mongod --version | head -1
  exit 0
fi

export DEBIAN_FRONTEND=noninteractive
. /etc/os-release

# Repositório oficial MongoDB 8.0 (Ubuntu noble)
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc \
  | gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor --yes
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${VERSION_CODENAME}/mongodb-org/8.0 multiverse" \
  > /etc/apt/sources.list.d/mongodb-org-8.0.list

apt-get update -y
apt-get install -y mongodb-org

# Bind só loopback
CONF=/etc/mongod.conf
if [[ -f "$CONF" ]]; then
  if grep -qE '^\s*bindIp:' "$CONF"; then
    sed -i 's/^\(\s*bindIp:\).*/\1 127.0.0.1/' "$CONF"
  else
    printf '\nnet:\n  port: 27017\n  bindIp: 127.0.0.1\n' >> "$CONF"
  fi
fi

systemctl enable mongod
systemctl restart mongod
sleep 2
systemctl is-active mongod
ss -lntp | grep 27017 || true
echo "mongo_install_ok"
