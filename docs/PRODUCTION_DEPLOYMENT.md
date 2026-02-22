# Production Deployment Guide

This guide covers deploying HLStatsNext on a single Ubuntu server using Docker Compose with Traefik as the reverse proxy.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Dockerfiles](#dockerfiles)
- [Production Docker Compose](#production-docker-compose)
- [Environment & Secrets](#environment--secrets)
- [Build & Deploy](#build--deploy)
- [Database](#database)
- [Hardening](#hardening)
- [Monitoring](#monitoring)
- [Maintenance](#maintenance)

---

## Prerequisites

- Ubuntu 22.04+ server with Docker Engine 24+ and Docker Compose v2
- Node.js 24+ (for local builds, or build inside Docker)
- Traefik v3 running as a Docker container with auto-discovery enabled
- A domain name (e.g., `hlstatsnext.com`) with DNS A record pointing to your server
- Ports 80/443 open for Traefik, port 27500/udp open for the game daemon

### Assumed Traefik Setup

This guide assumes Traefik is already running with:

- Docker provider enabled (`--providers.docker=true`)
- An external Docker network named `web` that Traefik listens on
- HTTPS via Let's Encrypt with a certificate resolver named `letsencrypt`
- `exposedByDefault=false` so only explicitly labeled containers are exposed

If you don't have Traefik running, see [Traefik's Docker quick start](https://doc.traefik.io/traefik/getting-started/quick-start/).

---

## Dockerfiles

### Web App (Next.js)

Create `apps/web/Dockerfile`:

```dockerfile
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Dependencies stage ---
FROM base AS deps
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc* ./
COPY turbo.json ./

# Copy all package.json files to leverage Docker layer caching
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/daemon/package.json apps/daemon/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/crypto/package.json packages/crypto/
COPY packages/observability/package.json packages/observability/
COPY packages/ui/package.json packages/ui/
COPY packages/config/eslint/package.json packages/config/eslint/
COPY packages/config/typescript/package.json packages/config/typescript/
COPY packages/config/tailwind/package.json packages/config/tailwind/
COPY packages/node-domexception-stub/ packages/node-domexception-stub/

RUN pnpm install --frozen-lockfile

# --- Builder stage ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/ ./
COPY . .

# Generate Prisma client (required by @repo/auth and web)
RUN pnpm --filter @repo/db run db:generate

# Build the web app with standalone output
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web run build

# --- Runner stage ---
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
```

> **Important**: Next.js standalone output must be enabled. Add to `apps/web/next.config.ts`:
>
> ```ts
> const nextConfig: NextConfig = {
>   output: "standalone",
>   // ... existing config
> }
> ```

### API (GraphQL Yoga)

Create `apps/api/Dockerfile`:

```dockerfile
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Dependencies stage ---
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc* ./
COPY turbo.json ./

COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/daemon/package.json apps/daemon/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/crypto/package.json packages/crypto/
COPY packages/observability/package.json packages/observability/
COPY packages/ui/package.json packages/ui/
COPY packages/config/eslint/package.json packages/config/eslint/
COPY packages/config/typescript/package.json packages/config/typescript/
COPY packages/config/tailwind/package.json packages/config/tailwind/
COPY packages/node-domexception-stub/ packages/node-domexception-stub/

RUN pnpm install --frozen-lockfile

# --- Builder stage ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/ ./
COPY . .

# Generate Prisma client
RUN pnpm --filter @repo/db run db:generate

# Build the API (tsc -> dist/)
RUN pnpm --filter api run build

# --- Runner stage ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

# Copy the full workspace — the API needs workspace packages at runtime
# since internal packages (auth, db, crypto) use TypeScript source exports
COPY --from=builder /app/ ./

# Remove build artifacts and dev dependencies, reinstall prod-only
RUN pnpm prune --prod --no-optional

USER appuser

EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]
```

> **Note**: The API references workspace packages (`@repo/auth`, `@repo/db`, `@repo/crypto`) via
> TypeScript source exports (e.g., `"./client": "./src/client.ts"`). In production, Node.js resolves
> these through the workspace symlinks. The full workspace is preserved to keep these paths valid.
> A `pnpm prune --prod` removes dev-only dependencies to reduce image size.

### Daemon

Create `apps/daemon/Dockerfile.prod`:

```dockerfile
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Dependencies stage ---
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc* ./
COPY turbo.json ./

COPY apps/daemon/package.json apps/daemon/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/crypto/package.json packages/crypto/
COPY packages/observability/package.json packages/observability/
COPY packages/ui/package.json packages/ui/
COPY packages/config/eslint/package.json packages/config/eslint/
COPY packages/config/typescript/package.json packages/config/typescript/
COPY packages/config/tailwind/package.json packages/config/tailwind/
COPY packages/node-domexception-stub/ packages/node-domexception-stub/

RUN pnpm install --frozen-lockfile

# --- Builder stage ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/ ./
COPY . .

# Generate Prisma client
RUN pnpm --filter @repo/db run db:generate

# Build the daemon (tsc -> dist/)
RUN pnpm --filter daemon run build

# --- Runner stage ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

# Copy full workspace (same rationale as API — workspace package resolution)
COPY --from=builder /app/ ./

RUN pnpm prune --prod --no-optional

USER appuser

# UDP ingress port + metrics port
EXPOSE 27500/udp
EXPOSE 9091

CMD ["node", "--import", "tsx", "apps/daemon/dist/main.js"]
```

> **Note on path aliases**: The daemon uses TypeScript path aliases (`@/*` -> `src/*`). Since `tsc`
> does not rewrite these in output, the compiled `dist/` files still contain `@/` imports. The
> `--import tsx` flag registers a loader that resolves these at runtime. Alternatively, you can add
> `tsc-alias` as a post-build step to rewrite paths in the compiled output and drop the tsx runtime
> dependency entirely.

### .dockerignore

Create `.dockerignore` in the repository root:

```
node_modules
.next
dist
.turbo
.git
.env*
!.env.example
docker/
servers/
docs/
*.md
.vscode
.idea
```

---

## Production Docker Compose

Create `docker-compose.prod.yml` in the repository root:

```yaml
name: hlstatsnext-prod

services:
  # ─── Database ─────────────────────────────────────────────
  db:
    image: mysql:8.4
    container_name: hlstatsnext-db
    command: mysqld --mysql-native-password=ON
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASS}
      MYSQL_DATABASE: ${DB_NAME}
    volumes:
      - db-data:/var/lib/mysql
      - ./docker/mysql/my.cnf:/etc/mysql/conf.d/my.cnf:ro
    networks:
      - internal
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${DB_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 512M

  # ─── Message Queue ────────────────────────────────────────
  rabbitmq:
    image: rabbitmq:4.1.2-management-alpine
    container_name: hlstatsnext-rabbitmq
    hostname: hlstatsnext-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
      RABBITMQ_DEFAULT_VHOST: ${RABBITMQ_VHOST}
      RABBITMQ_ERLANG_COOKIE: ${RABBITMQ_ERLANG_COOKIE}
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq
      - ./docker/rabbitmq/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
      - ./docker/rabbitmq/definitions.json:/etc/rabbitmq/definitions.json:ro
    networks:
      - internal
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 10s
    deploy:
      resources:
        limits:
          memory: 512M

  # ─── Cache (Garnet — Redis-compatible) ────────────────────
  garnet:
    image: ghcr.io/microsoft/garnet:latest
    container_name: hlstatsnext-garnet
    hostname: hlstatsnext-garnet
    command: --port 6379 --memory ${GARNET_MEMORY:-1g} --checkpointdir /data
    volumes:
      - garnet-data:/data
    networks:
      - internal
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "bash -c 'echo PING > /dev/tcp/localhost/6379'"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
    deploy:
      resources:
        limits:
          memory: 1G

  # ─── Web App (Next.js) ───────────────────────────────────
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: hlstatsnext-web
    environment:
      NODE_ENV: production
      NEXT_TELEMETRY_DISABLED: "1"
      DATABASE_URL: "mysql://${DB_USER}:${DB_PASS}@db:3306/${DB_NAME}"
      NEXT_PUBLIC_GRAPHQL_URL: "https://${API_DOMAIN}/graphql"
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: "https://${WEB_DOMAIN}"
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
      MAIL_PROVIDER: ${MAIL_PROVIDER:-resend}
      RESEND_API_KEY: ${RESEND_API_KEY:-}
      MAIL_FROM: ${MAIL_FROM:-noreply@hlstatsnext.com}
    networks:
      - internal
      - web
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.hlstatsnext-web.rule=Host(`${WEB_DOMAIN}`)"
      - "traefik.http.routers.hlstatsnext-web.entrypoints=websecure"
      - "traefik.http.routers.hlstatsnext-web.tls.certresolver=letsencrypt"
      - "traefik.http.services.hlstatsnext-web.loadbalancer.server.port=3000"
      - "traefik.docker.network=web"
    deploy:
      resources:
        limits:
          memory: 512M

  # ─── API (GraphQL Yoga) ──────────────────────────────────
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: hlstatsnext-api
    environment:
      NODE_ENV: production
      PORT: "4000"
      DATABASE_URL: "mysql://${DB_USER}:${DB_PASS}@db:3306/${DB_NAME}"
      FRONTEND_URL: "https://${WEB_DOMAIN}"
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: "https://${WEB_DOMAIN}"
    networks:
      - internal
      - web
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:4000/graphql"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 15s
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.hlstatsnext-api.rule=Host(`${API_DOMAIN}`)"
      - "traefik.http.routers.hlstatsnext-api.entrypoints=websecure"
      - "traefik.http.routers.hlstatsnext-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.hlstatsnext-api.loadbalancer.server.port=4000"
      - "traefik.docker.network=web"
    deploy:
      resources:
        limits:
          memory: 512M

  # ─── Daemon (Game Server Log Receiver) ───────────────────
  daemon:
    build:
      context: .
      dockerfile: apps/daemon/Dockerfile.prod
    container_name: hlstatsnext-daemon
    environment:
      NODE_ENV: production
      DATABASE_URL: "mysql://${DB_USER}:${DB_PASS}@db:3306/${DB_NAME}"
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      LOG_LEVEL: ${LOG_LEVEL:-info}
      INGRESS_PORT: "27500"
      METRICS_PORT: "9091"
      RABBITMQ_URL: "amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672/${RABBITMQ_VHOST}"
      RCON_ENABLED: ${RCON_ENABLED:-true}
      RCON_TIMEOUT: ${RCON_TIMEOUT:-5000}
      RCON_MAX_RETRIES: ${RCON_MAX_RETRIES:-3}
      RCON_STATUS_INTERVAL: ${RCON_STATUS_INTERVAL:-30000}
      RCON_ACTIVE_SERVER_MAX_AGE_MINUTES: ${RCON_ACTIVE_SERVER_MAX_AGE_MINUTES:-60}
      RCON_MAX_CONSECUTIVE_FAILURES: ${RCON_MAX_CONSECUTIVE_FAILURES:-10}
      RCON_BACKOFF_MULTIPLIER: ${RCON_BACKOFF_MULTIPLIER:-2}
      RCON_MAX_BACKOFF_MINUTES: ${RCON_MAX_BACKOFF_MINUTES:-30}
      RCON_DORMANT_RETRY_MINUTES: ${RCON_DORMANT_RETRY_MINUTES:-60}
      CACHE_ENABLED: ${CACHE_ENABLED:-true}
      CACHE_HOST: hlstatsnext-garnet
      CACHE_PORT: "6379"
      CACHE_PASSWORD: ${CACHE_PASSWORD:-}
      CACHE_KEY_PREFIX: "hlstats:"
      CACHE_DEFAULT_TTL: ${CACHE_DEFAULT_TTL:-3600}
    ports:
      - "27500:27500/udp"
    networks:
      - internal
    depends_on:
      db:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:9091/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 15s
    deploy:
      resources:
        limits:
          memory: 512M

  # ─── Monitoring: Prometheus ──────────────────────────────
  prometheus:
    image: prom/prometheus:latest
    container_name: hlstatsnext-prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
      - "--storage.tsdb.retention.time=30d"
      - "--web.console.libraries=/usr/share/prometheus/console_libraries"
      - "--web.console.templates=/usr/share/prometheus/consoles"
    volumes:
      - ./docker/prometheus/prometheus.prod.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    networks:
      - internal
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:9090/-/healthy"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ─── Monitoring: Grafana ─────────────────────────────────
  grafana:
    image: grafana/grafana:latest
    container_name: hlstatsnext-grafana
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
      GF_SERVER_ROOT_URL: "https://${GRAFANA_DOMAIN}"
      GF_INSTALL_PLUGINS: grafana-clock-panel,grafana-piechart-panel
      GF_PATHS_PROVISIONING: /etc/grafana/provisioning
    volumes:
      - grafana-data:/var/lib/grafana
      - ./docker/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./docker/grafana/dashboards:/var/lib/grafana/dashboards:ro
    networks:
      - internal
      - web
    depends_on:
      - prometheus
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.hlstatsnext-grafana.rule=Host(`${GRAFANA_DOMAIN}`)"
      - "traefik.http.routers.hlstatsnext-grafana.entrypoints=websecure"
      - "traefik.http.routers.hlstatsnext-grafana.tls.certresolver=letsencrypt"
      - "traefik.http.services.hlstatsnext-grafana.loadbalancer.server.port=3000"
      - "traefik.docker.network=web"
    deploy:
      resources:
        limits:
          memory: 256M

networks:
  internal:
    name: hlstatsnext-internal
    driver: bridge
  web:
    external: true

volumes:
  db-data:
  rabbitmq-data:
  garnet-data:
  prometheus-data:
  grafana-data:
```

### Production Prometheus Config

Create `docker/prometheus/prometheus.prod.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  scrape_timeout: 10s
  external_labels:
    monitor: "hlstatsnext"
    environment: "production"

scrape_configs:
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  - job_name: "hlstats-daemon"
    static_configs:
      - targets: ["hlstatsnext-daemon:9091"]
        labels:
          service: "daemon"

  - job_name: "rabbitmq"
    static_configs:
      - targets: ["hlstatsnext-rabbitmq:15692"]
        labels:
          service: "rabbitmq"
```

---

## Environment & Secrets

Create `.env.production` alongside `docker-compose.prod.yml`. Never commit this file.

```bash
# ─── Domains ────────────────────────────────────────────────
WEB_DOMAIN=hlstatsnext.com
API_DOMAIN=api.hlstatsnext.com
GRAFANA_DOMAIN=grafana.hlstatsnext.com

# ─── Database ───────────────────────────────────────────────
DB_NAME=hlstatsnext
DB_USER=hlstatsnext
DB_ROOT_PASSWORD=          # generate: openssl rand -base64 32
DB_PASS=                   # generate: openssl rand -base64 32

# ─── RabbitMQ ───────────────────────────────────────────────
RABBITMQ_USER=hlstats
RABBITMQ_PASSWORD=         # generate: openssl rand -base64 32
RABBITMQ_VHOST=hlstats
RABBITMQ_ERLANG_COOKIE=    # generate: openssl rand -hex 32

# ─── Cache (Garnet) ────────────────────────────────────────
GARNET_MEMORY=2g
CACHE_ENABLED=true
CACHE_PASSWORD=

# ─── Application Secrets ───────────────────────────────────
ENCRYPTION_KEY=            # generate: openssl rand -base64 32
BETTER_AUTH_SECRET=        # generate: openssl rand -base64 32

# ─── OAuth (optional) ──────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ─── Mail ───────────────────────────────────────────────────
MAIL_PROVIDER=resend
RESEND_API_KEY=
MAIL_FROM=noreply@hlstatsnext.com

# ─── Grafana ───────────────────────────────────────────────
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=    # generate: openssl rand -base64 24

# ─── Daemon ────────────────────────────────────────────────
LOG_LEVEL=info
RCON_ENABLED=true
RCON_TIMEOUT=5000
RCON_MAX_RETRIES=3
RCON_STATUS_INTERVAL=30000
RCON_ACTIVE_SERVER_MAX_AGE_MINUTES=60
RCON_MAX_CONSECUTIVE_FAILURES=10
RCON_BACKOFF_MULTIPLIER=2
RCON_MAX_BACKOFF_MINUTES=30
RCON_DORMANT_RETRY_MINUTES=60
CACHE_DEFAULT_TTL=3600
```

Generate all secrets at once:

```bash
echo "DB_ROOT_PASSWORD='$(openssl rand -base64 32)'"
echo "DB_PASS='$(openssl rand -base64 32)'"
echo "RABBITMQ_PASSWORD='$(openssl rand -base64 32)'"
echo "RABBITMQ_ERLANG_COOKIE='$(openssl rand -hex 32)'"
echo "ENCRYPTION_KEY='$(openssl rand -base64 32)'"
echo "BETTER_AUTH_SECRET='$(openssl rand -base64 32)'"
echo "GRAFANA_ADMIN_PASSWORD='$(openssl rand -base64 24)'"
```

Copy the output into `.env.production`, always wrapping values in single quotes to preserve special characters.

---

## Build & Deploy

### First-Time Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/hlstatsnext.com.git
cd hlstatsnext.com

# 2. Create and populate .env.production (see above)
cp /dev/null .env.production
nano .env.production

# 3. Ensure the external Traefik network exists
docker network create web 2>/dev/null || true

# 4. Add standalone output to Next.js config (if not already done)
# In apps/web/next.config.ts, add: output: "standalone"

# 5. Build and start all services
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 6. Wait for the database to be healthy
docker compose -f docker-compose.prod.yml --env-file .env.production exec db \
  mysqladmin ping -h localhost -u root -p"$DB_ROOT_PASSWORD" --wait=30

# 7. Run database migrations
docker compose -f docker-compose.prod.yml --env-file .env.production exec web \
  npx prisma migrate deploy --schema=./packages/db/prisma/schema.prisma

# 8. Seed initial data (game definitions, admin user, etc.)
docker compose -f docker-compose.prod.yml --env-file .env.production exec api \
  npx tsx packages/db/src/seed.ts

# 9. Seed GeoIP data
docker compose -f docker-compose.prod.yml --env-file .env.production exec api \
  npx tsx packages/db/src/scripts/seed-geoip.ts

# 10. Verify all containers are running
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

### Subsequent Deploys

```bash
cd hlstatsnext.com
git pull origin main

# Rebuild and restart only changed services
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Run any pending migrations
docker compose -f docker-compose.prod.yml --env-file .env.production exec web \
  npx prisma migrate deploy --schema=./packages/db/prisma/schema.prisma
```

### Verifying the Deployment

```bash
# Check all services are healthy
docker compose -f docker-compose.prod.yml --env-file .env.production ps

# Test the web app
curl -sI https://hlstatsnext.com | head -5

# Test the API
curl -s https://api.hlstatsnext.com/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ __typename }"}' | head -20

# Check daemon logs
docker logs hlstatsnext-daemon --tail 50

# Check Grafana
curl -sI https://grafana.hlstatsnext.com | head -5
```

---

## Database

### Production MySQL Tuning

The `docker/mysql/my.cnf` file is shared between dev and prod. For production with more RAM, override the buffer pool size with a bind mount or a separate config:

```ini
[mysqld]
# Set to 50-70% of available system memory
innodb_buffer_pool_size = 4G

# Increase for high-concurrency workloads
max_connections = 200
table_open_cache = 4000

# Write performance
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT

# Redo log — larger for write-heavy workloads
innodb_redo_log_capacity = 256M
```

To use a production-specific config, create `docker/mysql/my.prod.cnf` and update the volume mount in `docker-compose.prod.yml`:

```yaml
volumes:
  - ./docker/mysql/my.prod.cnf:/etc/mysql/conf.d/my.cnf:ro
```

### Migrations

Prisma migrations are applied using `prisma migrate deploy` (not `dev`), which only applies pending migrations without generating new ones:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec web \
  npx prisma migrate deploy --schema=./packages/db/prisma/schema.prisma
```

### Backup

```bash
# Full database backup
docker exec hlstatsnext-db mysqldump \
  -u root -p"${DB_ROOT_PASSWORD}" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  ${DB_NAME} > "backup-$(date +%Y%m%d-%H%M%S).sql"
```

### Restore

```bash
# Restore from backup (WARNING: this replaces all data)
docker exec -i hlstatsnext-db mysql \
  -u root -p"${DB_ROOT_PASSWORD}" \
  ${DB_NAME} < backup-20260222-120000.sql
```

### Backup without GeoIP tables

The GeoIP tables are large and can be re-seeded. To skip them:

```bash
docker exec hlstatsnext-db mysqldump \
  -u root -p"${DB_ROOT_PASSWORD}" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --ignore-table=${DB_NAME}.GeoLiteCityBlock \
  --ignore-table=${DB_NAME}.GeoLiteCityLocation \
  ${DB_NAME} > "backup-no-geo-$(date +%Y%m%d-%H%M%S).sql"
```

---

## Hardening

### Non-Root Containers

All application Dockerfiles (web, api, daemon) create and switch to a non-root user. The infrastructure containers (MySQL, RabbitMQ, Garnet, Prometheus, Grafana) run as their own non-root users by default.

### Read-Only Filesystems

Add `read_only: true` and explicit tmpfs mounts where the app needs to write:

```yaml
web:
  read_only: true
  tmpfs:
    - /tmp

api:
  read_only: true
  tmpfs:
    - /tmp

daemon:
  read_only: true
  tmpfs:
    - /tmp
```

### Network Isolation

The compose file uses two networks:

- **`internal`** — all services communicate here. Not exposed to Traefik.
- **`web`** (external) — only `web`, `api`, and `grafana` are on this network, making them discoverable by Traefik.

The database, RabbitMQ, Garnet, and Prometheus are only on the `internal` network and are not reachable from outside.

### No Exposed Ports on Infrastructure

Note that `db`, `rabbitmq`, `garnet`, and `prometheus` have **no `ports:` mapping** in the production compose file. They are only accessible via the internal Docker network. This is a deliberate difference from the dev compose file.

### Firewall (UFW)

Docker bypasses UFW by default. To fix this:

```bash
# /etc/docker/daemon.json
{
  "iptables": false
}
```

Then restart Docker and configure UFW:

```bash
sudo systemctl restart docker

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS (for Traefik)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow game server UDP
sudo ufw allow 27500/udp

# Enable UFW
sudo ufw enable
```

> **Warning**: Setting `"iptables": false` means Docker won't create iptables rules for container
> networking. You'll need to ensure inter-container communication works. An alternative is to use
> `DOCKER_OPTS="--iptables=false"` in `/etc/default/docker` or keep Docker iptables on and use
> `ufw-docker` utility for finer-grained control. Test thoroughly after changing this.

### Docker Daemon Security

```bash
# /etc/docker/daemon.json
{
  "no-new-privileges": true,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### Secrets

- Never commit `.env.production` — add it to `.gitignore`
- Use `chmod 600 .env.production` to restrict file permissions
- All secrets should be generated with `openssl rand` (see [Environment & Secrets](#environment--secrets))

---

## Monitoring

### Architecture

```
Game Servers → [UDP:27500] → Daemon → [metrics:9091] → Prometheus → Grafana
                                         ↕
                               RabbitMQ [metrics:15692] → Prometheus
```

- **Daemon** exposes Prometheus metrics on port 9091 (events processed, queue depth, active players, etc.)
- **RabbitMQ** exposes metrics on port 15692 (built-in Prometheus plugin)
- **Prometheus** scrapes both targets every 15 seconds, stores 30 days of data
- **Grafana** provides dashboards at `https://grafana.hlstatsnext.com`

### Accessing Grafana

Grafana is exposed via Traefik at `https://${GRAFANA_DOMAIN}`. Log in with the credentials from `.env.production`.

The provisioned dashboards at `docker/grafana/dashboards/` are automatically loaded.

### Adding Alerting (Optional)

Uncomment the alertmanager section in `docker/prometheus/prometheus.prod.yml` and add an Alertmanager container to the compose file if you want Slack/email alerts.

---

## Maintenance

### Viewing Logs

```bash
# All services
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f

# Specific service
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f daemon

# Last 100 lines
docker logs hlstatsnext-daemon --tail 100
```

### Log Rotation

Docker log rotation is configured in `/etc/docker/daemon.json` (see [Hardening](#docker-daemon-security)). Each container keeps at most 3 log files of 10MB each.

### Updating Images

```bash
# Pull latest infrastructure images
docker compose -f docker-compose.prod.yml --env-file .env.production pull

# Recreate only containers with updated images
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Restarting a Single Service

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production restart daemon
```

### Rollback

If a deploy introduces issues:

```bash
# 1. Check what changed
git log --oneline -5

# 2. Revert to the previous commit
git checkout <previous-commit-hash>

# 3. Rebuild and restart
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 4. Reapply migrations if needed (migrate deploy is idempotent)
docker compose -f docker-compose.prod.yml --env-file .env.production exec web \
  npx prisma migrate deploy --schema=./packages/db/prisma/schema.prisma
```

> **Warning**: If the bad deploy included a migration that altered or dropped data, rolling back code
> alone won't undo the database change. Restore from a backup if needed.

### Updating GeoIP Data

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec api \
  npx tsx packages/db/src/scripts/seed-geoip.ts update
```

### Pruning Unused Docker Resources

```bash
# Remove dangling images (safe)
docker image prune -f

# Remove all unused images, containers, networks (more aggressive)
docker system prune -f
```
