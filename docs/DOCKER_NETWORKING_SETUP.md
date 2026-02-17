# Docker Networking Setup for HLStatsNext

This document explains how to configure HLStatsNext with game servers running in Docker containers alongside external servers.

## Overview

HLStatsNext supports both Docker-hosted game servers and external servers through a hybrid networking solution using static IPs for Docker containers and standard IP:port authentication for external servers.

## Problem Solved

When running game servers in Docker, the UDP source port changes on every container restart due to Docker's NAT, causing:

- Duplicate server records in the database
- Failed RCON connections (wrong port)
- Inconsistent server identification

## Solution Architecture

### 1. Static IP Assignment

All Docker services use static IPs within the custom bridge network (10.5.0.0/16):

- **Database**: 10.5.0.5
- **RabbitMQ**: 10.5.0.6
- **Daemon**: 10.5.0.10
- **CS 1.6 Server**: 10.5.0.20
- **TFC Server**: 10.5.0.21

### 2. Database Schema

Two new columns added to the `servers` table:

```sql
ALTER TABLE servers ADD COLUMN connection_type VARCHAR(8) DEFAULT 'external';
ALTER TABLE servers ADD COLUMN docker_host VARCHAR(255) DEFAULT NULL;
```

- `connection_type`: Either 'docker' or 'external'
- `docker_host`: Static IP or container hostname for Docker servers

### 3. Server Types

#### Docker Servers

- Pre-configured with `connection_type = 'docker'`
- Use `docker_host` field for RCON connections (e.g., "10.5.0.20" or "hlstatsnext-cstrike")
- RCON connects to standard game port (27015), not ephemeral UDP source port
- Identified by Docker network subnet (10.5.0.0/16)

#### External Servers

- Use `connection_type = 'external'` (default)
- Standard IP:port authentication
- RCON uses stored `address` and `port` fields

## Configuration Steps

### 1. Apply Database Migration

```bash
# Run the migration to add new columns
mysql -u root -p hlstatsnext < packages/db/migrations/001_add_docker_support.sql
```

### 2. Configure Docker Servers in Database

```sql
-- Example: Configure CS 1.6 Docker server
INSERT INTO servers (name, address, port, game, rcon_password, connection_type, docker_host)
VALUES ('CS 1.6 Docker', '172.30.160.1', 56789, 'cstrike', 'changeme123', 'docker', '10.5.0.20');

-- Example: Configure TFC Docker server
INSERT INTO servers (name, address, port, game, rcon_password, connection_type, docker_host)
VALUES ('TFC Docker', '172.30.160.1', 56789, 'tfc', 'changeme456', 'docker', '10.5.0.21');
```

### 3. Game Server Configuration

Add to your server.cfg files:

```cfg
// RCON password for remote administration
rcon_password "changeme123"

// Send logs to daemon at static IP
logaddress_add 10.5.0.10 27500
log on
mp_logdetail 3
mp_logmessages 1
```

### 4. Start Services

```bash
# Start all services with docker-compose
docker-compose up -d

# Or use the Makefile
make up
```

## How It Works

### Log Ingestion Flow

1. Game server sends UDP logs to daemon at 10.5.0.10:27500
2. Logs arrive from NAT'd address (e.g., 172.30.160.1:56789)
3. Daemon detects Docker network (10.5.0.0/16 subnet)
4. Looks up Docker server by `connection_type = 'docker'`
5. Authenticates and processes logs

### RCON Connection Flow

1. Daemon needs to send RCON command to server
2. Checks server's `connection_type`
3. For Docker servers: Uses `docker_host:27015`
4. For external servers: Uses `address:port`
5. Establishes RCON connection and executes command

## Adding New Docker Game Servers

1. Choose a static IP in the 10.5.0.0/16 range (e.g., 10.5.0.22)

2. Add to docker-compose.yml:

```yaml
newserver:
  image: gameservermanagers/gameserver:css
  container_name: hlstatsnext-css
  hostname: hlstatsnext-css
  networks:
    default:
      ipv4_address: 10.5.0.22
  environment:
    - DAEMON_HOST=10.5.0.10
    - DAEMON_PORT=27500
  ports:
    - "27017:27015/udp"
    - "27017:27015/tcp"
```

3. Configure in database:

```sql
INSERT INTO servers (name, connection_type, docker_host, rcon_password, game)
VALUES ('CSS Docker', 'docker', '10.5.0.22', 'password', 'css');
```

4. Configure server.cfg with daemon IP and RCON password

## Adding External Servers

External servers work as before:

```sql
INSERT INTO servers (name, address, port, rcon_password, game)
VALUES ('External CSS', '192.168.1.100', 27015, 'password', 'css');
```

Configure the external server to send logs to your daemon's public IP:

```cfg
logaddress_add your.public.ip 27500
```

## Troubleshooting

### RCON Connection Failures

1. Check `connection_type` is set correctly:

```sql
SELECT serverId, name, connection_type, docker_host FROM servers;
```

2. For Docker servers, verify static IP is correct:

```bash
docker inspect hlstatsnext-cstrike | grep IPAddress
```

3. Test RCON password in-game:

```
rcon_password changeme123
rcon status
```

### Duplicate Server Records

If you see duplicate servers, it's likely due to missing `connection_type` configuration:

```sql
-- Find duplicates
SELECT address, port, COUNT(*) as count
FROM servers
GROUP BY address, port
HAVING count > 1;

-- Fix by setting connection_type for Docker servers
UPDATE servers
SET connection_type = 'docker', docker_host = '10.5.0.20'
WHERE name LIKE '%Docker%';
```

### Log Ingestion Issues

1. Verify daemon is receiving logs:

```bash
docker logs hlstatsnext-daemon -f
```

2. Check game server is sending logs:

```bash
# In game console
log on
logaddress_list
```

3. Ensure static IP is configured:

```bash
docker exec hlstatsnext-cstrike cat /data/serverfiles/cstrike/server.cfg | grep logaddress
```

## Best Practices

1. **Always use static IPs** for Docker containers to ensure stable connections
2. **Document your IP assignments** to avoid conflicts
3. **Use container hostnames** as an alternative to IPs (e.g., "hlstatsnext-cstrike")
4. **Test RCON connectivity** after adding new servers
5. **Monitor logs** during initial setup to catch authentication issues
6. **Backup your database** before running migrations

## Security Considerations

1. **RCON passwords** should be strong and unique per server
2. **Network isolation** - Docker network is isolated from host by default
3. **Firewall rules** - Only expose necessary ports (27500/udp for logs)
4. **Access control** - Limit database access to daemon only
5. **Regular updates** - Keep game servers and daemon updated

## Related Documentation

- [Docker Compose Reference](../docker-compose.yml)
- [Database Schema](../packages/db/prisma/schema.prisma)
- [RCON Implementation](../apps/daemon/src/modules/rcon/)
- [Ingress Authentication](../apps/daemon/src/modules/ingress/adapters/)
