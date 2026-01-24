# HLStatsNext Installation Guide

Complete installation and setup guide for HLStatsNext — a modern game statistics platform for Half-Life engine games.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Docker Services](#docker-services)
- [Database Setup](#database-setup)
- [GeoIP Setup (MaxMind)](#geoip-setup-maxmind)
- [Running the Application](#running-the-application)
- [Development Workflow](#development-workflow)
- [Game Server Configuration](#game-server-configuration)
- [Observability](#observability)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Software           | Version | Purpose                                       |
| ------------------ | ------- | --------------------------------------------- |
| **Node.js**        | 24.0.0+ | JavaScript runtime                            |
| **pnpm**           | 10.x    | Package manager (10.17.1 pinned via Corepack) |
| **Docker**         | Latest  | Container runtime                             |
| **Docker Compose** | v2+     | Container orchestration                       |
| **Git**            | Latest  | Version control                               |

### Optional Tools

| Tool          | Purpose                     |
| ------------- | --------------------------- |
| **Make**      | Docker management shortcuts |
| **tar/unzip** | GeoIP archive extraction    |
| **openssl**   | Encryption key generation   |

### Verify Prerequisites

```bash
node --version    # Should be v24.0.0 or higher
pnpm --version    # Should be 10.x (Corepack will use 10.17.1)
docker --version
docker compose version
```

### Installing pnpm

If you don't have pnpm installed:

```bash
# Using Corepack (recommended) - auto-uses version from package.json
corepack enable

# Or install manually via npm
npm install -g pnpm
```

---

## Project Structure

```
hlstatsnext/
├── apps/
│   ├── api/              # GraphQL Yoga API server (port 4000)
│   ├── daemon/           # Real-time statistics daemon (UDP 27500)
│   └── web/              # Next.js frontend (port 3000)
├── packages/
│   ├── database/         # Prisma ORM, MySQL client, GraphQL types
│   ├── ui/               # Shared shadcn/ui components
│   ├── crypto/           # Encryption utilities
│   ├── observability/    # Prometheus metrics
│   ├── eslint-config/    # Shared ESLint configuration
│   ├── typescript-config/# Shared TypeScript configuration
│   └── tailwind-config/  # Shared Tailwind CSS configuration
├── docker/               # Docker configuration files
│   ├── mysql/            # MySQL config and init scripts
│   ├── rabbitmq/         # RabbitMQ config and definitions
│   ├── prometheus/       # Prometheus scrape config
│   └── grafana/          # Grafana dashboards and provisioning
├── servers/              # Game server data (optional)
├── docker-compose.yml    # Docker services definition
├── Makefile              # Docker management shortcuts
└── turbo.json            # Turborepo build configuration
```

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

---

## Environment Configuration

### Root Environment (`.env`)

Docker Compose configuration for infrastructure services.

```bash
# Docker project name
COMPOSE_PROJECT_NAME=hlstatsnext

# User/Group IDs for file permissions (match your host user)
USER_ID=1000
GROUP_ID=1000

# Database Configuration
DB_HOST=db
DB_PORT=3306
DB_NAME=hlstatsnext
DB_USER=hlstatsnext
DB_PASS=changeme
DB_ROOT_PASSWORD=root
DB_CHARSET=utf8mb4

# Database Connection Pool Configuration
DB_MAX_CONNECTIONS=10
DB_MIN_CONNECTIONS=2
DB_CONNECTION_TIMEOUT=30000
DB_IDLE_TIMEOUT=300000
DB_HEALTH_CHECK_INTERVAL=60000
DB_MAX_RETRIES=3

# Cache Configuration (Garnet)
CACHE_ENABLED=true
CACHE_HOST=hlstatsnext-garnet
CACHE_PORT=6379
CACHE_PASSWORD=
CACHE_KEY_PREFIX=hlstats:
CACHE_DEFAULT_TTL=3600
CACHE_RETRY_DELAY=100
CACHE_MAX_RETRIES=3

# Garnet Configuration
GARNET_MEMORY=1g
GARNET_PORT=6379

# RabbitMQ Configuration
RABBITMQ_USER=hlstats
RABBITMQ_PASSWORD=hlstats
RABBITMQ_VHOST=hlstats

# Grafana Configuration (optional)
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
```

### Database Package (`packages/database/.env`)

Prisma database connection and MaxMind credentials.

```bash
# Prisma Database URL
# Format: mysql://username:password@host:port/database
DATABASE_URL="mysql://hlstatsnext:changeme@localhost:3306/hlstatsnext"

# MaxMind GeoLite2 Credentials (required for GeoIP features)
# Register at: https://www.maxmind.com/en/geolite2/signup
MAXMIND_ACCOUNT_ID=your_account_id
MAXMIND_LICENSE_KEY=your_license_key
```

### Crypto Package (`packages/crypto/.env`)

Shared encryption key for RCON passwords and sensitive data.

```bash
# Base64-encoded 32-byte encryption key
# Generate with: openssl rand -base64 32
# IMPORTANT: Use single quotes to preserve special characters
ENCRYPTION_KEY='your_base64_key_here'
```

### Daemon App (`apps/daemon/.env`)

Statistics daemon configuration.

```bash
NODE_ENV=development

# Encryption key (same as crypto package)
ENCRYPTION_KEY='your_base64_key_here'

# Logging
LOG_LEVEL=info  # Options: error, warn, info, debug

# UDP Ingress - receives game server logs
INGRESS_PORT=27500

# RabbitMQ Connection
RABBITMQ_URL=amqp://hlstats:hlstats@localhost:5672/hlstats
RABBITMQ_USER=hlstats
RABBITMQ_PASSWORD=hlstats
RABBITMQ_VHOST=hlstats

# RCON Configuration
RCON_ENABLED=true
RCON_TIMEOUT=5000
RCON_MAX_RETRIES=3
RCON_STATUS_INTERVAL=30000

# Server Activity Detection
RCON_ACTIVE_SERVER_MAX_AGE_MINUTES=60

# Retry & Backoff
RCON_MAX_CONSECUTIVE_FAILURES=10
RCON_BACKOFF_MULTIPLIER=2
RCON_MAX_BACKOFF_MINUTES=30
RCON_DORMANT_RETRY_MINUTES=60

# Database Connection Pool
DB_MAX_CONNECTIONS=10
DB_MIN_CONNECTIONS=2
DB_CONNECTION_TIMEOUT=30000
DB_IDLE_TIMEOUT=300000
DB_HEALTH_CHECK_INTERVAL=60000
DB_MAX_RETRIES=3

# Cache (Garnet/Redis)
CACHE_ENABLED=true
CACHE_HOST=localhost
CACHE_PORT=6379
CACHE_PASSWORD=
CACHE_KEY_PREFIX=hlstats:
CACHE_DEFAULT_TTL=3600
CACHE_RETRY_DELAY=100
CACHE_MAX_RETRIES=3
```

### API App (`apps/api/.env`)

GraphQL API server configuration.

```bash
# Server
PORT=4000
NODE_ENV=development

# CORS - Frontend URL
FRONTEND_URL='http://localhost:3000'

# Encryption key (same as crypto package)
ENCRYPTION_KEY='your_base64_key_here'

# JWT (future authentication)
# JWT_SECRET="your-super-secret-jwt-key"
# JWT_EXPIRES_IN="7d"
```

### Web App (`apps/web/.env`)

Next.js frontend configuration.

```bash
NODE_ENV=development

# Application name displayed in UI
NEXT_PUBLIC_APP_NAME="HLStatsNext"

# GraphQL endpoint
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
```

> **Note:** The web app doesn't need `ENCRYPTION_KEY` — encryption is handled server-side by the API and daemon.

### Generating an Encryption Key

The encryption key must be a base64-encoded 32-byte value, shared across crypto, daemon, and api apps:

```bash
# Generate a secure key
openssl rand -base64 32

# Example output: 73QPGNk0Wx8Ruy5YeDe8dKaZm+YG0mOv/HvVxWpBj5s=
```

**Important:** Always wrap the key in single quotes in your `.env` files to preserve special characters:

```bash
ENCRYPTION_KEY='73QPGNk0Wx8Ruy5YeDe8dKaZm+YG0mOv/HvVxWpBj5s='
```

---

## Docker Services

### Starting Services

```bash
# Start all services
docker compose up -d

# Or use Make shortcuts
make up

# Check status
make status
docker compose ps
```

### Available Services

| Service        | Container              | Port(s)     | Description                               |
| -------------- | ---------------------- | ----------- | ----------------------------------------- |
| **db**         | hlstatsnext-db         | 3306        | MySQL 8.4 database                        |
| **rabbitmq**   | hlstatsnext-rabbitmq   | 5672, 15672 | Message queue + management UI             |
| **garnet**     | hlstatsnext-garnet     | 6379        | Redis-compatible cache (Microsoft Garnet) |
| **prometheus** | hlstatsnext-prometheus | 9090        | Metrics collection                        |
| **grafana**    | hlstatsnext-grafana    | 3001        | Metrics visualization                     |

### Make Commands

```bash
make              # Restart all containers (down + up)
make up           # Start containers
make down         # Stop containers
make logs         # View all logs
make status       # Container status
make build        # Build with no cache
make clean        # Remove stopped containers
make prune        # Remove all unused resources (caution!)

# Database
make db-logs      # View database logs
make db-shell     # Access database shell
make db-backup    # Create backup to ./backups/

# Daemon (when containerized)
make daemon-logs
make daemon-shell
make daemon-restart
```

### Network Configuration

All services communicate on the `hlstatsnext-network` bridge network. When running the daemon in Docker, it uses a static IP for game server log forwarding.

---

## Database Setup

### Initial Setup

```bash
# 1. Generate Prisma client (required after schema changes)
pnpm db:generate

# 2. Push schema to database (creates tables)
pnpm db:push

# 3. Seed initial data (games, weapons, actions, etc.)
pnpm db:seed

# 4. (Optional) Seed GeoIP data
pnpm db:seed:geo
```

### Database Commands

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

### Database Schema

The database includes tables for:

- **Core:** Games, Players, Clans, Servers, Weapons, Actions
- **Events:** Frags, Suicides, Chat, Connections, Team changes, etc.
- **GeoIP:** Location data for player geolocation
- **Config:** Game defaults, server settings, options

### Accessing the Database

```bash
# Via Docker
docker exec -it hlstatsnext-db mysql -u hlstatsnext -pchangeme hlstatsnext

# Via Prisma Studio (visual editor)
pnpm db:studio
```

---

## GeoIP Setup (MaxMind)

GeoIP data enables player location features (country flags, maps, etc.).

### 1. Create MaxMind Account

1. Register at [MaxMind GeoLite2 Signup](https://www.maxmind.com/en/geolite2/signup)
2. Verify your email and log in
3. Go to **Account** → **Manage License Keys**
4. Generate a new license key

### 2. Configure Credentials

Edit `packages/database/.env`:

```bash
MAXMIND_ACCOUNT_ID=123456
MAXMIND_LICENSE_KEY=your_license_key_here
```

### 3. Download and Seed GeoIP Data

```bash
# Initial download and seed
pnpm db:seed:geo

# Force update (re-download latest data)
pnpm db:geo:update force
```

The seeding process will:

1. Download GeoLite2-City-CSV from MaxMind
2. Cache the archive in `packages/database/data/geoip/`
3. Extract and parse CSV files
4. Populate `geo_lite_city_location` and `geo_lite_city_block` tables
5. Convert CIDR ranges to IP number ranges for efficient lookups

### GeoIP Data Structure

| Table                    | Records | Description                             |
| ------------------------ | ------- | --------------------------------------- |
| `geo_lite_city_location` | ~500K   | Countries, regions, cities, coordinates |
| `geo_lite_city_block`    | ~3.5M   | IPv4 ranges mapped to locations         |

---

## Running the Application

### Development Mode

Starts all apps with hot-reload:

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

### Production Build

```bash
# Build all apps
pnpm build

# Start production servers
cd apps/api && pnpm start
cd apps/web && pnpm start
cd apps/daemon && pnpm start
```

---

## Development Workflow

### Common Commands

```bash
# Install dependencies
pnpm install

# Development (all apps)
pnpm dev

# Build all packages and apps
pnpm build

# Run tests
pnpm test
pnpm test:coverage

# Linting
pnpm lint

# Type checking
pnpm check-types

# Format code
pnpm format:fix

# Generate GraphQL types (API must be running)
pnpm codegen
```

### Adding UI Components

The project uses shadcn/ui for components:

```bash
# Add a component
pnpm ui add button
pnpm ui add card
pnpm ui add dialog

# Or from the ui package
cd packages/ui && pnpm ui add [component]
```

### Database Workflow

After schema changes in `packages/database/prisma/schema.prisma`:

```bash
# Regenerate Prisma client
pnpm db:generate

# Push changes to database
pnpm db:push

# (Production) Create migration
pnpm db:migrate
```

### GraphQL Workflow

After API schema changes:

```bash
# Start the API server
cd apps/api && pnpm dev

# In another terminal, regenerate types
pnpm codegen
```

---

## Game Server Configuration

### Connecting Game Servers

Game servers send log data to the daemon via UDP. Configure your game server to forward logs:

**Source Engine (CS:S, TF2, etc.):**

```
// server.cfg
logaddress_add <daemon_ip>:27500
log on
sv_logecho 0
sv_logfile 1
sv_log_onefile 0
```

**GoldSrc Engine (CS 1.6, etc.):**

```
// server.cfg
logaddress_add <daemon_ip> 27500
log on
```

### Adding Servers to Database

Servers are auto-discovered when they send their first log line, or can be added manually via the database/API.

### Docker Game Servers (Optional)

The project includes commented docker-compose configurations for LinuxGSM game servers:

```yaml
# Uncomment in docker-compose.yml
cstrike:
  image: gameservermanagers/gameserver:cs
  container_name: hlstatsnext-cstrike
  # ...
```

---

## Observability

### Prometheus Metrics

The daemon exposes metrics at port 9091 (when configured):

- Event processing rates
- Player counts
- Server statistics
- Queue depths

Access Prometheus UI: http://localhost:9090

### Grafana Dashboards

Pre-configured dashboards are available:

1. Access Grafana: http://localhost:3001
2. Default login: admin/admin
3. Dashboards are auto-provisioned from `docker/grafana/dashboards/`

### RabbitMQ Management

Monitor message queues:

1. Access: http://localhost:15672
2. Login: hlstats/hlstats
3. View queues, exchanges, and message rates

---

## Troubleshooting

### Database Connection Issues

```bash
# Check if MySQL is running
docker ps | grep hlstatsnext-db

# View MySQL logs
make db-logs

# Test connection
docker exec -it hlstatsnext-db mysql -u hlstatsnext -pchangeme -e "SELECT 1"
```

### Prisma Issues

```bash
# Regenerate client after schema changes
pnpm db:generate

# Reset database (warning: deletes data)
pnpm db:fresh
```

### Port Conflicts

If ports are already in use:

```bash
# Check what's using a port
lsof -i :3000
lsof -i :4000
lsof -i :27500

# Kill process
kill -9 <PID>
```

### Cache Issues (Garnet)

```bash
# Check Garnet status
docker logs hlstatsnext-garnet

# Disable cache temporarily
# Set CACHE_ENABLED=false in .env
```

### GeoIP Seeding Fails

1. Verify MaxMind credentials in `packages/database/.env`
2. Check network connectivity to MaxMind servers
3. Ensure sufficient disk space for CSV extraction
4. Try forcing a fresh download: `pnpm db:geo:update force`

### Node Version Issues

```bash
# Check version
node --version

# Use nvm to install correct version
nvm install 24
nvm use 24
```

### pnpm Version Issues

```bash
# Enable Corepack to auto-use pinned version
corepack enable

# Or install pnpm 10.x manually
npm install -g pnpm@latest
```

### Clean Slate

When all else fails:

```bash
# Stop everything
docker compose down -v

# Clean Node artifacts
pnpm clean
rm -rf node_modules

# Clean Docker
docker system prune -a

# Start fresh
pnpm install
docker compose up -d
pnpm db:generate
pnpm db:push
pnpm db:seed
```

---

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server)
- [Turborepo](https://turbo.build/repo/docs)
- [MaxMind GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data)

---

## License

TBD
