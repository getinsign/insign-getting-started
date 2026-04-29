#!/usr/bin/env bash
# Launch a local n8n instance (Docker) with n8n-nodes-insign pre-installed.
#
# What it does
#   1. Builds the TypeScript package in this repo
#   2. Packs it as a tarball
#   3. Installs that tarball into a local .n8n-docker/custom workspace
#      (n8n picks up nodes from ~/.n8n/custom at startup)
#   4. Runs the official n8nio/n8n Docker image, mounting the workspace
#
# Usage
#   scripts/run-n8n-docker.sh                  # start on http://localhost:5678
#   scripts/run-n8n-docker.sh --rebuild        # force rebuild + reinstall
#   scripts/run-n8n-docker.sh --port 5679      # use a different port
#   scripts/run-n8n-docker.sh --down           # stop and remove the container
#   scripts/run-n8n-docker.sh --import-example # also import the quickstart workflow
#
# Data is persisted under .n8n-docker/data so workflows and credentials
# survive restarts. Delete that folder to start fresh.
set -euo pipefail

PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="$PKG_DIR/.n8n-docker"
DATA_DIR="$WORK_DIR/data"
CUSTOM_DIR="$WORK_DIR/custom"
CONTAINER_NAME="n8n-insign-dev"
IMAGE="docker.n8n.io/n8nio/n8n:latest"
PORT="5678"
REBUILD=false
DOWN=false

IMPORT_EXAMPLE=false
RESET_DATA=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rebuild)        REBUILD=true; shift ;;
    --port)           PORT="$2"; shift 2 ;;
    --down)           DOWN=true; shift ;;
    --import-example) IMPORT_EXAMPLE=true; shift ;;
    --reset)          RESET_DATA=true; shift ;;
    -h|--help)
      sed -n '1,25p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

if $RESET_DATA; then
  echo "→ Wiping $DATA_DIR (all workflows/credentials/users will be gone)"
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR"
fi

if $DOWN; then
  echo "→ Stopping $CONTAINER_NAME"
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  echo "✓ Stopped. Data preserved at $DATA_DIR"
  exit 0
fi

command -v docker >/dev/null || { echo "docker not found in PATH" >&2; exit 1; }
command -v node   >/dev/null || { echo "node not found in PATH"   >&2; exit 1; }

echo "→ Building $PKG_DIR"
cd "$PKG_DIR"
if $REBUILD || [[ ! -d dist ]]; then
  npm install --no-audit --no-fund
  npm run build
fi

echo "→ Packing tarball"
TARBALL_NAME="$(npm pack --silent)"
TARBALL_PATH="$PKG_DIR/$TARBALL_NAME"

echo "→ Preparing $CUSTOM_DIR (clean install)"
mkdir -p "$DATA_DIR"
# Nuke the previous custom install entirely - npm install from a file: path
# with an unchanged version won't reinstall, so the container would keep
# running stale code after a --rebuild. Wipe and reinstall every time.
rm -rf "$CUSTOM_DIR"
mkdir -p "$CUSTOM_DIR"
cat > "$CUSTOM_DIR/package.json" <<JSON
{
  "name": "insign-custom-nodes",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "n8n-nodes-insign": "file:./$TARBALL_NAME"
  }
}
JSON
mv "$TARBALL_PATH" "$CUSTOM_DIR/$TARBALL_NAME"
(cd "$CUSTOM_DIR" && npm install --no-audit --no-fund --silent)

echo "→ Starting n8n (container: $CONTAINER_NAME, port: $PORT)"
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
# Mount our prepared node_modules into ~/.n8n/nodes which is n8n's official
# "community packages" location. n8n's UI only treats packages installed here
# (or via the UI installer) as "installed community nodes" — packages loaded
# via ~/.n8n/custom or N8N_CUSTOM_EXTENSIONS show up but trigger the
# "Install this node to use it" prompt on every node click.
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "${PORT}:5678" \
  -v "$DATA_DIR:/home/node/.n8n" \
  -v "$CUSTOM_DIR:/home/node/.n8n/nodes" \
  -e N8N_LOG_LEVEL="${N8N_LOG_LEVEL:-debug}" \
  -e N8N_COMMUNITY_PACKAGES_ENABLED="true" \
  -e N8N_SECURE_COOKIE="false" \
  "$IMAGE" >/dev/null

# Register the package in installed_packages + installed_nodes so the UI
# stops showing the "Install this node to use it" prompt. Without this the
# nodes load fine but n8n treats them as "unknown community node".
echo "→ Waiting for n8n DB to be ready then registering community package"
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:${PORT}/healthz" >/dev/null 2>&1; then break; fi
  sleep 1
done
PKG_VERSION="$(node -p "require('$PKG_DIR/package.json').version")"
docker exec "$CONTAINER_NAME" node -e "
  const s = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
  const db = new s.Database('/home/node/.n8n/database.sqlite');
  db.serialize(() => {
    db.run(\"INSERT OR REPLACE INTO installed_packages (packageName, installedVersion, authorName, authorEmail, createdAt, updatedAt) VALUES ('n8n-nodes-insign', '${PKG_VERSION}', 'inSign GmbH', '', datetime('now'), datetime('now'))\");
    db.run(\"INSERT OR REPLACE INTO installed_nodes (name, type, latestVersion, package) VALUES ('inSign', 'n8n-nodes-insign.insign', 1, 'n8n-nodes-insign')\");
    db.run(\"INSERT OR REPLACE INTO installed_nodes (name, type, latestVersion, package) VALUES ('inSign Trigger', 'n8n-nodes-insign.insignTrigger', 1, 'n8n-nodes-insign')\");
  });
" >/dev/null 2>&1 || true

if $IMPORT_EXAMPLE; then
  echo "→ Waiting for n8n to finish booting before importing example workflow"
  for _ in $(seq 1 60); do
    if curl -fsS "http://localhost:${PORT}/healthz" >/dev/null 2>&1; then break; fi
    sleep 1
  done
  docker cp "$PKG_DIR/examples/quickstart-workflow.json" "$CONTAINER_NAME:/tmp/quickstart-workflow.json" >/dev/null

  # Find the first owner user via n8n's own sqlite3 module (Alpine image has no sqlite3 CLI).
  USER_ID="$(docker exec "$CONTAINER_NAME" node -e "
    const s = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
    const db = new s.Database('/home/node/.n8n/database.sqlite', s.OPEN_READONLY);
    db.get(\"SELECT id FROM user WHERE roleSlug='global:owner' LIMIT 1\", (e,r) => { if (r?.id) process.stdout.write(r.id); });
  " 2>/dev/null || true)"

  if [[ -n "$USER_ID" ]]; then
    echo "→ Importing workflow and assigning to user $USER_ID"
    docker exec "$CONTAINER_NAME" n8n import:workflow --input=/tmp/quickstart-workflow.json --userId="$USER_ID" \
      || echo "  (import returned non-zero — see logs above)"
  else
    echo "→ No owner user yet. Finish the signup wizard in the UI and re-run with --import-example."
  fi
fi

echo ""
echo "✓ n8n is starting at http://localhost:${PORT}"
echo "  First launch: give it ~20s to initialize the DB."
echo ""
echo "  Logs     : docker logs -f $CONTAINER_NAME"
echo "  Stop     : $0 --down"
echo "  Rebuild  : $0 --rebuild"
echo ""
echo "  In the n8n UI, search nodes for 'inSign' — both the action node"
echo "  and the trigger should appear. Create an 'inSign API' credential"
echo "  and use the sandbox defaults to try it out."
