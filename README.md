# HLStatsNext

HLStatsNext is a modern rewrite of HLstatsX Community Edition, building upon
its foundation as a real-time stats and ranking system for Source engine
based games. While the original HLstatsX:CE used a Perl daemon and PHP frontend,
HLStatsNext is being completely refactored with Next.js (Turbo), Node.js for GraphQL. This
project aims to modernize and enhance the proven concepts of HLstatsX:CE.

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

### Game Server Management

The Docker setup includes example Counter-Strike servers (`cs1` and `cs2`) that demonstrate how to integrate game servers with HLStatsNext. You can add additional game servers by extending the `docker-compose.yml` configuration.

**Example CS1 Server Commands:**

```bash
make cs1:restart        # Restart CS1 server (linuxgsm csserver restart)
make cs1:details        # Show CS1 server details (linuxgsm csserver details)
make cs1:start          # Start CS1 server (linuxgsm csserver start)
make cs1:stop           # Stop CS1 server (linuxgsm csserver stop)
make cs1:logs           # Show CS1 container logs
make cs1:shell          # Access CS1 container shell
```

**Example CS2 Server Commands:**

```bash
make cs2:restart        # Restart CS2 server (linuxgsm csserver restart)
make cs2:details        # Show CS2 server details (linuxgsm csserver details)
make cs2:start          # Start CS2 server (linuxgsm csserver start)
make cs2:stop           # Stop CS2 server (linuxgsm csserver stop)
make cs2:logs           # Show CS2 container logs
make cs2:shell          # Access CS2 container shell
```

> **Note**: `cs1` and `cs2` are example server configurations. To add your own game servers:
>
> 1. Add a new service to `docker-compose.yml` following the same pattern
> 2. Create a corresponding directory in `./servers/` for server data
> 3. Add equivalent Makefile targets for your new server
> 4. Update the port mappings to avoid conflicts

### Database Management

```bash
make db:reset           # Restart the database server
make db:logs            # Show database container logs
make db:shell           # Access database container shell
make db:backup          # Create database backup
```

### Daemon Management

```bash
make daemon:restart     # Restart the daemon container
make daemon:logs        # Show daemon container logs
make daemon:shell       # Access daemon container shell
```

### Utility Commands

```bash
make clean              # Remove stopped containers and unused images
make prune              # Remove all unused Docker resources
make help               # Show all available commands
```

## Project Structure

```
.
├── apps/
│   ├── web/          # Next.js frontend application
│   ├── api/          # Node.js GraphQL Yoga API
│   └── daemon/       # Pearl daemon for game server monitoring
├── packages/
│   ├── ui/           # Shared UI components
│   ├── config/       # Shared configuration
│   └── database/     # Database schemas and utilities
├── servers/
│   ├── cs1/          # Example Counter-Strike server 1 data
│   └── cs2/          # Example Counter-Strike server 2 data
├── docker/           # Docker configuration files
├── docker-compose.yml # Docker Compose configuration
└── Makefile          # Docker management commands
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
  # ... rest of configuration
```

## Features

- Modern, responsive web interface built with Next.js
- Real-time game statistics and rankings
- GraphQL API for flexible data querying
- Efficient game server monitoring daemon
- Customizable player and server statistics
- Containerized development environment with Docker
- Easy server management through LinuxGSM integration
- Scalable multi-server support

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
