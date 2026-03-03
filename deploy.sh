#!/usr/bin/env bash
set -euo pipefail

SERVER="${DEPLOY_SERVER:?Set DEPLOY_SERVER=user@host}"
REMOTE_DIR="${DEPLOY_DIR:-/srv/ow-course-designer}"
IMAGE="ghcr.io/c0de-ch/ow-course-designer:latest"

echo "==> Pre-flight: checking /etc/ow-course-designer/.env on $SERVER..."
ssh "$SERVER" "test -f /etc/ow-course-designer/.env" || {
  echo "ERROR: /etc/ow-course-designer/.env not found on $SERVER"
  echo "Create it before deploying — see README.md § Server Setup."
  exit 1
}

echo "==> Copying compose file to $SERVER..."
scp docker-compose.prod.yml "$SERVER:$REMOTE_DIR/"

echo "==> Pulling image and deploying on $SERVER..."
ssh "$SERVER" "
  set -e
  mkdir -p /var/lib/ow-course-designer/flyovers
  mkdir -p /var/log/ow-course-designer
  podman pull $IMAGE
  cd $REMOTE_DIR
  podman compose -f docker-compose.prod.yml up -d --remove-orphans
  podman image prune -f
"

echo "==> Deployment complete!"
