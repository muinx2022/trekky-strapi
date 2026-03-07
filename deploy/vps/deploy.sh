#!/usr/bin/env bash
set -euo pipefail

COMMIT_SHA="${1:-unknown}"
shift || true

if [[ $# -eq 0 ]]; then
  echo "No services requested. Nothing to deploy."
  exit 0
fi

if [[ -z "${DEPLOY_COMPOSE_DIR:-}" ]]; then
  echo "DEPLOY_COMPOSE_DIR is required" >&2
  exit 1
fi

COMPOSE_FILE="${DEPLOY_COMPOSE_FILE:-docker-compose.yml}"
VALID_SERVICES=("api" "web" "admin")
SERVICES=()
PULL_RETRIES="${DEPLOY_PULL_RETRIES:-3}"
PULL_RETRY_DELAY="${DEPLOY_PULL_RETRY_DELAY:-8}"

is_valid_service() {
  local candidate="$1"
  local service

  for service in "${VALID_SERVICES[@]}"; do
    if [[ "$service" == "$candidate" ]]; then
      return 0
    fi
  done

  return 1
}

for service in "$@"; do
  if ! is_valid_service "$service"; then
    echo "Unsupported service: $service" >&2
    exit 1
  fi

  SERVICES+=("$service")
done

cd "$DEPLOY_COMPOSE_DIR"

echo "[$(date -Iseconds)] Deploy start"
echo "Ref: ${DEPLOY_REF:-unknown}"
echo "SHA: $COMMIT_SHA"
echo "Services: ${SERVICES[*]}"

pull_with_retry() {
  local attempt=1

  while true; do
    if docker compose -f "$COMPOSE_FILE" pull "${SERVICES[@]}"; then
      return 0
    fi

    if [[ "$attempt" -ge "$PULL_RETRIES" ]]; then
      echo "Pull failed after ${PULL_RETRIES} attempts" >&2
      return 1
    fi

    echo "Pull attempt ${attempt}/${PULL_RETRIES} failed. Retrying in ${PULL_RETRY_DELAY}s..." >&2
    attempt=$((attempt + 1))
    sleep "$PULL_RETRY_DELAY"
  done
}

pull_with_retry
docker compose -f "$COMPOSE_FILE" up -d --no-deps "${SERVICES[@]}"
docker compose -f "$COMPOSE_FILE" ps "${SERVICES[@]}"

echo "[$(date -Iseconds)] Deploy complete"
