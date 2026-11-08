#!/usr/bin/env sh
# Restores n8n_data.tgz into the n8n volume. Run on the server before the first start.
set -eu
cd "$(dirname "$0")/.."
[ -f n8n_data.tgz ] || { echo "n8n_data.tgz not found" >&2; exit 1; }

compose="docker compose -f docker-compose.yml -f docker-compose.server.yml"
$compose stop n8n 2>/dev/null || true
docker volume create n8n-rss-digest_n8n_data >/dev/null
docker run --rm -v n8n-rss-digest_n8n_data:/data -v "$PWD":/backup:ro alpine:3.22 \
  sh -c 'tar xzf /backup/n8n_data.tgz -C /data && chown -R 1000:1000 /data'
echo "Restored. Start with: $compose up -d"
