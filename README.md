# HLStatsNext

A modern game statistics platform for Half-Life engine games — rebuilt from the ground up.

⚠️ **Early Development** — This project is under active development.

HLStatsNext is a complete modernization of HLstatsX:CE, replacing the legacy PHP/Perl stack with a TypeScript-first architecture. Real-time stats, GraphQL API, Next.js frontend, and seamless Docker deployment.

## Features

- **Real-time Statistics** — Node.js daemon processes game events instantly
- **Modern Stack** — TypeScript, Next.js, GraphQL (Yoga), MySQL 8.4
- **Turborepo Monorepo** — Shared packages, optimized builds, hot-reload dev
- **Docker Ready** — Full containerization with LinuxGSM game server integration
- **Type-Safe API** — End-to-end type safety with GraphQL code generation

## Quick Start

```bash
git clone https://github.com/jstnmthw/hlstatsnext.git
cd hlstatsnext
pnpm install
cp .env.example .env
pnpm dev
```

**Prerequisites:** Node.js 24+, pnpm, Docker & Docker Compose

## Development

```bash
pnpm dev        # Start development server
pnpm build      # Build all apps and packages
pnpm lint       # Lint codebase
pnpm test       # Run tests
pnpm codegen    # Generate GraphQL types (requires API running)
```

Add UI components:

```bash
cd packages/ui && pnpm ui add button
```

## Project Structure

```
├── apps/
│   ├── api/            # GraphQL Yoga API
│   ├── daemon/         # Real-time statistics daemon
│   └── web/            # Next.js frontend
├── packages/
│   ├── ui/             # Shared UI components (shadcn/ui)
│   ├── database/       # Database schemas and utilities
│   └── *-config/       # Shared configurations
├── docker/             # Docker configuration
└── servers/            # Game server data (cs1, cs2)
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

| Service | Port          | Description       |
| ------- | ------------- | ----------------- |
| daemon  | 27500/udp     | Statistics daemon |
| db      | 3306          | MySQL 8.4         |
| cs1     | 27015/tcp+udp | Example CS server |
| cs2     | 27016/tcp+udp | Example CS server |

### Service Commands

```bash
# Database
make db-logs      make db-shell     make db-backup

# Daemon
make daemon-logs  make daemon-shell make daemon-restart

# Game servers (cs1/cs2)
make cs1-restart  make cs1-logs     make cs1-shell
make cs2-restart  make cs2-logs     make cs2-shell
```

### Environment Variables

```bash
# Database
DB_HOST=db:3306
DB_NAME=hlstatsnext
DB_USER=hlstatsnext
DB_PASS=hlstatsnext

# Game servers
USER_ID=1000
GROUP_ID=1000
```

### Network

Custom bridge network `hlstatsnext-network` on subnet `10.5.0.0/16` with static daemon IP `10.5.0.50`.

## Adding Game Servers

1. Add service to `docker-compose.yml` (follow `cs1`/`cs2` pattern)
2. Create directory in `./servers/`
3. Add Makefile targets
4. Configure unique port mappings

Example:

```yaml
cs3:
  image: gameservermanagers/gameserver:cs
  container_name: hlstatsnext-cs-3
  environment:
    - UID=${USER_ID:-1000}
    - GID=${GROUP_ID:-1000}
  volumes:
    - ./servers/cs3:/data
  ports:
    - "27017:27015/udp"
    - "27017:27015/tcp"
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes
4. Push and open a Pull Request

## License

TBD

## Acknowledgments

- Original [HLstatsX:CE](https://github.com/NomisCZ/hlstatsx-community-edition) project
- The Source engine gaming community
