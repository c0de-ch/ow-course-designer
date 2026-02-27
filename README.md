# OW Course Designer

A tool for designing open-water swim courses. Users pick a body of water via Google Places autocomplete, drop typed markers (buoys, start/finish, gates, shore entries, rescue zones) on a Google Map, see live distance, then export or share the course.

## Getting Started

```bash
cp .env.example .env        # Fill in values (see below)
yarn install
npx prisma migrate dev       # Create/update SQLite database
yarn dev                     # http://localhost:3000
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_PROVIDER` | `sqlite` (default) or `postgresql` |
| `DATABASE_URL` | `file:./dev.db` for SQLite, or a Postgres connection string |
| `NEXTAUTH_URL` | App URL, e.g. `http://localhost:3000` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps JavaScript API + Places API enabled |
| `NEXT_PUBLIC_APP_URL` | Public URL (used for Puppeteer exports) |

## Commands

```bash
yarn dev                          # Development server
yarn build                        # Production build
yarn lint                         # ESLint
npx prisma migrate dev            # Run migrations (dev)
npx prisma migrate deploy         # Apply migrations (production)
npx prisma studio                 # DB GUI at localhost:5555
```

## Deployment

Production URL: **https://ow-course-designer.c0de.ch**

The app runs as a Docker container on port **3010** behind Cloudflare proxy (HTTPS). Kubernetes manifests are available in `k8s/`.

For the full deployment guide — including Google Cloud setup, Cloudflare configuration, Kubernetes, backups, and troubleshooting — see **[docs/deployment-guide.md](docs/deployment-guide.md)**.

---

### 1. Server: Create a Dedicated User

```bash
# As root on the server
adduser --system --group --home /srv/ow-course-designer --shell /bin/bash owcourse

# Add to docker group so it can manage containers
usermod -aG docker owcourse

# Create FHS-compliant directories
mkdir -p /srv/ow-course-designer            # compose file + image artifacts
mkdir -p /etc/ow-course-designer            # host-specific config (.env)
mkdir -p /var/lib/ow-course-designer/flyovers  # persistent data (DB + videos)
mkdir -p /var/log/ow-course-designer        # logs (future)

chown -R owcourse:owcourse /srv/ow-course-designer \
                           /etc/ow-course-designer \
                           /var/lib/ow-course-designer \
                           /var/log/ow-course-designer
```

Set up SSH key access for deployments (from your local machine or GitHub Actions):

```bash
# On your local machine — copy your public key to the server
ssh-copy-id owcourse@ow-course-designer.c0de.ch
```

---

### 2. Google Cloud: Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Go to **APIs & Services → Library**
4. Enable these APIs:
   - **Maps JavaScript API**
   - **Places API (New)**
5. Go to **APIs & Services → Credentials**
6. Click **Create Credentials → API key**
7. Click on the newly created key to configure restrictions:
   - **Application restrictions**: HTTP referrers
   - Add these referrers:
     - `https://ow-course-designer.c0de.ch/*`
     - `http://localhost:3000/*` (for local dev)
   - **API restrictions**: Restrict key → select **Maps JavaScript API** and **Places API (New)**
8. Copy the API key → this is your `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

---

### 3. Google Cloud: OAuth 2.0 Client (for Google Login)

1. In the same Google Cloud project, go to **APIs & Services → OAuth consent screen**
2. Configure the consent screen:
   - **App name**: OW Course Designer
   - **User support email**: your email
   - **Authorized domains**: `c0de.ch`
   - **Developer contact email**: your email
3. Add scopes: `email`, `profile`, `openid`
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth client ID**
6. **Application type**: Web application
7. **Name**: OW Course Designer
8. **Authorized JavaScript origins**:
   - `https://ow-course-designer.c0de.ch`
   - `http://localhost:3000` (for local dev)
9. **Authorized redirect URIs**:
   - `https://ow-course-designer.c0de.ch/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (for local dev)
10. Click **Create** and copy:
    - **Client ID** → `GOOGLE_CLIENT_ID`
    - **Client secret** → `GOOGLE_CLIENT_SECRET`

---

### 4. Server: Environment File

```bash
# On the server as owcourse
sudo -u owcourse bash

cat > /etc/ow-course-designer/.env <<'EOF'
NEXTAUTH_URL=https://ow-course-designer.c0de.ch
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
GOOGLE_CLIENT_ID=<from step 3>
GOOGLE_CLIENT_SECRET=<from step 3>
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<from step 2>
NEXT_PUBLIC_APP_URL=https://ow-course-designer.c0de.ch
EOF

chmod 600 /etc/ow-course-designer/.env
```

Non-secret build-time defaults (`DATABASE_PROVIDER`, `DATABASE_URL`, `PUPPETEER_EXECUTABLE_PATH`) are set inline in `docker-compose.prod.yml` — only secrets and host-specific values go in the env file.

---

### 5. Cloudflare: DNS & HTTPS

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/) → select the `c0de.ch` zone
2. Go to **DNS → Records**
3. Add an **A record**:
   - **Name**: `ow-course-designer`
   - **IPv4 address**: your server IP
   - **Proxy status**: **Proxied** (orange cloud)
4. Go to **SSL/TLS → Overview**
   - Set encryption mode to **Full (strict)**
5. Go to **SSL/TLS → Origin Server**
   - Create an **Origin Certificate** if you don't have one already (Cloudflare generates a cert for your server)
   - Install it on your server or use a self-signed cert — Cloudflare terminates public HTTPS, and "Full (strict)" validates the origin cert
6. Cloudflare proxies `https://ow-course-designer.c0de.ch` → `http://your-server:3010`

The container binds to port **3010** on the host. Cloudflare handles HTTPS termination and proxies traffic to this port.

---

### 6. Deploy

#### Manual Deploy

```bash
DEPLOY_SERVER=owcourse@ow-course-designer.c0de.ch bash deploy.sh
```

Requires Docker installed locally and SSH access to the server.

#### Auto Deploy (GitHub Actions)

Pushes to `main` trigger `.github/workflows/deploy.yml` which builds the Docker image, copies it to the server, and restarts the container.

**Required GitHub Secrets** (Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | `ow-course-designer.c0de.ch` |
| `DEPLOY_USER` | `owcourse` |
| `DEPLOY_SSH_KEY` | SSH private key for the `owcourse` user |
| `DEPLOY_SERVER` | `owcourse@ow-course-designer.c0de.ch` (used by `deploy.sh` for manual/CI deploys) |

### Data Volumes (FHS 3.0 Layout)

The deployment follows the [FHS 3.0](https://refspecs.linuxfoundation.org/FHS_3.0/fhs/index.html) directory layout:

| Path | Purpose |
|------|---------|
| `/srv/ow-course-designer/` | Compose file, Docker image artifacts |
| `/etc/ow-course-designer/.env` | Host-specific configuration (secrets) |
| `/var/lib/ow-course-designer/` | Persistent data — mounted to `/app/data` in the container |
| `/var/lib/ow-course-designer/prod.db` | SQLite database |
| `/var/lib/ow-course-designer/flyovers/` | Pre-recorded flyover videos |
| `/var/log/ow-course-designer/` | Log files (future) |

## License

Private project.
