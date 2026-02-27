# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile


# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_PROVIDER=sqlite
ENV DATABASE_URL=file:./dev.db
ENV NEXTAUTH_SECRET=build-placeholder
ENV NEXTAUTH_URL=http://localhost:3000
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=placeholder
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000

RUN npx prisma generate
RUN yarn build


# Stage 3: Runtime
FROM node:20-alpine AS runner
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/kim/ow-course-designer"
LABEL org.opencontainers.image.description="Open-water swim course designer"

# Install Chromium for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
ENV OTEL_SERVICE_NAME=ow-course-designer

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --spider -q http://localhost:3000/api/health || exit 1

# Create data directory for flyover videos (mount as volume in production)
RUN mkdir -p /app/data/flyovers

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
