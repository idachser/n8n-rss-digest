#!/usr/bin/env sh
# Starts the Cloudflare Quick Tunnel, writes its URL to .env as WEBHOOK_URL
# and recreates n8n so published Telegram triggers re-register their webhook.
set -eu
cd "$(dirname "$0")/.."

docker compose --profile tunnel up -d tunnel

url=''
for _ in $(seq 1 30); do
  url=$(docker compose --profile tunnel logs tunnel 2>/dev/null | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1 || true)
  [ -n "$url" ] && break
  sleep 2
done
[ -n "$url" ] || { echo "Tunnel URL not found in logs: docker compose logs tunnel" >&2; exit 1; }

touch .env
if grep -q '^WEBHOOK_URL=' .env; then
  sed -i "s#^WEBHOOK_URL=.*#WEBHOOK_URL=$url/#" .env
else
  echo "WEBHOOK_URL=$url/" >> .env
fi

docker compose up -d n8n
echo "WEBHOOK_URL=$url/"
