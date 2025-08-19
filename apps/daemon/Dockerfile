FROM node:24-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

EXPOSE 27500/udp
EXPOSE 3001

# Everything will be mounted from host
# Set working directory to daemon app
WORKDIR /app/apps/daemon

CMD ["pnpm", "start"]