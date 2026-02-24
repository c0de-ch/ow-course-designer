# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`ow-parcour-designer` — a tool for designing open-water swim parkour courses. Users pick a body of water via Google Places autocomplete, drop typed markers (buoys, start/finish, gates, shore entries, rescue zones) on a Google Map, see live distance, then export or share the course.

## Tech Stack

- **Next.js 16** (App Router, TypeScript, `output: 'standalone'`), **Yarn**, **React 19**
- **Ripple UI** (TailwindCSS v3 component library)
- **Google Maps JS API** — Maps + Places (New) API
- **Prisma ORM** — SQLite (dev/prod default), PostgreSQL via schema edit
- **NextAuth.js v4** — Credentials (email/password) + Google OAuth, JWT sessions
- **Zustand** — client state for the designer canvas
- **Puppeteer** — PDF and PNG export (uses system Chromium in Docker)
- **Docker** — multi-stage build, SSH deployment

## Dev Commands

```bash
yarn dev                          # Start dev server (http://localhost:3000)
yarn build                        # Production build
yarn lint                         # ESLint
npx prisma migrate dev            # Run migrations in dev (creates/updates dev.db)
npx prisma migrate deploy         # Apply migrations in production
npx prisma studio                 # DB GUI at http://localhost:5555
npx prisma generate               # Regenerate Prisma client after schema changes
docker build -t ow-parcour-designer .
bash deploy.sh                    # Deploy to server via SSH (needs DEPLOY_SERVER env var)
```

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

```
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./dev.db
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` must have Maps JavaScript API and Places API enabled.

## Architecture

```
src/
  app/
    layout.tsx                    # Root layout (SessionProvider + QueryProvider)
    page.tsx                      # Landing page
    (auth)/login/page.tsx         # Login form (credentials + Google OAuth)
    (auth)/register/page.tsx      # Registration form
    (app)/dashboard/page.tsx      # Course list (protected)
    (app)/designer/page.tsx       # Creates new course and redirects
    (app)/designer/[courseId]/page.tsx  # Designer with auto-save
    share/[token]/page.tsx        # Read-only public view (also Puppeteer target)
    api/
      auth/[...nextauth]/route.ts
      register/route.ts
      courses/route.ts            # GET list, POST create
      courses/[courseId]/route.ts # GET, PUT, DELETE
      courses/[courseId]/export/pdf/route.ts    # Puppeteer PDF
      courses/[courseId]/export/png/route.ts    # Puppeteer PNG
      courses/[courseId]/export/gpx/route.ts    # GPX file
      courses/[courseId]/share/route.ts         # Create snapshot + share URL
  components/
    SessionProvider.tsx           # next-auth session wrapper
    QueryProvider.tsx             # tanstack/react-query wrapper
    designer/
      DesignerCanvas.tsx          # Map init, click listeners, polyline, rescue zone preview
      LakeSearch.tsx              # Places Autocomplete
      ToolPanel.tsx               # Tool selector sidebar
      CourseStats.tsx             # Live distance display
      ExportPanel.tsx             # PDF/PNG/GPX/Share buttons
      MarkerOverlay.ts            # google.maps.OverlayView implementation
      ShareView.tsx               # Read-only map for share/print
      markers/
        markerIcons.ts            # SVG icon strings per element type
  store/
    courseStore.ts                # Zustand store (all designer state + actions)
  lib/
    auth.ts                       # NextAuth config
    prisma.ts                     # Prisma singleton
    haversine.ts                  # Haversine distance calculation
    gpx-builder.ts                # Build GPX XML from course elements
    course-encoder.ts             # base64url encode/decode for snapshots
  middleware.ts                   # Protect /dashboard, /designer, /api/courses
prisma/schema.prisma
```

## Key Patterns

- **Auto-save**: Designer debounces saves 2 s after any store change that sets `isDirty`.
- **Gate tool**: Requires two sequential clicks; first is stored in `gateFirstClick` in the store, second creates `gate_left` + `gate_right` elements.
- **Rescue zone**: Click to add polygon vertices, double-click to close and create element. Vertices stored as JSON in `metadata` field.
- **MarkerOverlay**: Extends `google.maps.OverlayView`, renders SVG div positioned via `fromLatLngToDivPixel`, handles drag with mousedown/mousemove/mouseup.
- **PDF/PNG export**: Puppeteer navigates to `/share/<token>?print=1`, waits for `#map-ready` element, then captures.
- **Database provider**: Hardcoded to `sqlite` in `prisma/schema.prisma`. Change to `postgresql` and update `DATABASE_URL` for production PostgreSQL.

## Google Maps — Always Use the New (Places v2) API

When working with Places, **always** use the new API classes — never the legacy `AutocompleteService`, `PlacesService`, or `PlaceAutocompleteElement`.

| Task | New API |
|------|---------|
| Autocomplete suggestions | `google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions()` |
| Get place details | `placePrediction.toPlace()` then `place.fetchFields({ fields: [...] })` |
| Text search | `google.maps.places.Place.searchByText()` |
| Session tokens | `new google.maps.places.AutocompleteSessionToken()` — create a new token after each selection |

Key properties on `Place`: `displayName`, `location`, `formattedAddress`, `viewport`.

## Deployment

```bash
export DEPLOY_SERVER=user@your-server.com
export DEPLOY_DIR=/srv/ow-parcour-designer
bash deploy.sh
```

Place `.env` (with production values) in `$DEPLOY_DIR` on the server before first deploy.
