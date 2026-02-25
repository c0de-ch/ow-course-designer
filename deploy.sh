#!/usr/bin/env bash
set -euo pipefail

SERVER="${DEPLOY_SERVER:?Set DEPLOY_SERVER=user@host}"
REMOTE_DIR="${DEPLOY_DIR:-/srv/ow-course-designer}"
IMAGE_NAME="ow-course-designer:latest"

echo "==> Pre-flight: checking /etc/ow-course-designer/.env on $SERVER..."
ssh "$SERVER" "test -f /etc/ow-course-designer/.env" || {
  echo "ERROR: /etc/ow-course-designer/.env not found on $SERVER"
  echo "Create it before deploying — see README.md § Server Setup."
  exit 1
}

echo "==> Building Docker image..."
docker build -t "$IMAGE_NAME" .

echo "==> Saving and transferring image to $SERVER..."
docker save "$IMAGE_NAME" | ssh "$SERVER" docker load

echo "==> Deploying on $SERVER..."
ssh "$SERVER" "
  set -e
  mkdir -p /var/lib/ow-course-designer/flyovers
  mkdir -p /var/log/ow-course-designer
  cd $REMOTE_DIR
  docker compose -f docker-compose.prod.yml pull 2>/dev/null || true
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
"

echo "==> Deployment complete!"
