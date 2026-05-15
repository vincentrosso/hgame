#!/usr/bin/env bash
set -euo pipefail

SERVER_USER="root"
SERVER_HOST="${HGAME_HOST:-178.156.145.181}"
REMOTE_DIR="/var/www/hgame"
NODE_BIN="$HOME/.nvm/versions/node/v24.11.1/bin"

if [[ -n "${1:-}" ]]; then
  SERVER_HOST="$1"
fi

if [[ -z "$SERVER_HOST" ]]; then
  echo "Usage: ./scripts/deploy.sh <server-ip>"
  echo "   or: HGAME_HOST=<server-ip> ./scripts/deploy.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "==> Building..."
PATH="$NODE_BIN:$PATH" "$NODE_BIN/npm" run build

echo "==> Deploying to $SERVER_USER@$SERVER_HOST:$REMOTE_DIR ..."
rsync -avz --delete dist/ "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/"

echo "==> Done. https://hgame.ndex.us"
