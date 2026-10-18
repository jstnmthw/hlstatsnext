# Networking: how the daemon finds your game servers

This document covers how a game server is identified, which address the daemon uses for RCON, and why the development daemon runs on the host rather than in Docker Desktop.

## Identity and addresses

The HLStatsNext AMX plugin sends an authentication beacon (`HLXTOKEN:<token>:<gamePort>`) through the engine's `logaddress_add` pipeline every 60 seconds. The daemon resolves the beacon to a server as follows.

| Field                        | Source                                               | Used for                                                   |
| ---------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| Server identity              | token id + game port from the beacon                 | Upsert key. Survives IP changes and container restarts.    |
| `servers.address`            | UDP source IP of the first beacon, never overwritten | Display only. Behind NAT this is the gateway, not the box. |
| `servers.rcon_address`       | Token default at registration, or set per server     | Host the daemon dials for RCON. Wins over `address`.       |
| `servers.public_address`     | Token default at registration, or set per server     | Host shown to players.                                     |
| `server_tokens.rcon_address` | Admin → Tokens → RCON Address, set when creating     | Copied into both server fields on auto-registration.       |

A host that runs several game servers usually has one routable address, so one token per host with its RCON address set gives zero-touch onboarding: start the server with `hlx_token` configured and the daemon registers it, dials RCON, and pulls hostname, map and player counts without an admin step. Hostnames are accepted, so a dynamic DNS name works for hosts whose public IP changes.

Servers that were registered before the token default existed keep their learned address. Fix them once under Admin → Servers → Edit → RCON Address.

## Sessions and NAT

Engine log lines carry no token. The daemon attributes them to a server through the UDP `ip:port` they arrive from, which is cached when the beacon from that endpoint authenticates. Any NAT in front of the daemon that re-sources ports breaks that mapping until the next beacon, so log lines in between are dropped as unauthenticated. The dev section below is the common case.

## Development on Docker Desktop (WSL2)

Docker Desktop's port publishing does not preserve the UDP source. A daemon container with `27500:27500/udp` sees every game server as `172.18.0.1` (the bridge gateway) with a proxy-chosen source port that changes when the mapping idles out. Observed effects:

- auto-registered servers get `address = 172.18.0.1`, so RCON dials the wrong host until `rcon_address` is set
- the `ip:port` session key churns, losing engine log lines until the next beacon
- the port forwarding goes stale after a `tsx watch` reload, so events stop arriving while RCON keeps working
- all servers share one source IP, so per-IP diagnostics and limits lump them together

Docker Desktop's "host networking" option does not fix this: the host is Desktop's utility VM, and connections still arrive from a local address. WSL2 mirrored networking on its own is fine. A daemon running directly in WSL sees the real LAN source, verified in October 2026 with a server that arrived as `192.168.0.178:27017` natively versus `172.18.0.1:<random>` through the container.

The dev stack therefore runs the daemon on the host:

```bash
pnpm docker:up     # db + rabbitmq
pnpm dev           # web, api and daemon with hot reload
```

The `daemon` service in `docker-compose.yml` sits behind the `daemon` Compose profile. Use `pnpm docker:daemon:up` and `pnpm docker:daemon:down` when you specifically want the container, and expect the limitations above.

## Production

- On Linux with Docker Engine, published ports use iptables DNAT and the source IP is preserved. Host networking also works. The daemon's learned address is correct for servers that are not themselves behind NAT.
- Set the token's RCON address anyway for hosts behind NAT, or when RCON must reach a different interface than the one the logs leave from.
- Expose `27500/udp` to game hosts only. Bind with `INGRESS_HOST` when the daemon has a dedicated interface.

## Troubleshooting

| Log line                                                   | Meaning                                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Unauthenticated log packet from A:B — no beacon received` | That endpoint sends logs but no valid beacon. `hlx_token` is missing or wrong on that server.         |
| `Source A:B blocked after repeated failures`               | Ten failed beacons in a minute from one endpoint. Other servers on the same IP are unaffected.        |
| `Address A blocked after repeated failures across ports`   | A hundred failures in a minute from one IP across ports. Treat as a flood or a mass misconfiguration. |
| RCON fails and the server's address is `172.x` or `10.x`   | Learned address is a NAT artifact. Set the token's RCON address, or the server's, and re-beacon.      |

Useful checks:

```bash
# Which address does the daemon see your server as? (host-run daemon)
grep -E "Beacon authenticated|Unauthenticated log packet" <daemon log>

# Is the game port reachable over UDP from the daemon host? (GoldSrc replies to A2S_INFO)
node -e 'const d=require("dgram").createSocket("udp4");d.on("message",(m,r)=>{console.log("reply from",r.address+":"+r.port);d.close()});d.send(Buffer.concat([Buffer.from([255,255,255,255,84]),Buffer.from("Source Engine Query\0")]),27015,"<server-ip>")'
```

## Related

- [Prisma schema](../packages/db/prisma/schema.prisma) (`Server`, `ServerToken`)
- [Token authenticator](../apps/daemon/src/modules/ingress/adapters/token-server-authenticator.ts)
- [RCON repository](../apps/daemon/src/modules/rcon/repositories/rcon.repository.ts) (address precedence)
- [AMX plugin](../plugins/amx/README.md) (`hlx_token`, beacon)
