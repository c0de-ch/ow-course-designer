# Deployment Guide

How to deploy OW Course Designer on Kubernetes. Production (https://ow-course-designer.c0de.ch) runs on k8s01, deployed by Argo CD from the [lab-k8s01-gitops](https://github.com/c0de-ch/lab-k8s01-gitops) repo.

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Google Cloud Setup](#2-google-cloud-setup)
3. [Configuration](#3-configuration)
4. [Install with Helm](#4-install-with-helm)
5. [CI/CD](#5-cicd)
6. [Backup & Maintenance](#6-backup--maintenance)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

- A Kubernetes cluster (1.27+) and `kubectl` with access to it
- Helm 3
- A Gateway API gateway or an ingress controller to route traffic to the service
- A storage class for a `ReadWriteOnce` volume (5 Gi by default)
- A Google Cloud project with billing enabled (Maps, optional Google sign-in)

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
8. Copy the key — this becomes the `GOOGLE_MAPS_API_KEY` secret

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

## 3. Configuration

The chart (`deploy/helm/ow-course-designer`, published as `oci://ghcr.io/c0de-ch/charts/ow-course-designer`) takes three kinds of settings.

**Secrets.** Point `secrets.existingSecret` at a Secret you manage (a SealedSecret in GitOps), or let the chart create one from `secrets.create` for a quick install (the values then end up in the release history). Keys the app reads:

| Key | |
|-----|---|
| `AUTH_SECRET` | Required. `openssl rand -base64 32` |
| `GOOGLE_MAPS_API_KEY` | From section 2.1 |
| `GOOGLE_MAPS_MAP_ID` | Optional, for a styled map |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional, Google sign-in (section 2.2) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Sign-up verification emails |
| `ADMIN_EMAIL` | |

**Non-secret settings** go in `config` (for example `SMTP_SECURE`). The database settings (`DATABASE_PROVIDER=sqlite`, `DATABASE_URL=file:/app/data/prod.db`) are set by the chart.

**Public URL.** Set `appUrl` to the public base URL (used for share links and as `AUTH_URL`). Leave it empty when the app answers on several hostnames: it then takes the URL from each request.

**Routing.** Add one entry per Gateway to `httpRoutes`, or enable `ingress`. When TLS ends in front of the Gateway (Cloudflare, for example), set `forwardedProtoHttps: true` on the route so the app knows the client used https.

---

## 4. Install with Helm

```bash
helm install ow-course-designer oci://ghcr.io/c0de-ch/charts/ow-course-designer \
  -n ow-course-designer --create-namespace \
  -f my-values.yaml
```

Verify:

```bash
kubectl -n ow-course-designer rollout status deployment/ow-course-designer
kubectl -n ow-course-designer get pods

# Should return {"status":"ok"}
kubectl -n ow-course-designer port-forward svc/ow-course-designer 8080:80
curl http://localhost:8080/api/health

kubectl -n ow-course-designer logs deployment/ow-course-designer -c app -f
```

### Design Notes

- **Single replica only** — SQLite does not support concurrent writers. Do not scale above 1.
- **Recreate strategy** — ensures the DB lock is released before the new pod starts. This causes brief downtime (~30s) during updates.
- **Init container** — runs `prisma migrate deploy` separately from the app so migration failures are clearly visible in pod events.
- **`/dev/shm` emptyDir** — Chromium (used for PDF/PNG export) needs more than the default 64MB of shared memory.

### Plain manifests (Kustomize)

The `k8s/` directory holds plain manifests as an alternative to the chart.

#### Secrets

Edit `k8s/secret.yaml` with your actual values — **do not commit secrets to git**. Alternatively, use a sealed-secrets controller or external secrets operator:

```bash
cp k8s/secret.yaml k8s/secret.local.yaml   # gitignored
# Edit secret.local.yaml with real values
```

#### Ingress

Edit `k8s/ingress.yaml`:

- Replace `ow-course-designer.example.com` with your domain
- Uncomment the `cert-manager.io/cluster-issuer` annotation if using Let's Encrypt
- Or remove the Ingress entirely if using Cloudflare Tunnel

#### Image tag

In `k8s/kustomization.yaml`, update the image tag:

```yaml
images:
  - name: ow-course-designer
    newName: your-registry.example.com/ow-course-designer  # if using a registry
    newTag: "1.0.0"
```

#### Apply

```bash
# Dry-run first
kubectl apply -k k8s/ --dry-run=client

# Apply
kubectl apply -k k8s/
```

---

## 5. CI/CD

Every push to `main`:

1. **Build & Push to GHCR** (`.github/workflows/ghcr.yml`) builds the image and pushes `ghcr.io/c0de-ch/ow-course-designer:sha-<short>`.
2. **Publish Chart & Deploy** (`.github/workflows/publish-chart.yml`) publishes the chart when its version is new, then pushes a branch to the gitops repo that sets the new image tag (`apps/ow-course-designer/values.yaml`) and chart version. A workflow there opens the pull request.
3. Merging that pull request deploys it through Argo CD.

Only the newest commit on `main` is proposed; an older run that finishes later skips itself. The workflow needs the `GITOPS_DEPLOY_KEY` secret, a deploy key with write access to the gitops repo.

---

## 6. Backup & Maintenance

The SQLite database (`/app/data/prod.db`) and the flyover videos (`/app/data/flyovers/`) live on the persistent volume.

### 6.1 Backup

The image has no `sqlite3` CLI, so take a consistent copy with the app stopped:

```bash
NS=ow-course-designer
kubectl -n $NS scale deployment/ow-course-designer --replicas=0
kubectl -n $NS run backup --rm -i --restart=Never --image=busybox \
  --overrides='{"spec":{"securityContext":{"runAsUser":1000},"containers":[{"name":"backup","image":"busybox","command":["tar","czf","-","-C","/data","."],"stdin":true,"volumeMounts":[{"name":"data","mountPath":"/data"}]}],"volumes":[{"name":"data","persistentVolumeClaim":{"claimName":"ow-course-designer-data"}}]}}' \
  > ow-course-designer-data-$(date +%Y%m%d).tar.gz
kubectl -n $NS scale deployment/ow-course-designer --replicas=1
```

The archive holds `prod.db` and `flyovers/`. **Do not** copy the database file while the app is running: the copy may be corrupt. For regular backups, a CSI volume snapshot or Velero avoids the downtime.

### 6.2 Updates

In production, merge the gitops pull request (section 5). For a manual Helm install:

```bash
helm upgrade ow-course-designer oci://ghcr.io/c0de-ch/charts/ow-course-designer \
  -n ow-course-designer --reuse-values --set image.tag=sha-<short>
```

---

## 7. Troubleshooting

### Pod won't start

```bash
kubectl -n ow-course-designer describe pod -l app.kubernetes.io/name=ow-course-designer
kubectl -n ow-course-designer logs deployment/ow-course-designer -c migrate
kubectl -n ow-course-designer logs deployment/ow-course-designer -c app
```

Common causes:
- A failed migration: the `migrate` init container's log shows it
- `AUTH_SECRET` missing from the Secret: NextAuth refuses to start without it
- The volume is not writable or not bound: check the PVC with `kubectl get pvc`

### Chromium / PDF export crashes

If the logs show `Failed to create shared memory`, raise `shmSize` (default `256Mi`); the chart mounts it as `/dev/shm`.

### SQLite database locked

Symptoms: `SQLITE_BUSY` errors in the logs. Causes:
- More than one replica: the app supports exactly one
- A stale WAL file after a crash

### Google Maps not loading

- Verify `GOOGLE_MAPS_API_KEY` is set in the Secret and the key has **Maps JavaScript API** and **Places API (New)** enabled
- Check HTTP referrer restrictions match your domain exactly
- Open browser console for specific Google Maps error codes

### OAuth callback errors

- Verify `appUrl` (`AUTH_URL`) matches your public URL exactly (including `https://`), or leave it empty and set `forwardedProtoHttps` on the route
- Check **Authorized redirect URIs** in Google Cloud Console include:
  `https://your-domain.example.com/api/auth/callback/google`
- If behind Cloudflare, ensure the proxy is passing the correct `Host` header

### Health check failing

```bash
kubectl -n ow-course-designer exec deployment/ow-course-designer -c app -- wget -qO- http://localhost:3000/api/health
```

If it returns `503`, the database is unreachable: check that the volume is mounted and `/app/data/prod.db` exists.
