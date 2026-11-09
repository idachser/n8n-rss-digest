#!/usr/bin/env sh
# Runs on the server: syncs to origin/main, imports the workflows into the running n8n while keeping
# credentials attached in the UI, republishes what was published and restarts n8n.
set -eu

compose="docker compose -f docker-compose.yml -f docker-compose.server.yml"

wait_ready() {
  for _ in $(seq 1 60); do
    if $compose exec -T n8n wget -qO- http://localhost:5678/healthz/readiness 2>/dev/null | grep -q ok; then
      return 0
    fi
    sleep 2
  done
  echo "n8n did not become ready" >&2
  exit 1
}

# Wrapped in a function so the shell has read the whole script before git reset rewrites this file.
main() {
  cd "$(dirname "$0")/.."

  git fetch --quiet origin main
  git reset --hard --quiet origin/main

  $compose up -d --remove-orphans
  wait_ready

  $compose exec -T n8n sh -c 'rm -rf /tmp/deploy && mkdir -p /tmp/deploy/live &&
    (n8n export:workflow --all --separate --output=/tmp/deploy/live/ >/dev/null 2>&1 || true)'
  $compose exec -T n8n node - < scripts/merge-credentials.js
  $compose exec -T n8n sh -c 'n8n import:workflow --separate --input=/tmp/deploy/out >/dev/null 2>&1 &&
    for id in $(cat /tmp/deploy/publish.txt); do n8n publish:workflow --id="$id" >/dev/null 2>&1; done'

  # Published versions and webhooks are only picked up on startup.
  $compose restart n8n
  wait_ready
  echo "Deployed $(git rev-parse --short HEAD)"
}

main "$@"
exit
