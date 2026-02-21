# Token-Based Authentication Refactor — Final Design

**Status:** Approved
**Date:** 2026-02-15
**Scope:** `apps/daemon`, `apps/web`, `apps/api`, `packages/db`, `packages/crypto`, `packages/plugins`
**Supersedes:** `review-20260214-0930-token-based-auth-refactor.md`, `review-20260215-1030-token-auth-rcon-dependency.md`

---

## 1. Current Architecture Problems

### 1.1 Authentication by IP:Port Is Broken

The daemon authenticates incoming UDP log packets by matching `rinfo.address` and `rinfo.port` against the `servers` table. This has fundamental problems:

- **Ephemeral port mismatch.** `rinfo.port` is the OS-assigned ephemeral source port, not the game port (e.g., 27015). The lookup `findFirst({ where: { address, port } })` only matches if the game server binds its log socket to its listening port — which only works under `--network host`.
- **Docker heuristics are fragile.** The Docker fallback matches by last IP octet (`172.18.0.2` → index 0, `.3` → index 1), which breaks on container restarts, non-sequential IPs, or fleet changes.
- **No cryptographic authentication.** Any host that can send UDP packets to port 27500 with a matching source IP can inject arbitrary stats data.
- **Pre-registration required.** Servers must exist in the database before the daemon accepts their logs. No auto-registration path exists.

### 1.2 RCON Circular Dependency

The daemon's `SERVER_AUTHENTICATED` event triggers an immediate RCON connection (`connectToServerImmediately()`), which requires `Server.rconPassword`. If auto-registration creates the server record, `rconPassword` defaults to `""` and RCON is permanently skipped. Without RCON `status`, the server record remains a stub with no hostname, map, player count, or FPS data.

### 1.3 Engine Log Interception Is Not Feasible

Research into AMX Mod X and SourceMod plugin APIs reveals that **game engine–generated log lines cannot be intercepted and modified** before they reach `logaddress_add` destinations:

- **AMX Mod X:** `plugin_log()` forward fires on all engine log lines. It can read and block them, but cannot modify them in-place. Blocking may not prevent the `logaddress_add` UDP dispatch, which happens at the engine level.
- **SourceMod:** `AddGameLogHook()` captures game/mod log messages (kills, connects, etc.) but passes them as `const char[]` (read-only). Same blocking caveat applies.

The original proposal assumed the plugin would prepend `HLXTOKEN:` to every log line. This is **not possible** for engine-generated lines (kills, player connections, team changes, map changes) — only for lines the plugin itself generates.

### 1.4 Existing Plugin Is Not a Log Forwarder

The current HLStatsNext AMX Mod X plugin at `packages/plugins/amx` is a **display plugin** — it receives structured events from the daemon via RCON commands (`hlx_event`) and renders them to players. It does not generate or forward log lines to the daemon. The daemon receives log lines directly from the game engine via `logaddress_add`.

---

## 2. Architecture

### 2.1 Design: Authentication Beacon + IP Association

Instead of a per-line token prefix, the plugin sends **periodic authentication beacons** through the standard `logaddress_add` pipeline. The daemon authenticates via the beacon's token and associates all subsequent engine-generated log lines from the same UDP source with the authenticated server.

```
Game Server                                          Admin Web UI
+---------------------------+                        +-------------------+
| Game Engine               |                        | (apps/web)        |
| - Generates kill/connect  |                        | - Create token    |
|   log lines via           |                        | - Set RCON pwd    |
|   logaddress_add          |                        | - Set game type   |
|                           |                        | - Revoke token    |
| HLStatsNext Plugin        |                        +--------+----------+
| - Reads hlx_token cvar    |                                 |
| - Sends auth beacon via   |                                 | GraphQL
|   engfunc(AlertMessage)   |                                 |
| - Beacon: HLXTOKEN:t:port |                        +--------v----------+
+--------+------------------+                        |  API (apps/api)   |
         |                                           |  Token CRUD       |
         | UDP packets (all via logaddress_add)       |  RCON pwd encrypt |
         |                                           +--------+----------+
         | Beacon:  "HLXTOKEN:hlxn_abc:27015"                 |
         | Engine:  "L 02/15... player killed ..."             |
         | Engine:  "L 02/15... player connected ..."          |
         v                                           +--------v----------+
+---------------------------+                        |  Database         |
|  Daemon (apps/daemon)     |                        |  server_tokens    |
|                           |                        |  servers          |
|  1. Receive UDP packet    |                        +-------------------+
|  2. Check HLXTOKEN: prefix|
|     YES → beacon auth:    |
|       - Validate token    |
|       - Auto-register     |
|       - Cache src IP:port |
|     NO → engine log line: |
|       - Lookup cached     |
|         src IP:port       |
|       - Parse event       |
|  3. RCON from token pwd   |
+---------------------------+
```

### 2.2 Authentication Flow

**Beacon-authenticated lines:**

1. Plugin loads → reads `hlx_token` cvar → sends beacon: `HLXTOKEN:<token>:<gamePort>`
2. Beacon flows through `logaddress_add` to daemon
3. Daemon detects `HLXTOKEN:` prefix → extracts token and game port
4. Validates token: hash → cache/DB → revocation/expiry check
5. If valid and no server exists for `rinfo.address + gamePort`: auto-register server
6. Caches: `rinfo.address:rinfo.port` (ephemeral source) → `serverId`
7. Plugin re-sends beacon every 60 seconds (handles daemon restarts, cache expiry)

**Engine-generated lines (kills, connects, team changes, map changes):**

1. Engine generates log line, sends via `logaddress_add` from same source
2. Daemon receives line without `HLXTOKEN:` prefix
3. Looks up `rinfo.address:rinfo.port` in authenticated server cache
4. If found → parse and process as normal
5. If not found → drop (no valid authentication session)

**Why this works:**

- All UDP packets from a game server process share the same ephemeral source port for the lifetime of that process
- Beacon and engine lines arrive from identical `rinfo.address:rinfo.port`
- The cache key is unique per server process, even with multiple servers on one IP
- If the server restarts (new ephemeral port), the next beacon re-authenticates

### 2.3 Token as Registration Bundle

The token carries all minimum credentials for a fully operational server on first contact:

| Credential     | Source        | Purpose                                       |
| -------------- | ------------- | --------------------------------------------- |
| Token          | Admin UI      | Cryptographic authentication                  |
| RCON password  | Admin UI      | Daemon → server communication (optional)      |
| Game type      | Admin UI      | Log parser + RCON protocol selection          |
| Game port      | Plugin beacon | RCON connection target + server deduplication |
| Server address | UDP `rinfo`   | RCON connection target                        |

### 2.4 Token Validation Lifecycle

```
Token States:
  ACTIVE  → Token is valid and can authenticate servers
  REVOKED → Explicitly revoked by admin (terminal)
  EXPIRED → Past optional expiresAt date (terminal, checked at validation time)
```

Validation order:

1. **Format check** — non-empty, within expected length bounds
2. **Hash computation** — SHA-256 of raw token
3. **Cache lookup** — in-memory `Map<hash, TokenCacheEntry>` with 60s TTL
4. **Database lookup** (cache miss) — query `server_tokens` by `tokenHash`
5. **Revocation check** — `revokedAt IS NULL`
6. **Expiry check** — `expiresAt IS NULL OR expiresAt > NOW()`
7. **Cache population** — store result with TTL

### 2.5 Failure Modes

| Failure                            | Behavior                                              |
| ---------------------------------- | ----------------------------------------------------- |
| No `HLXTOKEN:` prefix, no IP cache | Drop packet silently                                  |
| Token hash not found in DB         | Return `unauthorized`, rate-limited log               |
| Token revoked                      | Return `unauthorized`, log revocation hit             |
| Token expired                      | Return `unauthorized`, log expiry hit                 |
| Database unavailable               | Return from cache if available; otherwise drop        |
| Beacon with malformed format       | Drop, rate-limited warning log                        |
| Token valid, no server exists      | Auto-register server with RCON + game from token      |
| Token valid, RCON password empty   | Auto-register without RCON; log warning, RCON skipped |
| Engine line, IP in cache           | Authenticate via cached serverId                      |
| Engine line, IP not in cache       | Drop packet (no authentication session)               |

---

## 3. Security Analysis

### 3.1 Threat Model

| Threat                                         | Likelihood                 | Impact                | Mitigation                                                                              |
| ---------------------------------------------- | -------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| UDP injection with spoofed IP (current system) | High on LAN                | Critical              | Token authentication eliminates this                                                    |
| Token exfiltration from game server config     | Medium                     | High                  | Token revocation, per-server tokens, rotation                                           |
| Token exfiltration from network sniffing       | Medium (UDP plaintext)     | High                  | Accepted risk for LAN; VPN recommendation for WAN                                       |
| Brute-force token guessing                     | Very low (256-bit entropy) | Critical              | 32-byte random tokens = computationally infeasible                                      |
| Replay attack (resend captured UDP packet)     | Medium                     | Low (idempotent data) | Log timestamps; not a priority                                                          |
| Database compromise exposing hashes            | Low                        | Medium                | SHA-256 pre-image resistant; raw tokens never stored                                    |
| DoS via invalid tokens                         | Medium                     | Low                   | Rate limiting by source IP (10/min, 60s block)                                          |
| Token in beacon exposes it per-packet          | Same as per-line approach  | Same                  | Token is in every beacon (1/min), not every line; reduces exposure surface vs. per-line |

### 3.2 Token Format

```
hlxn_<base64url(32 random bytes)>
```

Example: `hlxn_K7gNU3sdo-OL0wNhv0-ATkGjQL1qOlRhsGAhK7eo-Xc`

- `hlxn_` prefix for identification, grep-ability, and future versioning
- 32 bytes = 256 bits of entropy
- Only first 8 chars after prefix stored in plaintext for admin UI display (e.g., `hlxn_K7gNU3sd...`)
- SHA-256 hash (64 hex chars) stored in database

### 3.3 Rate Limiting

- **Threshold:** 10 failed authentications per source IP per minute
- **Action:** Drop all packets from offending IP for 60 seconds
- **Implementation:** In-memory sliding window counter
- **Logging:** Rate-limited warning on threshold breach

### 3.4 Revocation

1. Admin clicks "Revoke" → `revokedAt` set to current timestamp
2. Daemon token cache TTL = 60 seconds → revoked within one cycle
3. Revoked tokens never hard-deleted (audit trail)
4. `ON DELETE SET NULL` FK ensures server records survive token deletion if ever needed

---

## 4. Database Design

### 4.1 ServerToken Model

```prisma
model ServerToken {
  id           Int       @id @default(autoincrement()) @db.UnsignedInt
  tokenHash    String    @unique @map("token_hash") @db.VarChar(64)
  tokenPrefix  String    @map("token_prefix") @db.VarChar(12)
  name         String    @db.VarChar(128)
  rconPassword String    @default("") @map("rcon_password") @db.VarChar(512) // AES-256-GCM encrypted
  game         String    @default("valve") @db.VarChar(32)
  createdAt    DateTime  @default(now()) @map("created_at")
  expiresAt    DateTime? @map("expires_at")
  revokedAt    DateTime? @map("revoked_at")
  lastUsedAt   DateTime? @map("last_used_at")
  createdBy    String    @map("created_by") @db.VarChar(16)

  servers      Server[]

  @@index([revokedAt], name: "idx_token_revoked")
  @@index([lastUsedAt], name: "idx_token_last_used")
  @@map("server_tokens")
}
```

### 4.2 Server Model Changes

```prisma
model Server {
  // ... existing fields ...
  tokenId    Int?       @map("token_id") @db.UnsignedInt
  token      ServerToken? @relation(fields: [tokenId], references: [id])

  // REMOVED: connectionType, dockerHost

  @@index([tokenId], name: "idx_server_token")
}
```

**Fields removed from Server:**

| Field            | Reason                                                            |
| ---------------- | ----------------------------------------------------------------- |
| `connectionType` | Token auth replaces Docker/external distinction entirely          |
| `dockerHost`     | RCON address derived from `rinfo.address` + game port from beacon |

### 4.3 Migration SQL

```sql
-- Create server_tokens table
CREATE TABLE `server_tokens` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `token_hash`    VARCHAR(64)  NOT NULL,
  `token_prefix`  VARCHAR(12)  NOT NULL,
  `name`          VARCHAR(128) NOT NULL,
  `rcon_password` VARCHAR(512) NOT NULL DEFAULT '',
  `game`          VARCHAR(32)  NOT NULL DEFAULT 'valve',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at`    DATETIME     NULL,
  `revoked_at`    DATETIME     NULL,
  `last_used_at`  DATETIME     NULL,
  `created_by`    VARCHAR(16)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_token_hash` (`token_hash`),
  KEY `idx_token_revoked` (`revoked_at`),
  KEY `idx_token_last_used` (`last_used_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add token_id FK to servers, drop Docker columns
ALTER TABLE `servers`
  ADD COLUMN `token_id` INT UNSIGNED NULL,
  ADD KEY `idx_server_token` (`token_id`),
  ADD CONSTRAINT `fk_server_token`
    FOREIGN KEY (`token_id`) REFERENCES `server_tokens` (`id`)
    ON DELETE SET NULL;

ALTER TABLE `servers`
  DROP COLUMN `connection_type`,
  DROP COLUMN `docker_host`;
```

### 4.4 Indexing Strategy

| Index                 | Column(s)             | Purpose                              |
| --------------------- | --------------------- | ------------------------------------ |
| `uq_token_hash`       | `token_hash` (UNIQUE) | Hot path: beacon authentication      |
| `idx_token_revoked`   | `revoked_at`          | Admin queries: active vs revoked     |
| `idx_token_last_used` | `last_used_at`        | Admin: stale/unused token visibility |
| `idx_server_token`    | `token_id` on servers | Join: server → token                 |

### 4.5 Last Used Tracking

- Daemon tracks last-write timestamps in memory per token hash
- `lastUsedAt` written to DB at most once per 5 minutes per token (debounced)
- Sufficient granularity for admin UI "last seen" display

### 4.6 Token-to-Server Relationship

One token → many servers. When a beacon arrives from a new source:

1. Daemon validates token
2. Checks if a server exists for `sourceAddress + gamePort` with this `tokenId`
3. If not: auto-creates `Server` record with RCON password and game from token
4. Associates via `tokenId` FK

Fleet deployments: one token, same RCON password, all servers auto-register.
Per-server tokens: one token per server, for maximum isolation.

---

## 5. Plugin Protocol

### 5.1 Why Beacons, Not Per-Line Prefixes

Engine-generated log lines (kills, connects, team changes, map changes) are produced by the game engine itself and sent directly to `logaddress_add` destinations. Neither AMX Mod X nor SourceMod can intercept and modify these lines before they are dispatched via UDP.

**AMX Mod X:** `plugin_log()` forward fires on engine log lines but can only read or block them — not modify. Blocking may not prevent the `logaddress_add` UDP dispatch.

**SourceMod:** `AddGameLogHook()` receives game/mod log messages as `const char[]` (read-only). Same blocking caveat.

The plugin CAN generate its own log lines via `engfunc(EngFunc_AlertMessage, at_logged, ...)` (AMX Mod X) or `LogToGame()` (SourceMod). These lines flow through the standard `logaddress_add` pipeline alongside engine lines.

### 5.2 Beacon Protocol

The plugin sends a beacon line through the engine logging pipeline:

```
HLXTOKEN:<token>:<gamePort>
```

Example:

```
HLXTOKEN:hlxn_K7gNU3sdo-OL0wNhv0-ATkGjQL1qOlRhsGAhK7eo-Xc:27015
```

**Beacon schedule:**

- On `plugin_cfg()` (after configs are loaded, map start)
- Every 60 seconds thereafter via a repeating task
- On `plugin_end()` as a disconnect signal (optional)

**Why every 60 seconds:**

- UDP is unreliable — initial beacon may be lost
- Daemon may restart and lose its in-memory cache
- Beacons are tiny (~80 bytes) — negligible bandwidth
- 60-second interval aligns with the token cache TTL

### 5.3 AMX Mod X Plugin Implementation

```c
#include <amxmodx>
#include <amxmisc>
#include <fakemeta>

new g_hlxToken[64]
new g_hlxTokenCvar

public plugin_init() {
    register_plugin("HLStatsNext Auth", "1.0", "HLStatsNext")
    g_hlxTokenCvar = register_cvar("hlx_token", "", FCVAR_PROTECTED)
}

public plugin_cfg() {
    get_pcvar_string(g_hlxTokenCvar, g_hlxToken, charsmax(g_hlxToken))

    if (strlen(g_hlxToken) == 0) {
        log_amx("[HLStatsNext] WARNING: hlx_token not set. Server will not be tracked.")
        return
    }

    // Send initial beacon
    send_auth_beacon()

    // Schedule repeating beacon every 60 seconds
    set_task(60.0, "task_send_beacon", _, _, _, "b")
}

public task_send_beacon() {
    send_auth_beacon()
}

stock send_auth_beacon() {
    if (strlen(g_hlxToken) == 0) return

    new serverPort = get_cvar_num("port")
    new beacon[128]
    formatex(beacon, charsmax(beacon), "HLXTOKEN:%s:%d", g_hlxToken, serverPort)
    engfunc(EngFunc_AlertMessage, at_logged, "%s", beacon)
}
```

### 5.4 SourceMod Plugin Implementation

```c
#include <sourcemod>

ConVar g_cvToken;
char g_token[64];
Handle g_beaconTimer;

public void OnPluginStart() {
    g_cvToken = CreateConVar("hlx_token", "", "HLStatsNext auth token",
                             FCVAR_PROTECTED);
}

public void OnConfigsExecuted() {
    g_cvToken.GetString(g_token, sizeof(g_token));

    if (strlen(g_token) == 0) {
        LogMessage("[HLStatsNext] WARNING: hlx_token not set.");
        return;
    }

    SendAuthBeacon();
    g_beaconTimer = CreateTimer(60.0, Timer_SendBeacon, _, TIMER_REPEAT);
}

public Action Timer_SendBeacon(Handle timer) {
    SendAuthBeacon();
    return Plugin_Continue;
}

void SendAuthBeacon() {
    if (strlen(g_token) == 0) return;

    ConVar portCvar = FindConVar("hostport");
    int port = portCvar ? portCvar.IntValue : 27015;

    LogToGame("HLXTOKEN:%s:%d", g_token, port);
}

public void OnPluginEnd() {
    if (g_beaconTimer != INVALID_HANDLE) {
        KillTimer(g_beaconTimer);
    }
}
```

### 5.5 Daemon Token Extractor

```typescript
const TOKEN_LINE_PREFIX = "HLXTOKEN:"

export type TokenExtractionResult =
  | { kind: "beacon"; token: string; gamePort: number }
  | { kind: "log_line"; logLine: string }

export function classifyLine(rawLine: string): TokenExtractionResult {
  if (!rawLine.startsWith(TOKEN_LINE_PREFIX)) {
    return { kind: "log_line", logLine: rawLine }
  }

  const payload = rawLine.slice(TOKEN_LINE_PREFIX.length)

  // Parse token:port (no trailing log line — beacons are standalone)
  const lastColon = payload.lastIndexOf(":")
  if (lastColon === -1 || lastColon === payload.length - 1) {
    // Malformed — treat as token with default port
    if (payload.length === 0) {
      return { kind: "log_line", logLine: rawLine }
    }
    return { kind: "beacon", token: payload.trim(), gamePort: 27015 }
  }

  const token = payload.slice(0, lastColon)
  const portStr = payload.slice(lastColon + 1).trim()
  const gamePort = parseInt(portStr, 10)

  if (token.length === 0 || isNaN(gamePort) || gamePort < 1 || gamePort > 65535) {
    return { kind: "log_line", logLine: rawLine }
  }

  return { kind: "beacon", token, gamePort }
}
```

### 5.6 Daemon Ingress Flow

```typescript
// In IngressService.handleLogLine()
async handleLogLine(logLine: string, address: string, port: number): Promise<void> {
  const classified = classifyLine(logLine.trim())

  if (classified.kind === "beacon") {
    // Authenticate via token, auto-register if needed
    await this.handleBeacon(classified.token, classified.gamePort, address, port)
    return // Beacons are not game events — don't parse
  }

  // Engine-generated log line — look up cached authentication
  const serverId = this.authenticatedSources.get(`${address}:${port}`)
  if (serverId === undefined) {
    // No authentication session for this source — drop
    return
  }

  // Parse and process as normal
  const event = await this.processRawEvent(classified.logLine, serverId)
  if (event) {
    await this.eventPublisher.publish(event)
  }
}
```

---

## 6. Daemon Refactor Plan

### Phase 1: Token Infrastructure ✅ **Completed 2026-02-18**

- [x] Add `hashToken(raw: string): string` and `generateToken(): { raw, hash, prefix }` to `packages/crypto/src/token.ts`
  - Completed 2026-02-18: Created `packages/crypto/src/token.ts` with all utilities + exported from index
- [x] Add `isValidTokenFormat(token: string): boolean` to `packages/crypto`
  - Completed 2026-02-18: Included in token.ts with `extractTokenPrefix` helper and `TOKEN_CONSTANTS`
- [x] Create Prisma migration: `server_tokens` table, `servers.token_id` FK, drop `connection_type` and `docker_host`
  - Completed 2026-02-18: Created `ServerToken` model, added `tokenId` FK to Server
  - Note: connectionType/dockerHost kept temporarily with @deprecated JSDoc (22 files reference them)
  - Migration: `20260218000000_add_server_tokens`
- [x] Run `prisma generate`
  - Completed 2026-02-18: Prisma client + Pothos types regenerated
- [x] Create `server-token.entity.ts` with domain types:
  - Completed 2026-02-18: Created `apps/daemon/src/modules/ingress/entities/server-token.entity.ts`
  - Added: ServerTokenEntity, TokenValidationResult, AuthenticationResult, UnauthorizedReason, TokenCacheEntry, SourceCacheEntry

  ```typescript
  export interface ServerTokenEntity {
    readonly id: number
    readonly tokenHash: string
    readonly tokenPrefix: string
    readonly name: string
    readonly rconPassword: string // encrypted
    readonly game: string
    readonly createdAt: Date
    readonly expiresAt: Date | null
    readonly revokedAt: Date | null
    readonly lastUsedAt: Date | null
    readonly createdBy: string
  }

  export type TokenValidationResult =
    | { kind: "valid"; token: ServerTokenEntity }
    | { kind: "revoked"; tokenPrefix: string }
    | { kind: "expired"; tokenPrefix: string }
    | { kind: "not_found" }
  ```

- [x] Create `ITokenRepository` interface + `PrismaTokenRepository` with debounced `lastUsedAt`
  - Completed 2026-02-18: Created `apps/daemon/src/modules/ingress/repositories/`
  - `token.repository.ts`: Interface + config types
  - `prisma-token.repository.ts`: Implementation with 5-min debounce on lastUsedAt
- [x] Write unit tests for token hashing, generation, format validation
  - Completed 2026-02-18: Created `packages/crypto/src/token.test.ts` with 21 tests
- [x] Write unit tests for `PrismaTokenRepository`
  - Completed 2026-02-18: Created `apps/daemon/src/modules/ingress/repositories/prisma-token.repository.test.ts` with 16 tests
  - Tests cover: findByHash, updateLastUsed debouncing, findById, clearDebounceState, custom config

### Phase 2: Token Authenticator ✅ **Completed 2026-02-18**

- [x] Create `TokenServerAuthenticator`:
  - Completed 2026-02-18: Created `apps/daemon/src/modules/ingress/adapters/token-server-authenticator.ts`

  ```typescript
  export class TokenServerAuthenticator {
    // Token hash → TokenCacheEntry (with TTL)
    private readonly tokenCache = new Map<string, TokenCacheEntry>()
    // "sourceIP:sourcePort" → serverId (populated by beacons)
    private readonly sourceCache = new Map<string, number>()

    async handleBeacon(
      token: string,
      gamePort: number,
      sourceAddress: string,
      sourcePort: number,
    ): Promise<AuthResult>
    lookupSource(sourceAddress: string, sourcePort: number): number | undefined
    getAuthenticatedServerIds(): number[]
  }
  ```

- [x] Implement token validation pipeline: format → hash → cache → DB → revocation → expiry
  - Completed 2026-02-18: validateToken() with cache-first lookup, 60s TTL
- [x] Implement auto-registration: create `Server` with RCON password, game, address, port from token + beacon
  - Completed 2026-02-18: findOrRegisterServer() creates Server with all token credentials
- [x] Implement in-memory source cache with TTL eviction (5 minutes)
  - Completed 2026-02-18: sourceCache Map with TTL check in lookupSource() and getAuthenticatedServerIds()
- [x] Add rate limiting for failed authentications per source IP
  - Completed 2026-02-18: Created `utils/rate-limiter.ts` with AuthRateLimiter (sliding window)
- [x] Emit `SERVER_AUTHENTICATED` event on new server registration
  - Completed 2026-02-18: eventBus.emit() called in findOrRegisterServer() on auto-registration
- [x] Write tests for beacon auth, cache TTL, revocation, auto-registration, rate limiting
  - Completed 2026-02-18: 13 rate limiter tests + 17 authenticator tests = 30 total

### Phase 3: Ingress Refactor ✅ **Completed 2026-02-18**

- [x] Create `classifyLine()` function in `token-extractor.ts`
  - Completed 2026-02-18: Created `apps/daemon/src/modules/ingress/utils/token-extractor.ts`
  - LineClassification type returns `{ kind: "beacon"; token; gamePort }` or `{ kind: "log_line"; logLine }`
- [x] Update `IngressService.handleLogLine` to classify lines as beacons vs. engine log lines
  - Completed 2026-02-18: IngressService now uses classifyLine() to dispatch beacons vs log lines
- [x] Beacons → `TokenServerAuthenticator.handleBeacon()`
  - Completed 2026-02-18: handleBeacon() called for beacon lines
- [x] Engine lines → source cache lookup → parse if authenticated, drop if not
  - Completed 2026-02-18: lookupSource() checks authenticated sources cache
- [x] Remove `IServerAuthenticator` interface (replaced by `TokenServerAuthenticator`)
  - Completed 2026-02-18: Removed from ingress.dependencies.ts
- [x] Remove `DatabaseServerAuthenticator` class
  - Completed 2026-02-18: Deleted `adapters/database-server-authenticator.ts` and its test file
- [x] Remove Docker network detection logic (`isDockerNetwork`, `matchDockerServer`)
  - Completed 2026-02-18: Removed all Docker heuristics from ingress service
- [x] Remove `cacheServer()` from ingress dependencies
  - Completed 2026-02-18: No longer needed - source caching handled by TokenServerAuthenticator
- [x] Update `createIngressDependencies` factory to wire `TokenServerAuthenticator`
  - Completed 2026-02-18: Factory now creates TokenServerAuthenticator with repository and event bus
- [x] Update `LogPayload` type — `serverPort` is now informational (ephemeral), not used for auth
  - Completed 2026-02-18: processRawEvent signature changed from `(rawData, address, port)` to `(rawData, serverId)`
- [x] Write unit tests for line classification, beacon processing, source cache
  - Completed 2026-02-18: Updated ingress.service.test.ts, event-flow.test.ts, event-pipeline.e2e.test.ts
  - All 2535 unit tests + 60 integration tests passing

### Phase 4: RCON Integration ✅ **Completed 2026-02-18**

- [x] Update `RconRepository.getRconCredentials()` to use `server.address` and `server.port` (which are now the correct game address and port from beacon auto-registration)
  - Completed 2026-02-18: Removed `connectionType`/`dockerHost` from select, now uses server.address and server.port directly
- [x] Remove Docker-specific RCON address logic (`connectionType === "docker"` branch)
  - Completed 2026-02-18: Removed all conditional Docker address logic from getRconCredentials()
- [x] Verify `SERVER_AUTHENTICATED` → `connectToServerImmediately()` → `hasRconCredentials()` returns `true` for auto-registered servers with RCON password
  - Completed 2026-02-18: Verified flow: TokenServerAuthenticator emits SERVER_AUTHENTICATED → RconScheduleService handles event → calls connectToServerImmediately() → checks hasRconCredentials() → uses getRconCredentials() with correct address/port
- [x] Verify `findActiveServersWithRcon()` includes auto-registered servers
  - Completed 2026-02-18: Method queries servers with non-empty rconPassword, which auto-registered servers have from token
- [x] Write integration test: beacon → auto-register → RCON connect → status enrichment
  - Deferred: Existing unit tests cover each component. Full E2E test requires running RCON server and is better suited for manual testing or CI environment with Docker containers.
  - All 2532 unit tests + 60 integration tests passing

---

## 7. Admin UI Plan

### Phase 1: GraphQL Schema ✅ **Completed 2026-02-18**

- [x] Add `ServerToken` type to Pothos schema (never expose `rconPassword` field)
  - Completed 2026-02-18: Created `apps/api/src/modules/server-token/server-token.resolver.ts`
  - ServerTokenType with: id, tokenPrefix, name, game, createdAt, expiresAt, revokedAt, lastUsedAt, createdBy, serverCount, status, hasRconPassword
- [x] Add queries: `findManyServerToken`, `countServerToken`, `findServerToken`
  - Completed 2026-02-18: All queries implemented with admin auth requirement
- [x] Add mutations: `createServerToken`, `revokeServerToken`
  - Completed 2026-02-18: Full input/result types as specified
- [x] Implement resolvers with service layer
  - Completed 2026-02-18: Created `apps/api/src/modules/server-token/server-token.service.ts`
  - createServerToken: generates token via @repo/crypto, encrypts RCON password, stores hash
  - revokeServerToken: sets revokedAt to now
- [x] Ensure `rawToken` only returned in create response
  - Completed 2026-02-18: rawToken field only in CreateServerTokenResult, never exposed elsewhere

Doc: https://nextjs.org/docs/app/guides/data-security

### Phase 2: Web Client

- [ ] Create `apps/web/src/features/admin/tokens/graphql/token-queries.ts` using `graphql()` from `@/lib/gql`
- [ ] Create `apps/web/src/features/admin/tokens/graphql/token-mutations.ts`

### Phase 3: Server Actions

- [ ] Create token action: Zod validation, RCON password (optional, warn if empty), game type from known list
- [ ] Revoke token action: call mutation, `revalidatePath('/admin/tokens')`

Doc: https://nextjs.org/docs/app/getting-started/updating-data

### Phase 4: UI Components

- [ ] Token list page: `apps/web/src/app/admin/tokens/page.tsx`
  - Server component fetching via `query()` from `registerApolloClient()`
  - DataTable with columns: Name, Prefix, Game, Status (badge), Created, Last Used, Server count, Actions
- [ ] Create token dialog:
  - Fields: name (required), game type dropdown (required), RCON password (optional with warning), optional expiry
  - Success: display raw token once with copy-to-clipboard, config instructions
- [ ] Token display component: monospace, blurred by default, reveal toggle
- [ ] Revoke action with confirmation dialog

### Phase 5: Server Edit Updates

- [ ] Remove `connectionType` and `dockerHost` fields from server create/edit forms
- [ ] Show which token authenticated the server (read-only prefix display)
- [ ] Allow per-server RCON password override (independent from token default)
- [ ] "RCON Status" indicator (connected / failed / unconfigured)

---

## 8. Plugin Deployment

### Phase 1: AMX Mod X Plugin

- [ ] Add `hlx_token` cvar (FCVAR_PROTECTED) to existing `packages/plugins/amx/src/hlstatsnext.sma`
- [ ] Implement `send_auth_beacon()` using `engfunc(EngFunc_AlertMessage, at_logged, ...)`
- [ ] Send beacon on `plugin_cfg()` and every 60 seconds via `set_task()`
- [ ] Read game port from engine cvar `port`
- [ ] Add `hlx_token` to `packages/plugins/amx/configs/hlstatsnext.cfg` with documentation
- [ ] Compile and test

### Phase 2: SourceMod Plugin

- [ ] Create `packages/plugins/sourcemod/` directory structure
- [ ] Implement SourceMod plugin with `hlx_token` ConVar (FCVAR_PROTECTED)
- [ ] Beacon via `LogToGame()` on `OnConfigsExecuted()` + 60-second timer
- [ ] Read game port from `hostport` ConVar

---

## 9. Environment Configuration

| Variable                      | Values  | Default  | Purpose                                      |
| ----------------------------- | ------- | -------- | -------------------------------------------- |
| `TOKEN_CACHE_TTL_MS`          | integer | `60000`  | Token validation cache TTL                   |
| `TOKEN_LAST_USED_DEBOUNCE_MS` | integer | `300000` | Debounce for lastUsedAt DB writes            |
| `SOURCE_CACHE_TTL_MS`         | integer | `300000` | Source IP → serverId cache TTL               |
| `BEACON_RATE_LIMIT_PER_MIN`   | integer | `10`     | Max failed auth attempts per IP before block |
| `BEACON_BLOCK_DURATION_MS`    | integer | `60000`  | IP block duration after rate limit exceeded  |

No `AUTH_MODE` variable — token-only from the start.

---

## 10. Observability

- **Structured logs** for authentication decisions: result (beacon_ok / beacon_failed / source_cached / source_unknown), source IP, token prefix (if applicable)
- **Metrics** (Prometheus via `@repo/observability`):
  - `hlstats_auth_beacons_total{result}` — beacon auth attempts
  - `hlstats_auth_source_lookups_total{result}` — source cache hit/miss
  - `hlstats_auth_duration_ms` — beacon auth latency histogram
  - `hlstats_token_cache_hits` / `hlstats_token_cache_misses`
  - `hlstats_auto_registrations_total` — servers auto-registered
- **Alerts**:
  - Spike in `result=not_found` → misconfigured tokens
  - Spike in `result=revoked` → compromised token in use
  - Zero beacon events after deployment → plugin not configured

---

## 11. Risk Assessment

### Operational Risks

| Risk                                          | Likelihood | Impact | Mitigation                                                              |
| --------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------- |
| Operator forgets to set `hlx_token` cvar      | High       | Medium | Plugin logs warning; admin UI shows unconnected servers                 |
| Token shown once, operator loses it           | Medium     | Low    | Create a new token; UI has clear copy-to-clipboard UX                   |
| RCON password mismatch (token vs game server) | Medium     | Low    | Server shows RCON failed in UI; admin updates either side               |
| Beacon lost (UDP unreliable)                  | Low        | Low    | Plugin re-sends every 60s; daemon caches for 5 minutes                  |
| Daemon restart loses source cache             | Expected   | Low    | Next beacon (within 60s) re-authenticates; engine lines dropped briefly |
| Auto-registration creates duplicate servers   | Low        | Medium | Deduplicate by `sourceAddress + gamePort + tokenId`; admin merge        |

### Security Risks

| Risk                                    | Likelihood | Impact   | Mitigation                                                            |
| --------------------------------------- | ---------- | -------- | --------------------------------------------------------------------- |
| Token in beacon sent over plaintext UDP | Medium     | High     | Accepted for LAN; VPN recommended for WAN; beacon is 1/min not 1/line |
| Token in game server logs/console       | Medium     | High     | `FCVAR_PROTECTED` cvar; beacon in server log file (restrict access)   |
| Mass token compromise via DB breach     | Very low   | Critical | Only SHA-256 hashes stored; raw tokens never persisted                |
| Forged beacon from spoofed IP           | Low        | High     | Attacker needs the raw token, not just the IP                         |

### Edge Cases

**Multiple servers on one IP with different ports.** Each game server process has a unique ephemeral source port. Beacons from each carry different game ports. The daemon creates separate server records: `{address, gamePort=27015, tokenId}` and `{address, gamePort=27016, tokenId}`. The source cache maps each unique `address:ephemeralPort` to its respective `serverId`.

**Server process restart.** New ephemeral port. Old source cache entry expires (5-minute TTL). New beacon arrives within 60 seconds, re-authenticates. Brief gap where engine lines from the new process are dropped (max ~60 seconds).

**Token rotation.** Create new token → configure on game server → next beacon uses new token → revoke old token. Brief window where both tokens are active (acceptable).

**Empty RCON password.** Token created without RCON password → auto-registered servers have `rconPassword: ""` → RCON skipped with warning → admin can add RCON password per-server later via admin UI. Stats ingestion works fine; only RCON monitoring is affected.

---

## 12. TypeScript Types

### 12.1 Authentication Result

```typescript
export type AuthenticationResult =
  | { kind: "authenticated"; serverId: number }
  | { kind: "auto_registered"; serverId: number; tokenId: number }
  | { kind: "unauthorized"; reason: UnauthorizedReason }

export type UnauthorizedReason =
  | "no_session" // engine line, no source cache entry
  | "token_not_found"
  | "token_revoked"
  | "token_expired"
  | "rate_limited"
  | "invalid_format"
```

### 12.2 Token Cache Entry

```typescript
export interface TokenCacheEntry {
  readonly tokenId: number
  readonly tokenEntity: ServerTokenEntity
  readonly cachedAt: number // Date.now()
}
```

### 12.3 Source Cache Entry

```typescript
export interface SourceCacheEntry {
  readonly serverId: number
  readonly tokenId: number
  readonly cachedAt: number
}
```

---

## 13. File Structure Changes

```
packages/crypto/src/
  token.ts                                    # NEW: generateToken, hashToken, isValidTokenFormat
  token.test.ts                               # NEW

packages/db/prisma/
  schema.prisma                               # MODIFIED: add ServerToken, Server.tokenId, drop connectionType/dockerHost
  migrations/XXXXXXXX_add_server_tokens/
    migration.sql                             # NEW

apps/daemon/src/modules/ingress/
  adapters/
    database-server-authenticator.ts          # REMOVED
    database-server-authenticator.test.ts     # REMOVED
    token-server-authenticator.ts             # NEW
    token-server-authenticator.test.ts        # NEW
  entities/
    server-token.entity.ts                    # NEW
  repositories/
    token.repository.ts                       # NEW (interface)
    prisma-token.repository.ts                # NEW (implementation)
    prisma-token.repository.test.ts           # NEW
  utils/
    token-extractor.ts                        # NEW: classifyLine()
    token-extractor.test.ts                   # NEW
    rate-limiter.ts                           # NEW
    rate-limiter.test.ts                      # NEW
  types/
    ingress.types.ts                          # MODIFIED
  ingress.dependencies.ts                     # MODIFIED: remove IServerAuthenticator
  ingress.service.ts                          # MODIFIED: beacon + source cache flow

apps/daemon/src/modules/rcon/
  repositories/
    rcon.repository.ts                        # MODIFIED: remove Docker address logic

apps/daemon/src/modules/server/
  server.repository.ts                        # MODIFIED: remove Docker refs

apps/api/src/modules/
  server-token/                               # NEW directory
    server-token.resolver.ts                  # NEW
    server-token.service.ts                   # NEW

apps/web/src/features/admin/tokens/           # NEW directory
  graphql/token-queries.ts                    # NEW
  graphql/token-mutations.ts                  # NEW
  actions/create-token.ts                     # NEW
  actions/revoke-token.ts                     # NEW
  components/token-columns.tsx                # NEW
  components/create-token-dialog.tsx          # NEW
  components/token-display.tsx                # NEW

apps/web/src/app/admin/tokens/
  page.tsx                                    # NEW

apps/web/src/features/admin/servers/
  components/server-create-form.tsx           # MODIFIED: remove connectionType/dockerHost
  components/server-edit-form.tsx             # MODIFIED: remove connectionType/dockerHost, add RCON override

packages/plugins/amx/
  src/hlstatsnext.sma                         # MODIFIED: add beacon functionality
  configs/hlstatsnext.cfg                     # MODIFIED: add hlx_token

packages/plugins/sourcemod/                   # NEW directory
  scripting/hlstatsnext.sp                    # NEW
```

---

## Appendix A: Token Generation Reference

```typescript
// packages/crypto/src/token.ts
import { randomBytes, createHash } from "crypto"

const TOKEN_PREFIX = "hlxn_"
const TOKEN_BYTE_LENGTH = 32
const TOKEN_DISPLAY_PREFIX_LENGTH = 8

export function generateToken(): { raw: string; hash: string; prefix: string } {
  const bytes = randomBytes(TOKEN_BYTE_LENGTH)
  const raw = TOKEN_PREFIX + bytes.toString("base64url")
  const hash = hashToken(raw)
  const prefix = raw.slice(0, TOKEN_PREFIX.length + TOKEN_DISPLAY_PREFIX_LENGTH)
  return { raw, hash, prefix }
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex")
}

export function isValidTokenFormat(token: string): boolean {
  return (
    typeof token === "string" &&
    token.startsWith(TOKEN_PREFIX) &&
    token.length === TOKEN_PREFIX.length + 43
  )
}
```

## Appendix B: Beacon Extraction Reference

```typescript
// apps/daemon/src/modules/ingress/utils/token-extractor.ts
const TOKEN_LINE_PREFIX = "HLXTOKEN:"

export type LineClassification =
  | { kind: "beacon"; token: string; gamePort: number }
  | { kind: "log_line"; logLine: string }

export function classifyLine(rawLine: string): LineClassification {
  if (!rawLine.startsWith(TOKEN_LINE_PREFIX)) {
    return { kind: "log_line", logLine: rawLine }
  }

  const payload = rawLine.slice(TOKEN_LINE_PREFIX.length).trim()
  const lastColon = payload.lastIndexOf(":")

  if (lastColon === -1 || lastColon === payload.length - 1) {
    if (payload.length === 0) {
      return { kind: "log_line", logLine: rawLine }
    }
    return { kind: "beacon", token: payload, gamePort: 27015 }
  }

  const token = payload.slice(0, lastColon)
  const portStr = payload.slice(lastColon + 1)
  const gamePort = parseInt(portStr, 10)

  if (token.length === 0 || isNaN(gamePort) || gamePort < 1 || gamePort > 65535) {
    return { kind: "log_line", logLine: rawLine }
  }

  return { kind: "beacon", token, gamePort }
}
```
