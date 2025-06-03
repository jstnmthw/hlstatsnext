# HLStatsNext

HLStatsNext is a modern rewrite of HLstatsX Community Edition, building upon
its foundation as a real-time stats and ranking system for Source engine
based games. While the original HLstatsX:CE used a Perl daemon and PHP frontend,
HLStatsNext is being completely refactored with Next.js (Turbo), Node.js for GraphQL. This
project aims to modernize and enhance the proven concepts of HLstatsX:CE.

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

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
```

## Features

- Modern, responsive web interface built with Next.js
- Real-time game statistics and rankings
- GraphQL API for flexible data querying
- Efficient game server monitoring daemon
- Customizable player and server statistics

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
