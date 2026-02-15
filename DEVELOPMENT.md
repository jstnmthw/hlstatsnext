# HLStatsNext Development Guide

Everything you need to get a local development environment running.

For installation and deployment details, see [INSTALLATION.md](./INSTALLATION.md).

## Table of Contents

- [Quick Start](#quick-start)
- [Running in Development Mode](#running-in-development-mode)
- [Common Commands](#common-commands)
- [Database Workflow](#database-workflow)
- [GraphQL Workflow](#graphql-workflow)
- [Adding UI Components](#adding-ui-components)
- [Observability](#observability)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/jstnmthw/hlstatsnext.git
cd hlstatsnext

# 2. Install dependencies
pnpm install

# 3. Copy environment files
cp env.example .env
cp packages/database/env.example packages/database/.env
cp packages/crypto/env.example packages/crypto/.env
cp apps/daemon/env.example apps/daemon/.env
cp apps/api/env.example apps/api/.env
cp apps/web/env.example apps/web/.env

# 4. Generate encryption key and update .env files
openssl rand -base64 32
# Copy the output to ENCRYPTION_KEY in:
#   - packages/crypto/.env
#   - apps/daemon/.env
#   - apps/api/.env

# 5. Start Docker services
docker compose up -d

# 6. Initialize database
pnpm db:generate
pnpm db:push
pnpm db:seed

# 7. (Optional) Setup GeoIP data - requires MaxMind account
# Edit packages/database/.env with your MaxMind credentials first
pnpm db:seed:geo

# 8. Start development servers
pnpm dev
```

**Access Points:**

- Web UI: http://localhost:3000
- GraphQL API: http://localhost:4000/graphql
- Grafana: http://localhost:3001 (admin/admin)
- RabbitMQ Management: http://localhost:15672 (hlstats/hlstats)
- Prometheus: http://localhost:9090

> For detailed environment variable configuration, see [INSTALLATION.md — Environment Configuration](./INSTALLATION.md#environment-configuration).

---

## Running in Development Mode

Start all apps with hot-reload:

```bash
pnpm dev
```

This launches:

- **Web:** http://localhost:3000 (Next.js with Turbopack)
- **API:** http://localhost:4000/graphql (GraphQL Yoga)
- **Daemon:** UDP listener on port 27500

### Running Individual Apps

```bash
# Web only
cd apps/web && pnpm dev

# API only
cd apps/api && pnpm dev

# Daemon only
cd apps/daemon && pnpm dev
```

---

## Common Commands

| Command              | Description                                  |
| -------------------- | -------------------------------------------- |
| `pnpm install`       | Install all dependencies                     |
| `pnpm dev`           | Start all apps with hot-reload               |
| `pnpm build`         | Build all packages and apps                  |
| `pnpm test`          | Run tests                                    |
| `pnpm test:coverage` | Run tests with coverage                      |
| `pnpm lint`          | Lint codebase (strict mode, 0 warnings)      |
| `pnpm check-types`   | TypeScript type checking across all packages |
| `pnpm format:fix`    | Format code with Prettier                    |
| `pnpm codegen`       | Generate GraphQL types (API must be running) |

---

## Database Workflow

After modifying the schema at `packages/database/prisma/schema.prisma`:

```bash
# Regenerate Prisma client
pnpm db:generate

# Push changes to database
pnpm db:push
```

For production, create a migration instead:

```bash
pnpm db:migrate
```

### All Database Commands

| Command              | Description                           |
| -------------------- | ------------------------------------- |
| `pnpm db:generate`   | Generate Prisma client from schema    |
| `pnpm db:push`       | Push schema changes to database (dev) |
| `pnpm db:migrate`    | Create migration files (production)   |
| `pnpm db:seed`       | Seed default game data                |
| `pnpm db:seed:geo`   | Download and seed GeoIP data          |
| `pnpm db:geo:update` | Force update GeoIP data               |
| `pnpm db:studio`     | Open Prisma Studio GUI                |
| `pnpm db:fresh`      | Reset to clean state                  |
| `pnpm db:reset`      | Full reset with seeding               |

---

## GraphQL Workflow

After making changes to the API schema:

```bash
# 1. Start the API server (if not already running)
cd apps/api && pnpm dev

# 2. In another terminal, regenerate types
pnpm codegen
```

When writing GraphQL queries in the web app, always use the typed `graphql()` function:

```typescript
import { graphql } from "@/lib/gql"

const MY_QUERY = graphql(`
  query MyQuery {
    ...
  }
`)
```

---

## Adding UI Components

The project uses shadcn/ui for components:

```bash
# Add a component
pnpm ui add button
pnpm ui add card
pnpm ui add dialog

# Or from the ui package directly
cd packages/ui && pnpm ui add [component]
```

---

## Observability

Local development includes pre-configured monitoring services:

### Grafana Dashboards

1. Access: http://localhost:3001
2. Default login: admin/admin
3. Dashboards auto-provisioned from `docker/grafana/dashboards/`

### Prometheus Metrics

Access: http://localhost:9090

The daemon exposes metrics including event processing rates, player counts, server statistics, and queue depths.

### RabbitMQ Management

1. Access: http://localhost:15672
2. Login: hlstats/hlstats
3. View queues, exchanges, and message rates
