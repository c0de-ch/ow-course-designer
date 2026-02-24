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

### Server Prerequisites

- Docker and Docker Compose
- SSH access

### Data Volumes

The `./data` directory on the host is mounted to `/app/data` inside the container. It stores:

- `prod.db` — SQLite database
- `flyovers/` — Pre-recorded flyover videos attached to shared courses

This directory is persisted via the Docker volume mount in `docker-compose.prod.yml`.

### First-time Setup

```bash
# On the server
mkdir -p /srv/ow-course-designer/data/flyovers
cd /srv/ow-course-designer

# Create .env with production values
cat > .env <<'EOF'
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./data/prod.db
NEXTAUTH_URL=https://ow-design.c0de.ch
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-maps-api-key>
NEXT_PUBLIC_APP_URL=https://ow-design.c0de.ch
EOF
```

### DNS & SSL (Cloudflare)

1. Add an **A record** for `ow-design.c0de.ch` pointing to the server IP, **proxied** (orange cloud)
2. Set SSL/TLS mode to **Full (strict)**

### Manual Deploy

```bash
export DEPLOY_SERVER=user@your-server.com
export DEPLOY_DIR=/srv/ow-course-designer
bash deploy.sh
```

### Auto Deploy (GitHub Actions)

Pushes to `main` trigger `.github/workflows/deploy.yml` which builds the Docker image, copies it to the server, and restarts the container.

**Required GitHub Secrets:**

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | Server hostname or IP |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_SSH_KEY` | SSH private key |

## License

Private project.
