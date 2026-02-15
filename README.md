# HLStatsNext

![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/jstnmthw/219301cadcc7f71b0c68504a429be810/raw/hlstatsnext-coverage.json)

> ⚠️ **Early Development** — This project is under active development.

A modern game statistics platform for Half-Life engine games — rebuilt from the ground up.

HLStatsNext is a complete modernization of HLstatsX:CE, replacing the legacy PHP/Perl stack with a TypeScript-first architecture. Real-time stats, GraphQL API, Next.js frontend, and seamless Docker deployment.

## Features

- **Real-time Statistics** — Node.js daemon processes game events instantly
- **Modern Stack** — TypeScript, Next.js 16, GraphQL Yoga, Prisma, MySQL 8.4
- **Turborepo Monorepo** — Shared packages, optimized builds, hot-reload dev
- **Docker Ready** — MySQL, RabbitMQ, Garnet (Redis), Prometheus, Grafana
- **Type-Safe API** — End-to-end type safety with GraphQL code generation
- **GeoIP Support** — Player geolocation via MaxMind GeoLite2

## Quick Start

```bash
git clone https://github.com/jstnmthw/hlstatsnext.git
cd hlstatsnext
pnpm install

# Copy environment files (minimum required)
cp env.example .env
cp packages/database/env.example packages/database/.env
cp apps/daemon/env.example apps/daemon/.env
cp apps/api/env.example apps/api/.env
cp apps/web/env.example apps/web/.env

# Start infrastructure and initialize database
docker compose up -d
pnpm db:generate && pnpm db:push && pnpm db:seed
pnpm dev
```

**Prerequisites:** Node.js 24+, pnpm 10.x, Docker & Docker Compose

> **Note:** The daemon and API require an encryption key for RCON passwords. Generate one with `openssl rand -base64 32` and add it to `apps/daemon/.env` and `apps/api/.env`. See **[INSTALLATION.md](./INSTALLATION.md)** for complete setup or **[DEVELOPMENT.md](./DEVELOPMENT.md)** for full dev environment details.

## Development

```bash
pnpm dev           # Start all apps with hot-reload
pnpm build         # Build all apps and packages
pnpm lint          # Lint codebase
pnpm test          # Run tests
pnpm codegen       # Generate GraphQL types (requires API running)
```

Database commands:

```bash
pnpm db:generate   # Generate Prisma client
pnpm db:push       # Push schema to database
pnpm db:seed       # Seed default data
pnpm db:seed:geo   # Seed GeoIP data (requires MaxMind account)
pnpm db:studio     # Open Prisma Studio GUI
```

Add UI components:

```bash
pnpm ui add button
```

## Docker

Comprehensive Makefile for container management. Run `make help` for all commands.

```bash
make              # Restart all containers (down + up)
make up           # Start containers
make down         # Stop containers
make logs         # View logs
make status       # Container status
```

### Services

| Service    | Port(s)     | Description                         |
| ---------- | ----------- | ----------------------------------- |
| db         | 3306        | MySQL 8.4 database                  |
| rabbitmq   | 5672, 15672 | Message queue + management UI       |
| garnet     | 6379        | Redis-compatible cache              |
| prometheus | 9090        | Metrics collection                  |
| grafana    | 3001        | Metrics visualization (admin/admin) |

### Service Commands

```bash
# Database
make db-logs      make db-shell     make db-backup

# Daemon (when containerized)
make daemon-logs  make daemon-shell make daemon-restart
```

### Environment Variables

The project uses multiple `.env` files for different components:

| File                     | Purpose                                        |
| ------------------------ | ---------------------------------------------- |
| `.env`                   | Docker Compose (database, cache, queues)       |
| `packages/database/.env` | Prisma connection, MaxMind credentials         |
| `packages/crypto/.env`   | Shared encryption key                          |
| `apps/daemon/.env`       | Daemon config (RCON, RabbitMQ, cache, logging) |
| `apps/api/.env`          | API server (port, CORS)                        |
| `apps/web/.env`          | Frontend (GraphQL endpoint)                    |

See **[INSTALLATION.md](./INSTALLATION.md)** for complete configuration details and **[DEVELOPMENT.md](./DEVELOPMENT.md)** for dev workflows.

### Network

Custom bridge network `hlstatsnext-network` on subnet `10.5.0.0/16`.

## Connecting Game Servers

Configure your game server to forward logs to the daemon:

```
// server.cfg (Source Engine)
logaddress_add <daemon_ip>:27500
log on
```

See **[INSTALLATION.md](./INSTALLATION.md#game-server-configuration)** for detailed setup.

## Contributing

See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for detailed guidelines.

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes
4. Push and open a Pull Request

## License

This project is source-available under the Business Source License (BSL). Free for personal and community game servers.

Commercial hosting or offering this software as a service is not permitted without a commercial license.

For licensing inquiries: support@hlstatsnext.com

## Acknowledgments

- Original [HLstatsX:CE](https://github.com/NomisCZ/hlstatsx-community-edition) project
- The Source engine gaming community
