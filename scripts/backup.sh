#!/usr/bin/env sh
# Archives the n8n volume (workflows, credentials with their encryption key, data tables) into n8n_data.tgz.
# n8n is stopped for the copy so SQLite is not caught mid-write.
set -eu
cd "$(dirname "$0")/.."

docker compose stop n8n
docker run --rm -v n8n-rss-digest_n8n_data:/data:ro -v "$PWD":/backup alpine:3.22 \
  tar czf /backup/n8n_data.tgz -C /data .
docker compose start n8n
ls -lh n8n_data.tgz
