# HLStatsNext

HLStatsNext is a modern rewrite of HLstatsX Community Edition, building upon its
foundation as a real-time stats and ranking system for Half Life engine
based games. While the original HLstatsX:CE used dated PHP for frontend & backend,
HLStatsNext is being completely refactored using Turbo Monorepo with Next.js for
frontend and, Yoga GraphQL for backend. This project aims to modernize and
enhance the proven concepts of HLstatsX:CE.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development](#development)
- [Docker Management](#docker-management)
  - [Quick Start with Docker](#quick-start-with-docker)
  - [Main Docker Commands](#main-docker-commands)
  - [Docker Services Overview](#docker-services-overview)
  - [Network Configuration](#network-configuration)
  - [Environment Variables](#environment-variables)
  - [Service Details](#service-details)
  - [Game Server Management](#game-server-management)
  - [Database Management](#database-management)
  - [Daemon Management](#daemon-management)
  - [Utility Commands](#utility-commands)
  - [Volumes and Data Persistence](#volumes-and-data-persistence)
- [Project Structure](#project-structure)
- [Adding Your Own Game Servers](#adding-your-own-game-servers)
- [Port Reference](#port-reference)
- [Features](#features)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Docker & Docker Compose (for containerized development)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/jstnmthw/hlstatsnext.com.git
cd hlstatsnext.com
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up your environment variables:

```bash
cp .env.example .env
```

4. Start development server:

```bash
pnpm dev
```

## Development

This project uses [Turborepo](https://turbo.build/) to manage the monorepo workspace. Here are the main commands you'll use:

```bash
# Start the development server
pnpm dev

# Build all apps and packages
pnpm build

# Run linting across all apps and packages
pnpm lint

# Run tests across all apps and packages
pnpm test
```

## Docker Management

For containerized development, this project includes a comprehensive Makefile for easy Docker management. The setup includes game servers, database, and the HLStatsNext daemon.

### Quick Start with Docker

```bash
# Start all containers (default command)
make

# Or explicitly restart all containers
make restart

# Start containers without restarting
make up

# Stop all containers
make down

# View all available commands
make help
```

### Main Docker Commands

| Command        | Description                             |
| -------------- | --------------------------------------- |
| `make`         | Default: brings containers down then up |
| `make restart` | Same as default (down + up)             |
| `make up`      | Start all containers                    |
| `make down`    | Stop all containers                     |
| `make build`   | Build containers with no cache          |
| `make logs`    | Show logs for all containers            |
| `make status`  | Show status of all containers           |

### Docker Services Overview

The Docker Compose setup includes four main services:

| Service | Container Name     | Description                       | Ports         |
| ------- | ------------------ | --------------------------------- | ------------- |
| daemon  | hlstatsnext-daemon | HLStatsNext statistics daemon     | 27500/udp     |
| db      | hlstatsnext-db     | MySQL 5.7 database server         | 3306          |
| cs1     | hlstatsnext-cs-1   | Counter-Strike server 1 (example) | 27015/tcp+udp |
| cs2     | hlstatsnext-cs-2   | Counter-Strike server 2 (example) | 27016/tcp+udp |

### Network Configuration

All services run on a custom bridge network with the following configuration:

- **Network Name**: `hlstatsnext-network`
- **Subnet**: `10.5.0.0/16`
- **Gateway**: `10.5.0.1`
- **Daemon IP**: `10.5.0.50` (static)

### Environment Variables

The following environment variables can be configured in your `.env` file:

#### Database Configuration

```bash
DB_HOST=db:3306                   # Database host (default: db:3306)
DB_NAME=hlstatsnext               # Database name (default: hlstatsnext)
DB_USER=hlstatsnext               # Database user (default: hlstatsnext)
DB_PASS=hlstatsnext               # Database password (default: hlstatsnext)
DB_ROOT_PASSWORD=root             # MySQL root password (default: root)
```

#### Game Server Configuration

```bash
USER_ID=1000                      # User ID for game servers (default: 1000)
GROUP_ID=1000                     # Group ID for game servers (default: 1000)
```

### Service Details

#### HLStatsNext Daemon

The daemon service processes game events and updates statistics in real-time.

- **Container**: `hlstatsnext-daemon`
- **Build**: Custom Dockerfile at `docker/daemon/Dockerfile`
- **Port**: `27500/udp`
- **Dependencies**: MySQL database
- **Features**:
  - Real-time game event processing
  - Database integration
  - Debug mode enabled
  - DNS resolution disabled for performance

#### MySQL Database

The database service stores all game statistics and player data.

- **Container**: `hlstatsnext-db`
- **Image**: `mysql:5.7`
- **Port**: `3306`
- **Features**:
  - Persistent data storage via Docker volumes
  - Automatic database initialization
  - Health checks for reliability
  - Custom MySQL configuration

#### Game Servers (CS1 & CS2)

Example Counter-Strike servers managed via LinuxGSM.

- **CS1 Container**: `hlstatsnext-cs-1` (Port: 27015)
- **CS2 Container**: `hlstatsnext-cs-2` (Port: 27016)
- **Image**: `gameservermanagers/gameserver:cs`
- **Features**:
  - LinuxGSM integration
  - Persistent server data
  - Configurable user/group IDs
  - Both TCP and UDP support

### Game Server Management

The Docker setup includes example Counter-Strike servers (`cs1` and `cs2`) that demonstrate how to integrate game servers with HLStatsNext. You can add additional game servers by extending the `docker-compose.yml` configuration.

**Example CS1 Server Commands:**

```bash
make cs1-restart        # Restart CS1 server (linuxgsm csserver restart)
make cs1-details        # Show CS1 server details (linuxgsm csserver details)
make cs1-start          # Start CS1 server (linuxgsm csserver start)
make cs1-stop           # Stop CS1 server (linuxgsm csserver stop)
make cs1-logs           # Show CS1 container logs
make cs1-shell          # Access CS1 container shell
```

**Example CS2 Server Commands:**

```bash
make cs2-restart        # Restart CS2 server (linuxgsm csserver restart)
make cs2-details        # Show CS2 server details (linuxgsm csserver details)
make cs2-start          # Start CS2 server (linuxgsm csserver start)
make cs2-stop           # Stop CS2 server (linuxgsm csserver stop)
make cs2-logs           # Show CS2 container logs
make cs2-shell          # Access CS2 container shell
```

> **Note**: `cs1` and `cs2` are example server configurations. To add your own game servers:
>
> 1. Add a new service to `docker-compose.yml` following the same pattern
> 2. Create a corresponding directory in `./servers/` for server data
> 3. Add equivalent Makefile targets for your new server
> 4. Update the port mappings to avoid conflicts

### Database Management

```bash
make db-reset           # Restart the database server
make db-logs            # Show database container logs
make db-shell           # Access database container shell
make db-backup          # Create database backup
```

#### Database Features

- **Automatic initialization** from `packages/database/src/sql/install.sql`
- **Custom MySQL configuration** via `docker/mysql/my.cnf`
- **Health checks** to ensure database availability
- **Persistent storage** using Docker volumes

### Daemon Management

```bash
make daemon-restart     # Restart the daemon container
make daemon-logs        # Show daemon container logs
make daemon-shell       # Access daemon container shell
```

#### Daemon Features

- **Real-time statistics processing** from game servers
- **Configurable database connection** via environment variables
- **UDP listener** on port 27500 for game events
- **Debug mode** for development and troubleshooting

### Utility Commands

```bash
make clean              # Remove stopped containers and unused images
make prune              # Remove all unused Docker resources
make help               # Show all available commands
```

### Volumes and Data Persistence

| Volume        | Mount Point    | Description                  |
| ------------- | -------------- | ---------------------------- |
| db-volume     | /var/lib/mysql | MySQL database data          |
| ./servers/cs1 | /data          | CS1 server files and configs |
| ./servers/cs2 | /data          | CS2 server files and configs |

## Project Structure

```
.
├── apps/
│   ├── api/            # Node.js GraphQL Yoga API
│   ├── daemon/         # Pearl daemon for game server monitoring
│   └── web/            # Next.js frontend application
├── packages/
│   ├── ui/             # Shared UI components
│   ├── config/         # Shared configuration
│   └── database/       # Database schemas, sql and utilities
├── servers/
│   ├── cs1/            # Example Counter-Strike server 1 data
│   └── cs2/            # Example Counter-Strike server 2 data
├── docker/             # Docker configuration files
│   ├── daemon/         # Daemon Dockerfile and configs
│   └── mysql/          # MySQL configuration files
├── docker-compose.yml  # Docker Compose configuration
└── Makefile            # Docker management commands
```

## Adding Your Own Game Servers

To add additional game servers to your HLStatsNext setup:

1. **Update docker-compose.yml**: Add a new service following the existing `cs1`/`cs2` pattern
2. **Create server directory**: Make a new directory in `./servers/your-server-name`
3. **Update Makefile**: Add corresponding make targets for your server
4. **Configure ports**: Ensure unique port mappings for each server
5. **Environment variables**: Update your `.env` file if needed

Example for adding a third server:

```yaml
cs3:
  image: gameservermanagers/gameserver:cs
  container_name: hlstatsnext-cs-3
  networks:
    - default
  environment:
    - UID=${USER_ID:-1000}
    - GID=${GROUP_ID:-1000}
    - GAME=cs
    - LGSM_GAMESERVER=csserver
  volumes:
    - ./servers/cs3:/data
  ports:
    - "27017:27015/udp"
    - "27017:27015/tcp"
  restart: unless-stopped
```

Then add corresponding Makefile targets:

```makefile
cs3-restart:
    @docker exec -u linuxgsm hlstatsnext-cs-3 ./csserver restart

cs3-details:
    @docker exec -u linuxgsm hlstatsnext-cs-3 ./csserver details
```

## Port Reference

| Service | Host Port | Container Port | Protocol | Description             |
| ------- | --------- | -------------- | -------- | ----------------------- |
| daemon  | 27500     | 27500          | UDP      | HLStatsNext daemon      |
| db      | 3306      | 3306           | TCP      | MySQL database          |
| cs1     | 27015     | 27015          | TCP/UDP  | Counter-Strike server 1 |
| cs2     | 27016     | 27015          | TCP/UDP  | Counter-Strike server 2 |

> **Note**: When adding new servers, increment the host port to avoid conflicts (e.g., 27017, 27018, etc.)

## Features

- Modern, responsive web interface built with Next.js
- Real-time game statistics and rankings
- GraphQL API for flexible data querying
- Efficient game server monitoring daemon
- Customizable player and server statistics
- Containerized development environment with Docker
- Easy server management through LinuxGSM integration
- Scalable multi-server support
- Persistent data storage with Docker volumes
- Custom network configuration for service isolation
- Health checks and automatic restarts for reliability

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

- TBD

## Acknowledgments

- Original HLstatsX:CE project and contributors
- The Source engine gaming community
