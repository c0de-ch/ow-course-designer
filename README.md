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

## Container Images

Images are built automatically by GitHub Actions and pushed to GHCR on every push to `main` and on version tags.

```
ghcr.io/c0de-ch/ow-course-designer:latest     # latest from main
ghcr.io/c0de-ch/ow-course-designer:v1.0.0     # tagged release
ghcr.io/c0de-ch/ow-course-designer:sha-abc123  # specific commit
```

## Deployment

Production URL: **https://ow-course-designer.c0de.ch**

Production runs on Kubernetes (k8s01), deployed by Argo CD from the [lab-k8s01-gitops](https://github.com/c0de-ch/lab-k8s01-gitops) repo with the Helm chart in [`deploy/helm/ow-course-designer`](deploy/helm/ow-course-designer).

Every push to `main` deploys like this:

1. **Build & Push to GHCR** (`.github/workflows/ghcr.yml`) builds the image and pushes `ghcr.io/c0de-ch/ow-course-designer:sha-<short>`.
2. **Publish Chart & Deploy** (`.github/workflows/publish-chart.yml`) publishes the chart to `oci://ghcr.io/c0de-ch/charts` when its version is new, then pushes a `deploy/ow-course-designer-sha-<short>` branch to the gitops repo that sets the new image tag. A workflow there opens the pull request.
3. Merging that pull request deploys it: Argo CD syncs the new tag to the cluster.

The workflow needs one secret, `GITOPS_DEPLOY_KEY`: a deploy key with write access to the gitops repo. Secrets, the hostname and routing for production are set in the gitops repo (`apps/ow-course-designer/values.yaml`), not here.

The database (SQLite) and flyover videos live on the chart's persistent volume, mounted at `/app/data`. Run a single replica only: SQLite does not support concurrent writers.

For other clusters, Google Cloud setup and troubleshooting, see **[docs/deployment-guide.md](docs/deployment-guide.md)**.

---

### Google Cloud: Maps API Key

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

### Google Cloud: OAuth 2.0 Client (for Google Login)

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


## License

Private project.
