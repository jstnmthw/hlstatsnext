# Token-Based Authentication Refactor

**Status:** Proposed
**Author:** Engineering
**Date:** 2026-02-14
**Scope:** `apps/daemon`, `apps/web`, `apps/api`, `packages/db`, `packages/crypto`

---

## 1. Current Architecture Review

### 1.1 Technical Limitations

The daemon authenticates incoming UDP log packets by matching `rinfo.address` and `rinfo.port` against the `servers` table. This creates several structural problems:

**Ephemeral UDP source port mismatch.** The `rinfo.port` value from Node.js `dgram` is the OS-assigned ephemeral source port, not the game server's listening port (typically 27015). The `UdpServer` emits `serverPort: rinfo.port` directly:

```typescript
// apps/daemon/src/modules/ingress/udp-server.ts
const payload: LogPayload = {
  logLine,
  serverAddress: rinfo.address, // sender IP
  serverPort: rinfo.port, // ephemeral port, NOT game port
  timestamp: new Date(),
}
```

The `DatabaseServerAuthenticator` then queries `findFirst({ where: { address, port } })` against the stored game port (e.g., 27015), which can only match if the game server happens to bind its log-sending socket to its own listening port. This works under `network: host` but fails with any form of NAT or port mapping.

**Docker `network: host` requirement.** Docker port remapping changes both the source IP and source port. To preserve the identity of the sender, all game server containers must run with `--network host`, which eliminates Docker network isolation and prevents running multiple containers that bind to the same ports.

**Fragile Docker heuristics.** When the source IP falls in a Docker subnet (172.16-31.x.x or 10.x.x.x), the authenticator falls back to matching by the last IP octet:

```typescript
// Container index derived from IP: 172.18.0.2 -> index 0, .3 -> index 1
const containerIndex = lastOctet - 2
if (containerIndex < dockerServers.length) {
  const server = dockerServers[containerIndex]
}
```

This is order-dependent and breaks when containers restart in a different sequence, when the Docker network assigns IPs non-sequentially, or when containers are added or removed.

**Pre-registration requirement.** A server must exist in the database before the daemon will accept its logs. The `findFirst` query returns `null` for unknown servers, and the authenticator returns `{ kind: "unauthorized" }`. There is no auto-registration path in the current `DatabaseServerAuthenticator`.

### 1.2 Security Concerns

**No cryptographic authentication.** Any host that can send UDP packets to port 27500 with a source IP matching a registered server can inject arbitrary log data. UDP source addresses are trivially spoofable on local networks and possible to spoof across the internet in some configurations.

**Implicit trust of network identity.** The entire authentication model assumes that the source IP of a UDP packet is trustworthy. This is insufficient for any deployment where the daemon is reachable from untrusted networks.

**No audit trail.** There is no record of authentication attempts, no per-server credential rotation, and no way to revoke access to a single server without deleting it from the database.

### 1.3 Operational Constraints

- Operators must manually register every server in the admin UI before it can send logs.
- Changing a server's IP or port requires updating the database record and restarting the game server in the correct order.
- Docker deployments are limited to `network: host` mode, preventing standard container orchestration patterns.
- There is no way to temporarily disable a server's access without deleting it.

### 1.4 Coupling Issues

The `IServerAuthenticator` interface couples authentication identity to network topology:

```typescript
export interface IServerAuthenticator {
  authenticateServer(address: string, port: number): Promise<number | null>
  cacheServer(address: string, port: number, serverId: number): Promise<void>
  getAuthenticatedServerIds(): number[]
}
```

The `IngressService` passes raw UDP metadata directly into authentication, tightly coupling the transport layer to the identity layer. The `LogPayload` type carries `serverAddress` and `serverPort` as the sole identifying information, with no extensibility for alternative credentials.

---

## 2. Proposed Architecture

### 2.1 High-Level Design

Replace IP:Port identity with opaque token-based authentication. Each token is a cryptographically random string generated in the admin UI, stored as a SHA-256 hash in the database, and configured on the game server via a cvar. An AMX Mod X plugin (or equivalent for Source engine) prepends the token to each log line sent to the daemon.

The daemon extracts the token from the log payload prefix, hashes it, and looks up the hash in the `server_tokens` table. If a valid, non-revoked token is found, the server is authenticated. If the server does not yet exist in the `servers` table, it is auto-registered.

```
                                                   +------------------+
Game Server                                        |   Admin Web UI   |
+------------------+                               |   (apps/web)     |
| AMXX Plugin      |   Token generated via UI ---> | - Create token   |
| hlstatsx.amxx    |                               | - List tokens    |
| cvar: hlx_token  |                               | - Revoke token   |
+--------+---------+                               +--------+---------+
         |                                                  |
         | UDP: "TOKEN:abc123def... L 02/14/2026..."        | GraphQL mutation
         v                                                  v
+------------------+                               +------------------+
|  Daemon          |                               |  API             |
|  (apps/daemon)   |                               |  (apps/api)      |
|  TokenAuthenticator                              |  Token CRUD      |
|  - Extract token |                               +--------+---------+
|  - SHA-256 hash  |                                        |
|  - DB lookup     |                                        |
|  - Auto-register |                               +--------+---------+
+------------------+                               |  Database        |
         |                                         |  server_tokens   |
         +---------------------------------------->|  servers         |
                     Prisma queries                +------------------+
```

### 2.2 Authentication Flow

1. Admin generates a token in the web UI. The raw token is displayed once. The SHA-256 hash of the token and a token prefix (first 8 characters) are stored in `server_tokens`.
2. Admin configures `hlx_token` cvar on the game server with the raw token value.
3. The AMX Mod X plugin prepends the token to every log line: `HLXTOKEN:abc123def456... <original log line>`.
4. The daemon's `UdpServer` receives the UDP packet and emits a `LogPayload`.
5. The `IngressService` passes the raw log line to the `TokenServerAuthenticator`.
6. The authenticator:
   a. Checks for the `HLXTOKEN:` prefix.
   b. Extracts the token string.
   c. Computes SHA-256 of the token.
   d. Checks the in-memory token hash cache.
   e. On cache miss, queries `server_tokens` by hash.
   f. Validates the token is not revoked and not expired.
   g. Updates `lastUsedAt` (debounced to avoid write amplification).
   h. Returns the associated `serverId` (or triggers auto-registration if the token has no server yet).
7. The stripped log line (without the token prefix) is passed to the parser.

### 2.3 Token Validation Lifecycle

```
Token States:
  ACTIVE    -> Token is valid and can authenticate servers
  REVOKED   -> Token has been explicitly revoked by admin
  EXPIRED   -> Token has passed its optional expiresAt date

Transitions:
  ACTIVE  --[admin revoke]--> REVOKED  (terminal)
  ACTIVE  --[time passes]---> EXPIRED  (terminal, checked at validation time)
```

Tokens are validated in this order:

1. **Format check** -- token string is non-empty and within expected length bounds.
2. **Hash computation** -- SHA-256 of the raw token.
3. **Cache lookup** -- in-memory `Map<string, TokenCacheEntry>` keyed by hash.
4. **Database lookup** (on cache miss) -- query `server_tokens` by `tokenHash`.
5. **Revocation check** -- `revokedAt IS NULL`.
6. **Expiry check** -- `expiresAt IS NULL OR expiresAt > NOW()`.
7. **Cache population** -- store result in memory with TTL.

### 2.4 Backward Compatibility

During the migration period, the daemon supports dual-mode authentication:

1. If the log line starts with `HLXTOKEN:`, use token-based authentication.
2. Otherwise, fall back to legacy IP:Port authentication.
3. A feature flag (`AUTH_MODE`) controls the behavior: `dual` (default during migration), `token-only` (after migration), or `legacy` (rollback).

### 2.5 Failure Modes

| Failure                                     | Behavior                                                 |
| ------------------------------------------- | -------------------------------------------------------- |
| Token not in log line, legacy mode disabled | Return `unauthorized`, drop packet                       |
| Token hash not found in DB                  | Return `unauthorized`, rate-limited log                  |
| Token revoked                               | Return `unauthorized`, log revocation hit                |
| Token expired                               | Return `unauthorized`, log expiry hit                    |
| Database unavailable                        | Return from cache if available; otherwise `unauthorized` |
| Malformed token prefix                      | Strip prefix, attempt legacy auth if dual mode           |
| Token valid but no server exists            | Auto-register server, return new `serverId`              |

---

## 3. Security Analysis

### 3.1 Threat Model

| Threat                                         | Likelihood                 | Impact                                        | Mitigation                                                        |
| ---------------------------------------------- | -------------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| UDP packet injection with spoofed IP (current) | High on LAN                | Critical -- fake stats, rankings manipulation | Token authentication eliminates this                              |
| Token exfiltration from game server config     | Medium                     | High -- attacker can impersonate server       | Token revocation, per-server tokens, rotation                     |
| Token exfiltration from network sniffing       | Medium (UDP is plaintext)  | High                                          | Acceptable risk for LAN; document VPN recommendation for WAN      |
| Brute-force token guessing                     | Very low (256-bit entropy) | Critical                                      | 32-byte random tokens make this computationally infeasible        |
| Replay attack (resend captured UDP packet)     | Medium                     | Low -- replayed log data is idempotent        | Log timestamps provide natural replay window; not a priority      |
| Database compromise exposing token hashes      | Low                        | Medium                                        | SHA-256 hashes are pre-image resistant; raw tokens are not stored |
| Denial of service via invalid tokens           | Medium                     | Low -- wasted CPU on hash computation         | Rate limiting by source IP                                        |

### 3.2 Token Leakage Scenarios

**Game server compromise.** If an attacker gains access to the game server, they can read the `hlx_token` cvar. Mitigation: revoke the compromised token immediately via admin UI. The token is scoped to that server or group of servers, limiting blast radius.

**Network sniffing.** UDP log packets containing the token travel in plaintext. An attacker on the same network segment can capture the token. Mitigation: this is an accepted risk for LAN deployments. For WAN deployments, document the recommendation to tunnel UDP traffic over a VPN (e.g., WireGuard).

**Admin UI session compromise.** An attacker with admin access can view token prefixes and create new tokens, but cannot recover existing raw tokens (they are shown only once at creation). Mitigation: standard web application security practices (HTTPS, session management, CSRF protection).

### 3.3 Replay Attack Considerations

UDP log lines include timestamps from the game server. The daemon can optionally reject log lines with timestamps significantly in the past (configurable threshold, e.g., 5 minutes). However, since replayed kill/death events would create duplicate database records with the same timestamp, and the stats system is append-only, the impact of replay attacks is minimal -- they would inflate stats slightly but not grant unauthorized access.

Full replay protection is out of scope for this phase. If needed later, a nonce or sequence number can be added to the protocol.

### 3.4 Rate Limiting Considerations

The daemon should rate-limit authentication failures by source IP to prevent brute-force attempts:

- **Threshold:** 10 failed authentications per source IP per minute.
- **Action:** Drop packets from the offending IP for 60 seconds.
- **Implementation:** In-memory sliding window counter, no database involvement.
- **Logging:** Rate-limited warning log on threshold breach.

### 3.5 Revocation Strategy

Revocation is immediate and permanent:

1. Admin clicks "Revoke" in the UI, setting `revokedAt` to the current timestamp.
2. The daemon's token cache has a TTL (default: 60 seconds). Revoked tokens are rejected within one TTL cycle.
3. For immediate revocation, the admin UI can optionally trigger a cache-bust event via a simple HTTP endpoint on the daemon, or the daemon can poll for revocations on a short interval. The TTL-based approach is sufficient for most use cases.
4. Revoked tokens are never hard-deleted. They remain in the database for audit purposes.

### 3.6 Token Format Recommendation

**Recommended: Opaque random bytes.**

The token is 32 bytes of cryptographically random data, encoded as a URL-safe base64 string (43 characters). The daemon stores the SHA-256 hash (64 hex characters) in the database.

**Why not JWT:**

- JWTs are designed for stateless verification, but the daemon must check revocation state anyway, requiring a database or cache lookup.
- JWT parsing adds CPU overhead per packet on a high-throughput UDP path.
- JWT signatures require key management and rotation complexity.
- JWTs are significantly longer, increasing UDP packet size.
- JWTs cannot be efficiently revoked without a blocklist, negating the stateless benefit.

**Why not HMAC-signed tokens:**

- HMAC signatures provide integrity but not confidentiality or revocability beyond what opaque tokens with server-side hashing already provide.
- Adds key management complexity without meaningful security benefit for this use case.

**Token structure:**

```
hlxn_<base64url(32 random bytes)>
```

Example: `hlxn_K7gNU3sdo-OL0wNhv0-ATkGjQL1qOlRhsGAhK7eo-Xc`

The `hlxn_` prefix allows:

- Easy identification in config files and logs.
- `grep`-ability for accidental token leakage in codebases.
- Future token versioning (e.g., `hlxn2_`).

Only the first 8 characters of the full token (the prefix portion after `hlxn_`) are stored in plaintext for admin UI display purposes (e.g., `K7gNU3sd...`).

---

## 4. Database Design

### 4.1 Prisma Model

```prisma
model ServerToken {
  id          Int       @id @default(autoincrement()) @db.UnsignedInt
  tokenHash   String    @unique @map("token_hash") @db.VarChar(64)   // SHA-256 hex digest
  tokenPrefix String    @map("token_prefix") @db.VarChar(12)         // First 8 chars for display ("hlxn_K7g...")
  name        String    @db.VarChar(128)                              // Human-readable label
  createdAt   DateTime  @default(now()) @map("created_at")
  expiresAt   DateTime? @map("expires_at")                            // NULL = no expiry
  revokedAt   DateTime? @map("revoked_at")                            // NULL = active
  lastUsedAt  DateTime? @map("last_used_at")
  createdBy   String    @map("created_by") @db.VarChar(16)           // Username from users table

  // A token can be used by many servers (one-to-many)
  servers     Server[]

  @@index([revokedAt], name: "idx_token_revoked")
  @@index([lastUsedAt], name: "idx_token_last_used")
  @@map("server_tokens")
}
```

The `Server` model gains a nullable foreign key:

```prisma
model Server {
  // ... existing fields ...
  tokenId    Int?       @map("token_id") @db.UnsignedInt
  token      ServerToken? @relation(fields: [tokenId], references: [id])

  @@index([tokenId], name: "idx_server_token")
  // ... existing constraints ...
}
```

### 4.2 SQL Migration

```sql
-- Create server_tokens table
CREATE TABLE `server_tokens` (
  `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `token_hash`   VARCHAR(64)     NOT NULL,
  `token_prefix` VARCHAR(12)     NOT NULL,
  `name`         VARCHAR(128)    NOT NULL,
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at`   DATETIME        NULL,
  `revoked_at`   DATETIME        NULL,
  `last_used_at` DATETIME        NULL,
  `created_by`   VARCHAR(16)     NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_token_hash` (`token_hash`),
  KEY `idx_token_revoked` (`revoked_at`),
  KEY `idx_token_last_used` (`last_used_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add token_id foreign key to servers table
ALTER TABLE `servers`
  ADD COLUMN `token_id` INT UNSIGNED NULL AFTER `docker_host`,
  ADD KEY `idx_server_token` (`token_id`),
  ADD CONSTRAINT `fk_server_token`
    FOREIGN KEY (`token_id`) REFERENCES `server_tokens` (`id`)
    ON DELETE SET NULL;
```

### 4.3 Indexing Strategy

| Index                 | Column(s)               | Purpose                                                                |
| --------------------- | ----------------------- | ---------------------------------------------------------------------- |
| `uq_token_hash`       | `token_hash` (UNIQUE)   | Primary lookup during authentication -- every UDP packet triggers this |
| `idx_token_revoked`   | `revoked_at`            | Admin queries for active vs. revoked tokens                            |
| `idx_token_last_used` | `last_used_at`          | Admin visibility into stale/unused tokens                              |
| `idx_server_token`    | `token_id` on `servers` | Join from server to its token                                          |

The `token_hash` unique index is the hot path. Since the hash is a fixed-length 64-character hex string, the index is compact and efficient for exact-match lookups.

### 4.4 Soft Delete vs. Hard Revoke

Tokens use **soft revocation** via the `revokedAt` timestamp:

- Revoked tokens remain in the database indefinitely for audit trail.
- The `revokedAt IS NULL` condition is included in all active-token queries.
- A periodic cleanup job can hard-delete tokens revoked more than N days ago if storage is a concern, but this is optional.
- Hard deletion would break referential integrity with `servers.token_id` unless the FK is `ON DELETE SET NULL` (which it is in this design).

### 4.5 Last Used Tracking

The `lastUsedAt` field is updated when a token is used for authentication, but writes are debounced to avoid excessive database load:

- The daemon tracks last-update timestamps in memory per token hash.
- `lastUsedAt` is written to the database at most once per 5 minutes per token.
- This provides sufficient granularity for admin UI "last seen" display without impacting UDP processing throughput.

### 4.6 Token-to-Server Relationship

A single token can authenticate multiple servers. When a new server sends its first log line with a valid token:

1. The daemon authenticates via the token.
2. The log line is parsed to extract the server's identity (game type, map, hostname from `logaddress_add` response).
3. A new `Server` record is created with `tokenId` set to the authenticating token's ID.
4. Subsequent log lines from the same source (now cached) skip the creation step.

This enables a single token to be distributed to an entire fleet of game servers, with each server auto-registering on first contact. Alternatively, operators who prefer per-server tokens can generate one token per server.

---

## 5. Daemon Refactor Plan

### Phase 1: Token Infrastructure

Foundation layer -- token entity, hashing, and database schema.

- [ ] Create Prisma migration adding `server_tokens` table and `servers.token_id` column
- [ ] Run `prisma generate` to update the generated client
- [ ] Add `hashToken(raw: string): string` utility in `packages/crypto` using Node.js `crypto.createHash('sha256')`
- [ ] Add `generateToken(): { raw: string; hash: string; prefix: string }` utility in `packages/crypto`
- [ ] Add token format validation: `isValidTokenFormat(token: string): boolean` (checks `hlxn_` prefix + length)
- [ ] Create `apps/daemon/src/modules/ingress/entities/server-token.entity.ts` with domain types:

  ```typescript
  export interface ServerTokenEntity {
    readonly id: number
    readonly tokenHash: string
    readonly tokenPrefix: string
    readonly name: string
    readonly createdAt: Date
    readonly expiresAt: Date | null
    readonly revokedAt: Date | null
    readonly lastUsedAt: Date | null
    readonly createdBy: string
  }

  export type TokenValidationResult =
    | { kind: "valid"; tokenId: number; tokenName: string }
    | { kind: "revoked"; tokenPrefix: string }
    | { kind: "expired"; tokenPrefix: string }
    | { kind: "not_found" }
  ```

- [ ] Create `apps/daemon/src/modules/ingress/repositories/token.repository.ts`:
  ```typescript
  export interface ITokenRepository {
    findByHash(tokenHash: string): Promise<ServerTokenEntity | null>
    updateLastUsed(tokenId: number, timestamp: Date): Promise<void>
  }
  ```
- [ ] Implement `PrismaTokenRepository` with debounced `lastUsedAt` writes
- [ ] Write unit tests for token hashing, generation, and format validation
- [ ] Write unit tests for `PrismaTokenRepository`

### Phase 2: Token Authenticator

New authenticator implementing the existing `IServerAuthenticator` interface.

- [ ] Create `apps/daemon/src/modules/ingress/adapters/token-server-authenticator.ts`
- [ ] Implement `TokenServerAuthenticator` conforming to `IServerAuthenticator`:

  ```typescript
  export class TokenServerAuthenticator implements IServerAuthenticator {
    private readonly tokenCache = new Map<string, TokenCacheEntry>()
    private readonly serverCache = new Map<string, number>()
    private readonly CACHE_TTL = 60_000 // 60 seconds

    constructor(
      private readonly tokenRepository: ITokenRepository,
      private readonly serverInfoProvider: IServerInfoProvider,
      private readonly logger: ILogger,
      private readonly eventBus: IEventBus,
    ) {}

    async authenticateServer(address: string, port: number): Promise<number | null>
    async authenticateWithToken(
      token: string,
      address: string,
      port: number,
    ): Promise<number | null>
    async cacheServer(address: string, port: number, serverId: number): Promise<void>
    getAuthenticatedServerIds(): number[]
  }
  ```

- [ ] Implement token validation pipeline: format check -> hash -> cache -> DB -> revocation -> expiry
- [ ] Implement auto-registration: when token is valid but no server exists for the source, call `serverInfoProvider.findOrCreateServer()`
- [ ] Link auto-registered server to token via `tokenId` FK update
- [ ] Implement in-memory token cache with TTL eviction
- [ ] Add rate limiting for failed authentication attempts per source IP
- [ ] Emit `SERVER_AUTHENTICATED` event on successful new authentication (same as legacy)
- [ ] Write comprehensive unit tests with mocked repository
- [ ] Write tests for cache TTL expiration, revocation detection, auto-registration

### Phase 3: UDP Protocol Changes

Modify log line processing to extract and strip the token prefix.

- [ ] Define token prefix protocol constant: `HLXTOKEN:` followed by token string, followed by space
- [ ] Create `apps/daemon/src/modules/ingress/utils/token-extractor.ts`:

  ```typescript
  export interface TokenExtractionResult {
    kind: "token_found"
    token: string
    logLine: string // stripped of token prefix
  } | {
    kind: "no_token"
    logLine: string // original line unchanged
  }

  export function extractToken(rawLine: string): TokenExtractionResult
  ```

- [ ] Update `LogPayload` type to include optional `token` field:
  ```typescript
  export interface LogPayload {
    logLine: string
    serverAddress: string
    serverPort: number
    timestamp: Date
    token?: string // extracted token, if present
  }
  ```
- [ ] Update `UdpServer` or `IngressService.handleLogLine` to call `extractToken()` before authentication
- [ ] Ensure the stripped log line (without token prefix) is passed to the parser
- [ ] Write unit tests for token extraction with various edge cases (no token, malformed prefix, token-only line, binary data)

### Phase 4: Dual-Mode Authentication

Run both authenticators in parallel during migration.

- [ ] Add `AUTH_MODE` environment variable: `"dual"` | `"token-only"` | `"legacy"`
- [ ] Add to `EnvironmentConfig`:
  ```typescript
  authConfig: {
    mode: "dual" | "token-only" | "legacy"
  }
  ```
- [ ] Create `apps/daemon/src/modules/ingress/adapters/dual-server-authenticator.ts`:
  ```typescript
  export class DualServerAuthenticator implements IServerAuthenticator {
    constructor(
      private readonly tokenAuthenticator: TokenServerAuthenticator,
      private readonly legacyAuthenticator: DatabaseServerAuthenticator,
      private readonly mode: "dual" | "token-only" | "legacy",
      private readonly logger: ILogger,
    ) {}
  }
  ```
- [ ] In `dual` mode: if token present, use token auth; if no token, fall back to legacy
- [ ] In `token-only` mode: reject all non-token packets
- [ ] In `legacy` mode: ignore tokens, use IP:Port only
- [ ] Update `createIngressDependencies` factory to wire the correct authenticator based on `AUTH_MODE`
- [ ] Log authentication mode at startup
- [ ] Write unit tests for all three modes
- [ ] Write integration test for dual-mode fallback behavior

### Phase 5: Remove Legacy Authentication

After all servers have migrated to token-based auth.

- [ ] Remove `DatabaseServerAuthenticator` class
- [ ] Remove Docker network detection logic (`isDockerNetwork`, `matchDockerServer`)
- [ ] Remove `connectionType`, `dockerHost` fields from `Server` model (separate migration)
- [ ] Remove `DualServerAuthenticator` -- `TokenServerAuthenticator` becomes the sole implementation
- [ ] Update `IServerAuthenticator` interface to include token parameter:
  ```typescript
  export interface IServerAuthenticator {
    authenticateServer(token: string, address: string, port: number): Promise<number | null>
    getAuthenticatedServerIds(): number[]
  }
  ```
- [ ] Remove `cacheServer` from interface (token auth manages its own cache)
- [ ] Remove `AUTH_MODE` environment variable and dual-mode wiring
- [ ] Update all tests
- [ ] Update documentation

---

## 6. Admin UI Plan

### Phase 1: GraphQL Schema

- [ ] Add `ServerToken` type to Pothos schema in `apps/api`
- [ ] Add queries:
  - `findManyServerToken(where: ServerTokenWhereInput, orderBy: ..., take: Int, skip: Int): [ServerToken!]!`
  - `countServerToken(where: ServerTokenWhereInput): Int!`
- [ ] Add mutations:
  - `createServerToken(data: CreateServerTokenInput!): CreateServerTokenResult!` -- returns the raw token exactly once
  - `revokeServerToken(id: Int!): RevokeServerTokenResult!`
- [ ] Define input types:

  ```graphql
  input CreateServerTokenInput {
    name: String!
    expiresAt: DateTime
  }

  type CreateServerTokenResult {
    success: Boolean!
    message: String
    rawToken: String # Only returned on creation, never again
    token: ServerToken
  }

  type RevokeServerTokenResult {
    success: Boolean!
    message: String
    token: ServerToken
  }
  ```

- [ ] Implement resolvers with token generation via `@repo/crypto`
- [ ] Ensure `rawToken` is only returned in the `createServerToken` response -- never exposed via queries

### Phase 2: GraphQL Client (Web)

- [ ] Create `apps/web/src/features/admin/tokens/graphql/token-queries.ts`:

  ```typescript
  import { graphql } from "@/lib/gql"

  export const GET_TOKENS_QUERY = graphql(`
    query GetServerTokens(
      $take: Int
      $skip: Int
      $orderBy: [ServerTokenOrderByWithRelationInput!]
    ) {
      findManyServerToken(take: $take, skip: $skip, orderBy: $orderBy) {
        id
        tokenPrefix
        name
        createdAt
        expiresAt
        revokedAt
        lastUsedAt
        createdBy
        servers {
          serverId
          name
        }
      }
    }
  `)

  export const GET_TOKEN_COUNT = graphql(`
    query GetServerTokenCount {
      countServerToken
    }
  `)
  ```

- [ ] Create `apps/web/src/features/admin/tokens/graphql/token-mutations.ts`:

  ```typescript
  import { graphql } from "@/lib/gql"

  export const CREATE_TOKEN_MUTATION = graphql(`
    mutation CreateServerToken($data: CreateServerTokenInput!) {
      createServerToken(data: $data) {
        success
        message
        rawToken
        token {
          id
          tokenPrefix
          name
          createdAt
          expiresAt
        }
      }
    }
  `)

  export const REVOKE_TOKEN_MUTATION = graphql(`
    mutation RevokeServerToken($id: Int!) {
      revokeServerToken(id: $id) {
        success
        message
        token {
          id
          revokedAt
        }
      }
    }
  `)
  ```

### Phase 3: Server Actions

- [ ] Create `apps/web/src/features/admin/tokens/actions/create-token.ts`:
  - Server action using `getClient()` from `@/lib/apollo-client`
  - Zod validation for token name (required, 1-128 chars) and optional expiry date
  - Returns `rawToken` in the success response for one-time display
- [ ] Create `apps/web/src/features/admin/tokens/actions/revoke-token.ts`:
  - Server action that calls `REVOKE_TOKEN_MUTATION`
  - Revalidates the token list page on success

### Phase 4: UI Components

- [ ] Create `apps/web/src/features/admin/tokens/components/token-columns.tsx`:
  - DataTable column definitions using `@repo/ui` `ColumnDef` patterns
  - Columns: Name, Prefix (masked), Status (active/revoked/expired), Created, Last Used, Servers, Actions
  - Status badge with color coding (green/red/yellow)
  - "Revoke" action button in the actions column with confirmation dialog
- [ ] Create `apps/web/src/features/admin/tokens/components/create-token-dialog.tsx`:
  - Modal dialog with form: token name (required), optional expiry date
  - On success, display raw token in a copyable monospace field with a "Copy" button
  - Warning text: "This token will only be shown once. Copy it now."
  - Close button that clears the raw token from component state
- [ ] Create `apps/web/src/features/admin/tokens/components/token-display.tsx`:
  - One-time token display component with copy-to-clipboard functionality
  - Uses `hlxn_` prefix display format
  - Blurred/hidden by default with "Reveal" toggle
- [ ] Create `apps/web/src/app/admin/tokens/page.tsx`:
  - Server component that fetches token list via `query()` from `registerApolloClient()`
  - Renders DataTable with token columns
  - "Create Token" button that opens the dialog
  - Follows the pattern established in `apps/web/src/app/admin/servers/page.tsx`

### Phase 5: Server Edit Integration

- [ ] Add token association display to the server edit page (`apps/web/src/app/admin/servers/[id]/edit/page.tsx`)
- [ ] Show which token authenticated the server (read-only, token prefix only)
- [ ] Allow admin to re-associate a server with a different token

---

## 7. AMX Mod X Plugin Changes

### 7.1 Required Modifications

The existing HLStatsX AMX Mod X plugin (hlstatsx.amxx) uses `logd()` or `engfunc(EngFunc_AlertMessage, ...)` to send log data to the daemon. The plugin must be modified to prepend the authentication token to every log line.

### 7.2 Token Injection Mechanism

The token is stored in a server-side cvar that is loaded from the AMXX configuration:

```
// amxx.cfg or hlstatsx.cfg
hlx_token "hlxn_K7gNU3sdo-OL0wNhv0-ATkGjQL1qOlRhsGAhK7eo-Xc"
```

The cvar should be marked as `FCVAR_PROTECTED` (or the AMXX equivalent) to prevent clients from reading it via `cvarlist`.

### 7.3 Plugin Pseudo-Code

```c
// hlstatsx.sma (AMX Mod X source)

#include <amxmodx>
#include <amxmisc>

new g_hlxToken[64]
new g_hlxTokenCvar

public plugin_init() {
    register_plugin("HLStatsX Token Auth", "1.0", "HLStatsNext")

    // Register the token cvar (protected from client queries)
    g_hlxTokenCvar = register_cvar("hlx_token", "", FCVAR_PROTECTED)
}

public plugin_cfg() {
    // Read token after configs are executed
    get_pcvar_string(g_hlxTokenCvar, g_hlxToken, charsmax(g_hlxToken))

    if (strlen(g_hlxToken) == 0) {
        log_amx("[HLStatsX] WARNING: hlx_token is not set. Stats will not be recorded.")
    }
}

/**
 * Wraps the standard log_message to prepend the token.
 * Called wherever the plugin would normally emit a log line.
 */
stock hlx_log(const message[], any:...) {
    static formatted[512]
    vformat(formatted, charsmax(formatted), message, 2)

    if (strlen(g_hlxToken) > 0) {
        // Prepend token to log line
        // Format: HLXTOKEN:<token> <original log line>
        static tokenized[640]
        formatex(tokenized, charsmax(tokenized), "HLXTOKEN:%s %s", g_hlxToken, formatted)
        engfunc(EngFunc_AlertMessage, at_logged, "%s", tokenized)
    } else {
        // Fallback: send without token (legacy compatibility)
        engfunc(EngFunc_AlertMessage, at_logged, "%s", formatted)
    }
}
```

### 7.4 Protocol Format

The modified UDP packet format:

```
HLXTOKEN:hlxn_K7gNU3sdo-OL0wNhv0-ATkGjQL1qOlRhsGAhK7eo-Xc L 02/14/2026 - 12:34:56: "PlayerName<1><STEAM_0:1:12345><CT>" killed "VictimName<2><STEAM_0:0:67890><TERRORIST>" with "ak47"
```

The daemon's `extractToken()` function splits on the first space after `HLXTOKEN:` to separate the token from the log line.

### 7.5 Source Engine Equivalent

For Source engine servers using SourceMod, the same pattern applies with a SourceMod plugin reading from a ConVar and using `LogToGame()` or the `logaddress_add` mechanism. The protocol format is identical.

---

## 8. Rollout Strategy

### 8.1 Migration Path

1. **Database migration.** Deploy `server_tokens` table and `servers.token_id` column. This is additive and non-breaking.
2. **API and web UI.** Deploy token CRUD functionality. Admins can create tokens but they are not yet enforced.
3. **Daemon with dual mode.** Deploy daemon with `AUTH_MODE=dual`. Token-bearing packets use token auth; legacy packets use IP:Port auth. No disruption to existing servers.
4. **Plugin rollout.** Distribute updated AMX Mod X plugin. Operators configure `hlx_token` cvar on each server.
5. **Monitoring period.** Run in dual mode for 2-4 weeks. Monitor:
   - Percentage of log lines authenticated via token vs. legacy.
   - Any authentication failures for token-bearing packets.
   - Auto-registration events for new servers.
6. **Token-only cutover.** Once all servers are sending tokens, switch to `AUTH_MODE=token-only`.
7. **Legacy removal.** After confirming no regressions, remove legacy authentication code.

### 8.2 Feature Flags

| Variable                      | Values                         | Default  | Purpose                                                 |
| ----------------------------- | ------------------------------ | -------- | ------------------------------------------------------- |
| `AUTH_MODE`                   | `legacy`, `dual`, `token-only` | `dual`   | Controls authentication strategy                        |
| `TOKEN_CACHE_TTL_MS`          | integer                        | `60000`  | Token cache TTL in milliseconds                         |
| `TOKEN_LAST_USED_DEBOUNCE_MS` | integer                        | `300000` | Debounce interval for lastUsedAt writes                 |
| `TOKEN_AUTO_REGISTER`         | `true`, `false`                | `true`   | Whether to auto-register unknown servers on valid token |

### 8.3 Parallel IP:Port Fallback Period

During dual mode:

- The daemon logs metrics for both authentication paths.
- Admin UI displays which servers are using token auth vs. legacy.
- A dashboard or log summary shows migration progress.
- Operators can monitor `AUTH_MODE=dual` behavior before committing to `token-only`.

Recommended minimum dual-mode period: **2 weeks** in production.

### 8.4 Observability

- **Structured logs** for every authentication decision: mode (token/legacy), result (success/revoked/expired/not_found/unauthorized), source IP, token prefix (if applicable).
- **Metrics** (Prometheus via `@repo/observability`):
  - `hlstats_auth_total{mode, result}` -- counter of authentication attempts.
  - `hlstats_auth_duration_ms{mode}` -- histogram of authentication latency.
  - `hlstats_token_cache_hits` / `hlstats_token_cache_misses` -- cache effectiveness.
  - `hlstats_auto_registrations_total` -- counter of servers auto-registered via token.
- **Alerts**:
  - Spike in `result=not_found` may indicate misconfigured tokens.
  - Spike in `result=revoked` may indicate a compromised token being used.
  - Zero `mode=token` events after deployment may indicate plugin misconfiguration.

---

## 9. Risk Assessment

### 9.1 Operational Risks

| Risk                                           | Likelihood          | Impact                                                        | Mitigation                                                            |
| ---------------------------------------------- | ------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Operators forget to configure `hlx_token` cvar | High during rollout | Medium -- server logs are silently dropped in token-only mode | Dual mode fallback; admin UI shows legacy-only servers; documentation |
| Token displayed once but operator loses it     | Medium              | Low -- generate a new token                                   | Clear UX warning; allow multiple tokens per server fleet              |
| Database migration fails                       | Low                 | High -- daemon cannot start                                   | Standard Prisma migration rollback; additive-only schema change       |
| Cache TTL too long, revoked token still works  | Low                 | Medium -- up to 60s window                                    | Configurable TTL; document the revocation delay                       |
| Auto-registration creates duplicate servers    | Low                 | Medium -- stats split across duplicates                       | Deduplicate by game port + token combination; admin merge tool        |

### 9.2 Security Risks

| Risk                                         | Likelihood | Impact                     | Mitigation                                                     |
| -------------------------------------------- | ---------- | -------------------------- | -------------------------------------------------------------- |
| Token exposed in game server logs or console | Medium     | High                       | `FCVAR_PROTECTED` cvar; token prefix only in daemon logs       |
| Token stored in version control              | Medium     | High                       | `hlxn_` prefix enables pre-commit hook scanning; documentation |
| Mass token compromise via DB breach          | Very low   | Critical                   | Only SHA-256 hashes stored; raw tokens never persisted         |
| Brute force via rapid UDP packets            | Very low   | Low -- 256 bits of entropy | Rate limiting by source IP; computationally infeasible         |

### 9.3 Edge Cases

**Multiple servers sharing one token with identical game ports.** Auto-registration uses the source IP + game port (extracted from the log line, not from `rinfo.port`) combined with the token to create a unique server identity. If two servers on the same IP and game port share a token, they will map to the same server record. This is the correct behavior -- they are the same logical server.

**Token rotation.** To rotate a token:

1. Create a new token.
2. Configure it on the game server.
3. Revoke the old token.
4. During the brief window where both tokens are active, the server can authenticate with either.

**Clock skew.** Token expiry is checked against the daemon's system clock, not the database server's clock. Ensure NTP is configured on the daemon host.

**UDP packet fragmentation.** Adding the `HLXTOKEN:` prefix increases the log line length by approximately 55 bytes. Standard game log lines are well under the UDP MTU (1500 bytes) even with the prefix. No fragmentation risk.

**Empty or whitespace-only token cvar.** The `extractToken()` function must handle `HLXTOKEN: ` (empty token) gracefully, treating it as `no_token` and falling back to legacy auth in dual mode.

---

## 10. TypeScript Implementation Notes

### 10.1 Updated Interfaces

The `IServerAuthenticator` interface evolves to support token-based authentication while maintaining backward compatibility during the migration:

```typescript
// Phase 4 (dual mode) -- extends existing interface
export interface IServerAuthenticator {
  authenticateServer(address: string, port: number): Promise<number | null>
  authenticateWithToken?(token: string, address: string, port: number): Promise<number | null>
  cacheServer(address: string, port: number, serverId: number): Promise<void>
  getAuthenticatedServerIds(): number[]
}

// Phase 5 (token-only) -- simplified interface
export interface IServerAuthenticator {
  authenticateServer(token: string, address: string, port: number): Promise<number | null>
  getAuthenticatedServerIds(): number[]
}
```

### 10.2 Discriminated Unions

Extended `AuthenticationResult` to carry more context:

```typescript
export type AuthenticationResult =
  | { kind: "authenticated"; serverId: number; method: "token" | "legacy" }
  | { kind: "auto_registered"; serverId: number; tokenId: number }
  | { kind: "unauthorized"; reason: UnauthorizedReason }

export type UnauthorizedReason =
  | "no_credentials"
  | "token_not_found"
  | "token_revoked"
  | "token_expired"
  | "ip_not_registered"
  | "rate_limited"
  | "invalid_format"
```

Extended `TokenExtractionResult`:

```typescript
export type TokenExtractionResult =
  | { kind: "token_found"; token: string; logLine: string }
  | { kind: "no_token"; logLine: string }
  | { kind: "malformed_prefix"; logLine: string }
```

### 10.3 Domain Model Structure

```typescript
// Token cache entry with TTL tracking
export interface TokenCacheEntry {
  readonly tokenId: number
  readonly tokenName: string
  readonly cachedAt: number // Date.now() for TTL comparison
}

// Rate limiter entry
export interface RateLimitEntry {
  readonly count: number
  readonly windowStart: number
}

// Auto-registration context passed to ServerOrchestrator
export interface AutoRegistrationContext {
  readonly tokenId: number
  readonly sourceAddress: string
  readonly sourcePort: number
  readonly gameCode: string
}
```

### 10.4 Folder Structure Changes

```
apps/daemon/src/modules/ingress/
  adapters/
    database-server-authenticator.ts       # Existing (remove in Phase 5)
    database-server-authenticator.test.ts  # Existing (remove in Phase 5)
    token-server-authenticator.ts          # NEW (Phase 2)
    token-server-authenticator.test.ts     # NEW (Phase 2)
    dual-server-authenticator.ts           # NEW (Phase 4, remove in Phase 5)
    dual-server-authenticator.test.ts      # NEW (Phase 4, remove in Phase 5)
  entities/
    server-token.entity.ts                 # NEW (Phase 1)
  repositories/
    token.repository.ts                    # NEW (Phase 1) -- interface
    prisma-token.repository.ts             # NEW (Phase 1) -- implementation
    prisma-token.repository.test.ts        # NEW (Phase 1)
  utils/
    token-extractor.ts                     # NEW (Phase 3)
    token-extractor.test.ts                # NEW (Phase 3)
    rate-limiter.ts                        # NEW (Phase 2)
    rate-limiter.test.ts                   # NEW (Phase 2)
  types/
    ingress.types.ts                       # MODIFIED (extended discriminated unions)
  factories/
    ingress-dependencies.ts                # MODIFIED (wire new authenticator)
  ingress.dependencies.ts                  # MODIFIED (optional token method on interface)
```

New files in `packages/crypto/src/`:

```
packages/crypto/src/
  token.ts                                 # NEW -- generateToken, hashToken, isValidTokenFormat
  token.test.ts                            # NEW
```

New files in `packages/db/prisma/`:

```
packages/db/prisma/
  migrations/XXXXXXXX_add_server_tokens/
    migration.sql                          # NEW -- generated by Prisma
  schema.prisma                            # MODIFIED -- add ServerToken model, Server.tokenId
```

---

## Appendix A: Token Generation Reference

```typescript
// packages/crypto/src/token.ts
import { randomBytes, createHash } from "crypto"

const TOKEN_PREFIX = "hlxn_"
const TOKEN_BYTE_LENGTH = 32
const TOKEN_DISPLAY_PREFIX_LENGTH = 8

export function generateToken(): {
  raw: string
  hash: string
  prefix: string
} {
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
  // hlxn_ prefix + 43 chars of base64url-encoded 32 bytes
  return (
    typeof token === "string" &&
    token.startsWith(TOKEN_PREFIX) &&
    token.length === TOKEN_PREFIX.length + 43
  )
}
```

## Appendix B: Token Extraction Reference

```typescript
// apps/daemon/src/modules/ingress/utils/token-extractor.ts
const TOKEN_LINE_PREFIX = "HLXTOKEN:"

export type TokenExtractionResult =
  | { kind: "token_found"; token: string; logLine: string }
  | { kind: "no_token"; logLine: string }
  | { kind: "malformed_prefix"; logLine: string }

export function extractToken(rawLine: string): TokenExtractionResult {
  if (!rawLine.startsWith(TOKEN_LINE_PREFIX)) {
    return { kind: "no_token", logLine: rawLine }
  }

  const afterPrefix = rawLine.slice(TOKEN_LINE_PREFIX.length)
  const spaceIndex = afterPrefix.indexOf(" ")

  if (spaceIndex === -1) {
    // Token prefix present but no log line follows
    return { kind: "malformed_prefix", logLine: rawLine }
  }

  const token = afterPrefix.slice(0, spaceIndex)
  const logLine = afterPrefix.slice(spaceIndex + 1)

  if (token.length === 0) {
    return { kind: "malformed_prefix", logLine: rawLine }
  }

  return { kind: "token_found", token, logLine }
}
```
