#!/usr/bin/env bash
# run.sh - Quick start for the Sig-Funnel demo application.
#
# Usage:
#   ./run.sh              Start with npm (installs deps if needed)
#   ./run.sh docker       Build and run via Docker
#
# Environment variables (all optional, defaults point to the inSign sandbox):
#   INSIGN_URL   - inSign server URL
#   INSIGN_USER  - Controller username
#   INSIGN_PASS  - Controller password
#   PORT         - Server port (default: 3000)

set -euo pipefail
cd "$(dirname "$0")"

case "${1:-}" in
  docker)
    echo "Building Docker image..."
    docker build -t sig-funnel .
    echo "Starting container on port ${PORT:-3000}..."
    docker run --rm -p "${PORT:-3000}:3000" \
      ${INSIGN_URL:+-e INSIGN_URL="$INSIGN_URL"} \
      ${INSIGN_USER:+-e INSIGN_USER="$INSIGN_USER"} \
      ${INSIGN_PASS:+-e INSIGN_PASS="$INSIGN_PASS"} \
      sig-funnel
    ;;
  *)
    if [ ! -d node_modules ]; then
      echo "Installing dependencies..."
      npm install
    fi
    echo "Starting server on port ${PORT:-3000}..."
    exec node src/server.js
    ;;
esac
