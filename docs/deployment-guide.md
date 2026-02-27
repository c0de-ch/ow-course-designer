# Deployment Guide

Complete guide for deploying OW Course Designer to production using Docker Compose or Kubernetes.

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Google Cloud Setup](#2-google-cloud-setup)
3. [Cloudflare Setup](#3-cloudflare-setup)
4. [Server Preparation](#4-server-preparation)
5. [Environment Configuration](#5-environment-configuration)
6. [Docker Compose Deployment](#6-docker-compose-deployment)
7. [Kubernetes Deployment](#7-kubernetes-deployment)
8. [CI/CD](#8-cicd)
9. [Backup & Maintenance](#9-backup--maintenance)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Requirement | Minimum |
|-------------|---------|
| Server | 1 vCPU, 2 GB RAM, 10 GB disk |
| Docker | 24.0+ with Compose v2 |
| Domain | DNS managed by Cloudflare (or bring your own TLS) |
| Google Cloud | Project with billing enabled |

For Kubernetes deployments, you additionally need:

- A running cluster (1.27+)
- `kubectl` configured with cluster access
- An ingress controller (nginx-ingress) or Cloudflare Tunnel
- cert-manager (if using Let's Encrypt for TLS)

---

## 2. Google Cloud Setup

### 2.1 Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select an existing one
3. Navigate to **APIs & Services → Library**
4. Enable:
   - **Maps JavaScript API**
   - **Places API (New)**
5. Go to **APIs & Services → Credentials**
6. Click **Create Credentials → API key**
7. Configure restrictions on the new key:
   - **Application restrictions**: HTTP referrers
   - Referrers:
     - `https://your-domain.example.com/*`
     - `http://localhost:3000/*` (dev)
   - **API restrictions**: Restrict to **Maps JavaScript API** and **Places API (New)**
8. Copy the key — this becomes `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

### 2.2 OAuth 2.0 Client (Google Login)

1. In the same project, go to **APIs & Services → OAuth consent screen**
2. Configure:
   - **App name**: OW Course Designer
   - **Authorized domains**: your domain (e.g. `example.com`)
   - **Scopes**: `email`, `profile`, `openid`
3. Go to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Settings:
   - **Application type**: Web application
   - **Authorized JavaScript origins**:
     - `https://your-domain.example.com`
     - `http://localhost:3000`
   - **Authorized redirect URIs**:
     - `https://your-domain.example.com/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google`
6. Copy the **Client ID** and **Client Secret**

---

## 3. Cloudflare Setup

Skip this section if you manage TLS another way.

1. In the [Cloudflare Dashboard](https://dash.cloudflare.com/), select your zone
2. **DNS → Records**: Add an **A record**
   - **Name**: your subdomain (e.g. `ow-course-designer`)
   - **IPv4**: your server's public IP
   - **Proxy status**: Proxied (orange cloud)
3. **SSL/TLS → Overview**: Set mode to **Full (strict)**
4. **SSL/TLS → Origin Server**: Create an origin certificate if needed
   - Cloudflare terminates public HTTPS; "Full (strict)" validates the origin cert

Traffic flow: `client → Cloudflare (HTTPS) → your server:3010 (HTTP)`

---

## 4. Server Preparation

### 4.1 Dedicated User

```bash
# As root
adduser --system --group --home /srv/ow-course-designer --shell /bin/bash owcourse
usermod -aG docker owcourse
```

### 4.2 FHS 3.0 Directory Layout

```bash
mkdir -p /srv/ow-course-designer            # compose file + image artifacts
mkdir -p /etc/ow-course-designer            # host-specific config (.env)
mkdir -p /var/lib/ow-course-designer/flyovers  # persistent data (DB + videos)
mkdir -p /var/log/ow-course-designer        # logs (future)

chown -R owcourse:owcourse \
  /srv/ow-course-designer \
  /etc/ow-course-designer \
  /var/lib/ow-course-designer \
  /var/log/ow-course-designer
```

### 4.3 SSH Access

```bash
# From your local machine
ssh-copy-id owcourse@your-server.example.com
```

---

## 5. Environment Configuration

Create `/etc/ow-course-designer/.env` on the server:

```bash
# Authentication
AUTH_URL=https://your-domain.example.com
AUTH_SECRET=<openssl rand -base64 32>

# Google OAuth
GOOGLE_CLIENT_ID=<from section 2.2>
GOOGLE_CLIENT_SECRET=<from section 2.2>

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<from section 2.1>

# Public URL (used by Puppeteer for PDF/PNG export)
NEXT_PUBLIC_APP_URL=https://your-domain.example.com

# Optional: custom Map ID for styled maps
# NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=

# Optional: SMTP for email verification
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=OW Course Designer <noreply@example.com>
# ADMIN_EMAIL=admin@example.com

# Optional: OpenTelemetry
# OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
```

Lock down permissions:

```bash
chmod 600 /etc/ow-course-designer/.env
chown owcourse:owcourse /etc/ow-course-designer/.env
```

Non-secret values (`DATABASE_PROVIDER`, `DATABASE_URL`, `PUPPETEER_EXECUTABLE_PATH`, `NODE_ENV`) are set directly in `docker-compose.prod.yml` — only secrets go in the env file.

---

## 6. Docker Compose Deployment

### 6.1 Build the Image

```bash
# On your local machine (or CI)
docker build -t ow-course-designer:latest .
```

### 6.2 Transfer to Server

```bash
docker save ow-course-designer:latest | ssh owcourse@your-server docker load
```

Or use the deploy script:

```bash
DEPLOY_SERVER=owcourse@your-server bash deploy.sh
```

### 6.3 Deploy

Copy `docker-compose.prod.yml` to `/srv/ow-course-designer/` on the server, then:

```bash
cd /srv/ow-course-designer
docker compose -f docker-compose.prod.yml up -d
```

### 6.4 Verify

```bash
# Check container status and health
docker ps

# Should return {"status":"ok"}
curl -s http://localhost:3010/api/health

# View logs
docker logs ow-course-designer
```

### 6.5 OpenTelemetry Overlay (Optional)

If you run an OTEL collector, create `docker-compose.otel.yml`:

```yaml
version: "3.9"
services:
  app:
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317
```

Deploy with:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.otel.yml up -d
```

---

## 7. Kubernetes Deployment

All manifests live in the `k8s/` directory and are managed via Kustomize.

### 7.1 Prerequisites

- A running Kubernetes cluster (1.27+)
- `kubectl` configured with cluster access
- An ingress controller or Cloudflare Tunnel
- (Optional) cert-manager for automated TLS

### 7.2 Configure Secrets

Edit `k8s/secret.yaml` with your actual values — **do not commit secrets to git**. Alternatively, use a sealed-secrets controller or external secrets operator:

```bash
cp k8s/secret.yaml k8s/secret.local.yaml   # gitignored
# Edit secret.local.yaml with real values
```

### 7.3 Configure Ingress

Edit `k8s/ingress.yaml`:

- Replace `ow-course-designer.example.com` with your domain
- Uncomment the `cert-manager.io/cluster-issuer` annotation if using Let's Encrypt
- Or remove the Ingress entirely if using Cloudflare Tunnel

### 7.4 Set Image Tag

In `k8s/kustomization.yaml`, update the image tag:

```yaml
images:
  - name: ow-course-designer
    newName: your-registry.example.com/ow-course-designer  # if using a registry
    newTag: "1.0.0"
```

### 7.5 Deploy

```bash
# Dry-run first
kubectl apply -k k8s/ --dry-run=client

# Apply
kubectl apply -k k8s/
```

### 7.6 Verify

```bash
# Watch rollout
kubectl -n ow-course-designer rollout status deployment/ow-course-designer

# Check pod status
kubectl -n ow-course-designer get pods

# Check health
kubectl -n ow-course-designer port-forward svc/ow-course-designer 8080:80
curl http://localhost:8080/api/health

# View logs
kubectl -n ow-course-designer logs -l app.kubernetes.io/name=ow-course-designer -f
```

### Design Notes

- **Single replica only** — SQLite does not support concurrent writers. Do not scale above 1.
- **Recreate strategy** — ensures the DB lock is released before the new pod starts. This causes brief downtime (~30s) during updates.
- **Init container** — runs `prisma migrate deploy` separately from the app so migration failures are clearly visible in pod events.
- **`/dev/shm` emptyDir** — Chromium (used for PDF/PNG export) needs more than the default 64MB of shared memory.

---

## 8. CI/CD

### GitHub Actions

The repository includes `.github/workflows/deploy.yml` which builds and deploys on every push to `main`.

**Required GitHub Secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `DEPLOY_HOST` | `your-server.example.com` |
| `DEPLOY_USER` | `owcourse` |
| `DEPLOY_SSH_KEY` | SSH private key for the `owcourse` user |

The workflow:
1. Builds the Docker image
2. Compresses and SCPs it to the server
3. SSHs in, loads the image, runs `docker compose up -d`

For Kubernetes deployments, replace the deploy step with:

```yaml
- name: Deploy to K8s
  run: |
    kubectl set image deployment/ow-course-designer \
      app=your-registry/ow-course-designer:${{ github.sha }} \
      -n ow-course-designer
```

---

## 9. Backup & Maintenance

### 9.1 SQLite Backup

The SQLite database is a single file at `/var/lib/ow-course-designer/prod.db`. Use the `.backup` command for a consistent copy:

```bash
# On the server
sqlite3 /var/lib/ow-course-designer/prod.db ".backup /tmp/ow-backup-$(date +%Y%m%d).db"
```

**Do not** simply `cp` the database file while the application is running — this may produce a corrupted copy.

### 9.2 Flyover Videos

```bash
tar czf /tmp/flyovers-$(date +%Y%m%d).tar.gz -C /var/lib/ow-course-designer flyovers/
```

### 9.3 Automated Backup Script

```bash
#!/usr/bin/env bash
# /etc/cron.daily/ow-course-designer-backup
set -euo pipefail

BACKUP_DIR=/var/backups/ow-course-designer
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y%m%d)

# Database (consistent copy)
sqlite3 /var/lib/ow-course-designer/prod.db ".backup $BACKUP_DIR/prod-$DATE.db"

# Flyover videos
tar czf "$BACKUP_DIR/flyovers-$DATE.tar.gz" -C /var/lib/ow-course-designer flyovers/

# Retain last 7 backups
find "$BACKUP_DIR" -name "prod-*.db" -mtime +7 -delete
find "$BACKUP_DIR" -name "flyovers-*.tar.gz" -mtime +7 -delete
```

### 9.4 Updates

```bash
# Docker Compose
DEPLOY_SERVER=owcourse@your-server bash deploy.sh

# Kubernetes
kubectl -n ow-course-designer set image deployment/ow-course-designer \
  app=ow-course-designer:new-tag \
  migrate=ow-course-designer:new-tag
```

---

## 10. Troubleshooting

### Container won't start

```bash
docker logs ow-course-designer
# Look for Prisma migration errors or missing env vars
```

Common causes:
- Missing `/etc/ow-course-designer/.env` — the compose file requires this file to exist
- `AUTH_SECRET` not set — NextAuth refuses to start without it
- Database path not writable — check volume mount permissions

### Chromium / PDF export crashes

Symptoms: PDF/PNG export returns 500, logs show `Running as root without --no-sandbox is not supported`.

Fix: The container already runs as non-root. If you see shared memory errors:

```
[Chromium] Failed to create shared memory
```

Ensure `shm_size: "256m"` is set in docker-compose (or the `/dev/shm` emptyDir in K8s).

### SQLite database locked

Symptoms: `SQLITE_BUSY` errors in logs.

Causes:
- Multiple container replicas running (only 1 is supported)
- A backup process is holding a lock (`cp` instead of `.backup`)
- Stale WAL file after crash

Fix:

```bash
# Ensure only one container is running
docker ps | grep ow-course-designer

# If using K8s, verify replicas=1
kubectl -n ow-course-designer get deployment

# Checkpoint WAL manually (stop the app first)
sqlite3 /var/lib/ow-course-designer/prod.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

### Google Maps not loading

- Verify `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set and the key has **Maps JavaScript API** and **Places API (New)** enabled
- Check HTTP referrer restrictions match your domain exactly
- Open browser console for specific Google Maps error codes

### OAuth callback errors

- Verify `AUTH_URL` matches your public URL exactly (including `https://`)
- Check **Authorized redirect URIs** in Google Cloud Console include:
  `https://your-domain.example.com/api/auth/callback/google`
- If behind Cloudflare, ensure the proxy is passing the correct `Host` header

### Health check failing

```bash
# Test directly
curl -v http://localhost:3010/api/health

# Inside the container
docker exec ow-course-designer wget -qO- http://localhost:3000/api/health
```

If the health check returns `503`, the database is unreachable. Check:
- Volume mount is correct
- Database file exists and is readable
- No lock contention (see "SQLite database locked" above)
