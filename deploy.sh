#!/usr/bin/env bash
set -euo pipefail

SERVER="${DEPLOY_SERVER:?Set DEPLOY_SERVER=user@host}"
REMOTE_DIR="${DEPLOY_DIR:-/srv/ow-parcour-designer}"
IMAGE_NAME="ow-parcour-designer:latest"

echo "==> Building Docker image..."
docker build -t "$IMAGE_NAME" .

echo "==> Saving and transferring image to $SERVER..."
docker save "$IMAGE_NAME" | ssh "$SERVER" docker load

echo "==> Deploying on $SERVER..."
ssh "$SERVER" "
  set -e
  mkdir -p $REMOTE_DIR/data
  cd $REMOTE_DIR
  docker compose -f docker-compose.prod.yml pull 2>/dev/null || true
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
"

echo "==> Deployment complete!"
