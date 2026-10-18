# Per-token default RCON address and host-run dev daemon

**Status:** implemented 2026-10-18, pending commit
**Problem:** the beacon handshake learns a server's address from the UDP source of its first beacon. Behind any NAT (Docker Desktop in dev, NAT'd fleets in production) that address is the gateway, so auto-registration saves an unusable `address` and RCON cannot connect until an admin edits the server and sets `rcon_address`. Onboarding a fleet was therefore never zero-touch.

## Design

- A token represents a host. `server_tokens.rcon_address` holds the host (IP or DNS name) the daemon should dial for every server registered with that token.
- On auto-registration the daemon copies it into `servers.rcon_address` and `servers.public_address`, and uses it in the default server name. `servers.address` keeps the learned source for diagnostics and is still never overwritten.
- `RconRepository` already prefers `rcon_address` over `address`, so no RCON-side change is needed.
- Beacon-carried addresses were rejected: a leaked token could then redirect the daemon's RCON dial, and with it the RCON password, to an attacker-controlled host.
- The dev daemon runs on the host via `pnpm dev`. Docker Desktop's port proxy rewrites UDP sources to the bridge gateway and re-sources ports, and its "host networking" option does not preserve the client address either. See `docs/NETWORKING.md`.

## Phases

### 1. Schema and daemon

- [x] `ServerToken.rconAddress` (`rcon_address`, varchar 255, default `""`), applied with `prisma db push`
- [x] `ServerTokenEntity.rconAddress` mapped in `PrismaTokenRepository`
- [x] `findOrRegisterServer` seeds `rconAddress`, `publicAddress` and the display name from the token default
- [x] Unit tests: seeding, existing create payload

### 2. Shared-IP diagnostics and limits

- [x] Beacon failures are rate limited per UDP endpoint (`ip:port`, 10/min) with a per-IP ceiling (100/min across ports) so one misconfigured server, or a token rotation on a large host, cannot block its siblings
- [x] "Unauthenticated log packet" warning keyed per endpoint so each server gets its own line
- [x] Unit tests: sibling unaffected, per-address ceiling

### 3. API and web

- [x] `CreateServerTokenInput.rconAddress`, validated (hostname or IP characters, ≤255), persisted by `ServerTokenService.createToken`
- [x] `rconAddress` exposed on `ServerToken` and `SafeServerToken`
- [x] Token create form field, server action validation, list column, GraphQL selections
- [x] `pnpm db:generate`, `pnpm codegen`, `pnpm check-types`

### 4. Dev workflow

- [x] `apps/daemon` gets a `dev` script so `pnpm dev` starts it with hot reload
- [x] Compose `daemon` service moved behind the `daemon` profile, `UDP_PORT` corrected to `INGRESS_PORT`, `docker:daemon:up|down` scripts added
- [x] `docs/NETWORKING.md` rewritten around the token model and the Docker Desktop caveat

## Deferred

- **Hold-and-replay for re-sourced endpoints.** Log lines from an unknown `ip:port` are dropped until that endpoint beacons. A bounded per-endpoint buffer (small cap, TTL of one beacon interval) that is replayed when the matching beacon authenticates would make NAT port churn lossless instead of losing up to 60 s of events. Lines stay unprocessed until the source proves itself, so it adds no trust. Pair it with a plugin beacon on `client_connect` so the first events after idle never wait for the timer.
- **Edit the token default after creation** (update mutation and form), and an optional backfill of `rcon_address` for servers registered before the default existed.
- **Token rotation UX.** A revoked token's servers keep failing once a minute until reconfigured; surface them in the admin UI instead of only in daemon logs.
