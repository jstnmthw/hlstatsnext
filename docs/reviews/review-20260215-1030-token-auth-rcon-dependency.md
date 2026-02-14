# Next.js v16 Engineering Review — Token Auth RCON Dependency

## Scope

This review is an addendum to [review-20260214-0930-token-based-auth-refactor.md](review-20260214-0930-token-based-auth-refactor.md), addressing a critical architectural gap: the **RCON password circular dependency** introduced by auto-registration in the token-based authentication model.

Specifically:

- Analysis of the circular dependency between auto-registration and RCON connectivity
- Revised data model for `ServerToken` that bundles RCON credentials
- Impact on the daemon's `SERVER_AUTHENTICATED` event flow
- Revised admin UI token creation workflow
- Extended AMXX plugin protocol for game port discovery

## Repo/System Context

| Property              | Value                                                            |
| --------------------- | ---------------------------------------------------------------- |
| **Monorepo**          | Turborepo + pnpm workspaces                                      |
| **Frontend**          | Next.js v16.1.6, App Router, Turbopack                           |
| **React**             | v19.2.4                                                          |
| **GraphQL API**       | Pothos + Apollo Server (port 4000)                               |
| **Database**          | MySQL/MariaDB via Prisma v7 (`@prisma/adapter-mariadb`)          |
| **Daemon**            | Node.js, tsx watch, UDP ingress, RCON (Source + GoldSrc)         |
| **Crypto**            | `@repo/crypto` -- AES-256-GCM encryption, Argon2id hashing       |
| **Auth refactor doc** | `docs/reviews/review-20260214-0930-token-based-auth-refactor.md` |

## Measurement Methodology (DevTools)

- **Next.js MCP**: Server discovered on port 3001 (0 tools exposed -- MCP endpoint not fully active)
- **Static analysis**: Codebase exploration of `apps/daemon`, `apps/api`, `apps/web`, `packages/database`, `packages/crypto`
- **Runtime diagnostics**: Not measured (dev server MCP tools unavailable)

## Baseline Results

| Area                     | Current State                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Server authentication    | IP:Port matching via `DatabaseServerAuthenticator`                                          |
| RCON credential source   | `Server.rconPassword` (AES-256-GCM encrypted), set via admin UI before logs                 |
| RCON trigger             | `SERVER_AUTHENTICATED` event -> `ServerMonitoringCommand.connectToServerImmediately()`      |
| Auto-registration        | Not supported -- `findFirst({ where: { address, port } })` returns null for unknown servers |
| RCON without credentials | `hasRconCredentials()` returns false, `connectToServerImmediately()` skips silently         |

---

## Findings

### F-001: RCON Circular Dependency in Auto-Registration Flow

**Summary:** The token-based auth refactor proposes auto-registration of servers on first token-authenticated contact. However, auto-registered servers lack the RCON password required for the daemon to execute `status` commands, creating a hard dependency loop.

**Evidence:** The current post-authentication flow in `server-monitoring.command.ts:260-310`:

```
SERVER_AUTHENTICATED event
  -> connectToServerImmediately(serverId)
    -> hasRconCredentials(serverId) // checks Server.rconPassword != ""
      -> FALSE for auto-registered server (rconPassword defaults to "")
    -> "skipping immediate connection" (line 269-272)
```

The `findActiveServersWithRcon()` query in `server.repository.ts:90-144` filters on `rconPassword: { not: "" }`, permanently excluding auto-registered servers from scheduled RCON monitoring as well.

**The circular dependency:**

```
1. No DB record exists
2. Game server sends log with token
3. Daemon authenticates via token -> auto-creates Server record
4. SERVER_AUTHENTICATED fires -> daemon attempts RCON
5. RCON FAILS: Server.rconPassword is "" (no one provided it)
6. Without RCON "status", daemon cannot get hostname, map, player count, FPS
7. Server record remains a stub with no operational data
```

If we require the admin to pre-register the server with an RCON password (as today), we eliminate the auto-registration benefit entirely, which is the primary value proposition of the token-based auth refactor.

**Risk/complexity:** Critical architectural gap -- must be resolved before Phase 1 of the token auth refactor.

### F-002: Game Port Unknown at Auto-Registration Time

**Summary:** The RCON connection requires knowing the game server's listening port (e.g., 27015). With the current ingress path, the daemon only receives `rinfo.address` (source IP) and `rinfo.port` (ephemeral UDP source port). The ephemeral port is NOT the game port.

**Evidence:** From `udp-server.ts`, the `LogPayload` emits:

```typescript
const payload: LogPayload = {
  logLine,
  serverAddress: rinfo.address, // source IP -- correct for RCON target
  serverPort: rinfo.port, // ephemeral port -- WRONG for RCON target
  timestamp: new Date(),
}
```

The `RconRepository.getRconCredentials()` at `rcon.repository.ts:59-77` uses `server.address` and `server.port` (the stored game port) for RCON connections. For auto-registered servers, `server.port` would be the ephemeral source port, making RCON connections fail.

**Risk/complexity:** High -- requires either protocol-level game port transmission or admin-provided port at token creation time.

### F-003: Missing Game Type at Auto-Registration Time

**Summary:** The daemon needs the server's game type (e.g., `cstrike`, `csgo`, `tf`) for two purposes: (1) selecting the correct log parser (`ParserFactory.create(gameCode, ...)`), and (2) selecting the correct RCON protocol (GoldSrc vs Source via `mapGameToEngine()`). Auto-registered servers default to `game: "valve"`, which may select the wrong parser and RCON protocol.

**Evidence:** The `Server` model defaults `game` to `"valve"`:

```prisma
game String @default("valve") @db.VarChar(32)
```

`RconRepository.mapGameToEngine()` at `rcon.repository.ts:120-155` maps game strings to `GameEngine.GOLDSRC`, `GameEngine.SOURCE`, or `GameEngine.SOURCE_2009`. A wrong game code leads to the wrong RCON protocol, which leads to connection failures.

**Risk/complexity:** Medium -- game type is knowable at token creation time by the admin.

### F-004: Token-to-Server Relationship is One-to-Many, but RCON Credentials are Per-Server

**Summary:** The original refactor doc proposes a one-to-many relationship (one token authenticates many servers). If the RCON password is stored on the token, all servers sharing that token would necessarily share the same RCON password. This works for fleet deployments (same operator, same RCON password) but breaks for heterogeneous setups.

**Evidence:** From the original refactor doc Section 4.6:

> "A single token can authenticate multiple servers... This enables a single token to be distributed to an entire fleet of game servers."

However, RCON passwords are inherently per-server -- each game server has its own `rcon_password` cvar. While fleet deployments often use the same RCON password, this is not guaranteed.

**Risk/complexity:** Low -- most operators who share a token across servers also share RCON passwords. Per-server override via admin UI handles exceptions.

---

## Proposed Architecture: Token Registration Bundle

### Design Principle

The token becomes a **registration bundle** -- a pre-provisioned package of all minimum credentials the daemon needs to make a server fully operational on first contact:

1. **Authentication token** (existing proposal) -- identifies and authorizes the sender
2. **RCON password** (new) -- enables daemon-to-server communication
3. **Game type** (new) -- enables correct parser and RCON protocol selection
4. **Game port** (new, from AMXX plugin) -- enables RCON connection targeting

### Revised ServerToken Model

```prisma
model ServerToken {
  id              Int       @id @default(autoincrement()) @db.UnsignedInt
  tokenHash       String    @unique @map("token_hash") @db.VarChar(64)
  tokenPrefix     String    @map("token_prefix") @db.VarChar(12)
  name            String    @db.VarChar(128)
  rconPassword    String    @default("") @map("rcon_password") @db.VarChar(512)  // AES-256-GCM encrypted
  game            String    @default("valve") @db.VarChar(32)                     // Game code for parser + RCON protocol
  createdAt       DateTime  @default(now()) @map("created_at")
  expiresAt       DateTime? @map("expires_at")
  revokedAt       DateTime? @map("revoked_at")
  lastUsedAt      DateTime? @map("last_used_at")
  createdBy       String    @map("created_by") @db.VarChar(16)

  servers         Server[]

  @@index([revokedAt], name: "idx_token_revoked")
  @@index([lastUsedAt], name: "idx_token_last_used")
  @@map("server_tokens")
}
```

**Changes from original proposal:**

| Field          | Original | Revised                                        |
| -------------- | -------- | ---------------------------------------------- |
| `rconPassword` | --       | Added: AES-256-GCM encrypted RCON password     |
| `game`         | --       | Added: Game code for parser/protocol selection |

### Revised Auto-Registration Flow

```
1. Admin creates token in UI:
   - Provides: name, RCON password, game type, optional expiry
   - Receives: raw token (shown once, copy it now)

2. Admin configures game server:
   - hlx_token "hlxn_K7gNU3sdo..."
   - rcon_password "myRconPass"

3. Game server sends first log line:
   HLXTOKEN:hlxn_K7gNU3sdo...:27015 L 02/15/2026 - 12:00:00: ...
                                ^^^^^
                          game port included in prefix

4. Daemon processes:
   a. extractToken() parses: token + game port + log line
   b. hashToken() -> cache/DB lookup -> token valid
   c. Token has no server for this source IP + game port combo
   d. Auto-register:
      - Create Server record with:
        - address = rinfo.address (source IP)
        - port = game port from prefix (e.g., 27015)
        - rconPassword = decrypt-then-re-encrypt from token
        - game = token.game
        - tokenId = token.id
   e. Emit SERVER_AUTHENTICATED

5. RCON connects immediately:
   - hasRconCredentials() returns TRUE (password copied from token)
   - connectToServerImmediately() succeeds
   - "status" command returns hostname, map, players, FPS
   - Server record enriched with live data
```

### Extended UDP Protocol

The AMXX plugin prefix is extended to include the game port:

```
HLXTOKEN:<token>:<port> <log line>
```

Examples:

```
HLXTOKEN:hlxn_K7gNU3sdo-OL0wNhv0-ATkGjQL1qOlRhsGAhK7eo-Xc:27015 L 02/15/2026 - 12:34:56: ...
HLXTOKEN:hlxn_K7gNU3sdo-OL0wNhv0-ATkGjQL1qOlRhsGAhK7eo-Xc:27017 L 02/15/2026 - 12:34:56: ...
```

**Why include port in every packet, not just the first:**

- UDP is stateless -- the daemon may restart and lose its in-memory cache
- Each packet must be independently authenticatable
- The port adds only 6 bytes per packet (`:27015`)

### Revised Token Extraction

```typescript
export type TokenExtractionResult =
  | { kind: "token_found"; token: string; gamePort: number; logLine: string }
  | { kind: "no_token"; logLine: string }
  | { kind: "malformed_prefix"; logLine: string }

const TOKEN_LINE_PREFIX = "HLXTOKEN:"

export function extractToken(rawLine: string): TokenExtractionResult {
  if (!rawLine.startsWith(TOKEN_LINE_PREFIX)) {
    return { kind: "no_token", logLine: rawLine }
  }

  const afterPrefix = rawLine.slice(TOKEN_LINE_PREFIX.length)
  const spaceIndex = afterPrefix.indexOf(" ")

  if (spaceIndex === -1) {
    return { kind: "malformed_prefix", logLine: rawLine }
  }

  const tokenAndPort = afterPrefix.slice(0, spaceIndex)
  const logLine = afterPrefix.slice(spaceIndex + 1)

  // Parse token:port format
  const lastColon = tokenAndPort.lastIndexOf(":")
  if (lastColon === -1 || lastColon === tokenAndPort.length - 1) {
    // No port -- treat as token-only (backward compat with original proposal)
    if (tokenAndPort.length === 0) {
      return { kind: "malformed_prefix", logLine: rawLine }
    }
    return { kind: "token_found", token: tokenAndPort, gamePort: 27015, logLine }
  }

  const token = tokenAndPort.slice(0, lastColon)
  const portStr = tokenAndPort.slice(lastColon + 1)
  const gamePort = parseInt(portStr, 10)

  if (token.length === 0 || isNaN(gamePort) || gamePort < 1 || gamePort > 65535) {
    return { kind: "malformed_prefix", logLine: rawLine }
  }

  return { kind: "token_found", token, gamePort, logLine }
}
```

### AMXX Plugin Changes

```c
// hlstatsx.sma - Modified hlx_log function
stock hlx_log(const message[], any:...) {
    static formatted[512]
    vformat(formatted, charsmax(formatted), message, 2)

    if (strlen(g_hlxToken) > 0) {
        // Get the server's listening port
        new serverPort = get_cvar_num("port")  // Engine cvar for game port

        static tokenized[640]
        formatex(tokenized, charsmax(tokenized), "HLXTOKEN:%s:%d %s",
                 g_hlxToken, serverPort, formatted)
        engfunc(EngFunc_AlertMessage, at_logged, "%s", tokenized)
    } else {
        engfunc(EngFunc_AlertMessage, at_logged, "%s", formatted)
    }
}
```

### RCON Password Handling During Auto-Registration

The RCON password flows from token to server record:

```typescript
// In TokenServerAuthenticator.autoRegisterServer()
async autoRegisterServer(
  tokenEntity: ServerTokenEntity,
  sourceAddress: string,
  gamePort: number,
): Promise<number> {
  // The token's rconPassword is already encrypted with AES-256-GCM.
  // Copy it directly to the new server record (same encryption key).
  const server = await this.database.prisma.server.create({
    data: {
      address: sourceAddress,
      port: gamePort,
      game: tokenEntity.game,
      rconPassword: tokenEntity.rconPassword, // encrypted, copied as-is
      tokenId: tokenEntity.id,
      name: "", // Will be enriched via RCON "status" command
      connectionType: "external",
    },
  })

  return server.serverId
}
```

The RCON password is encrypted once at token creation time and copied verbatim to the server record. Both use the same `@repo/crypto` `CryptoService` with the same master key, so the daemon can decrypt it from either location.

### Admin UI: Token Creation Flow

The token creation dialog gains two new required fields:

```
+------------------------------------------+
|  Create Server Token                     |
|                                          |
|  Token Name: [________________________]  |
|  Game Type:  [Counter-Strike 1.6    v ]  |
|  RCON Password: [____________________]  |
|  Expires: [Optional date picker      ]  |
|                                          |
|  [Cancel]              [Create Token]   |
+------------------------------------------+
```

On success:

```
+------------------------------------------+
|  Token Created Successfully              |
|                                          |
|  Copy this token now. It will NOT be     |
|  shown again.                            |
|                                          |
|  hlxn_K7gNU3sdo-OL0wNhv0-ATkGjQL1q...  |
|  [Copy to Clipboard]                     |
|                                          |
|  Configure your game server:             |
|  hlx_token "hlxn_K7gNU3sdo-OL0wNh..."  |
|                                          |
|  [Done]                                  |
+------------------------------------------+
```

**Next.js best practice -- Server Actions for mutations:**

- Token creation and revocation should use Server Actions (or GraphQL mutations via `getClient()`)
- The raw token must only exist in the server action response and never be persisted
- Use `revalidatePath('/admin/tokens')` after creation/revocation to refresh the token list

Doc URL: https://nextjs.org/docs/app/getting-started/updating-data

**Next.js best practice -- Data security for sensitive fields:**

- The RCON password and raw token are sensitive. Server Actions should validate input with Zod, and only return the `rawToken` in the `createServerToken` response -- never via queries
- Use the Data Access Layer pattern to ensure RCON passwords are never serialized to client components
- Mark sensitive data modules with `import 'server-only'`

Doc URL: https://nextjs.org/docs/app/guides/data-security

### Revised GraphQL Schema

```graphql
input CreateServerTokenInput {
  name: String!
  rconPassword: String!
  game: String!
  expiresAt: DateTime
}

type CreateServerTokenResult {
  success: Boolean!
  message: String
  rawToken: String # Only returned on creation
  token: ServerToken
}
```

### Security Considerations

| Concern                                    | Mitigation                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| RCON password stored on token              | Encrypted with AES-256-GCM, same as on Server model today                |
| RCON password in memory during creation    | Encrypted immediately via `crypto.encrypt()` before DB write             |
| RCON password copied to multiple servers   | Same encrypted blob copied -- no re-encryption needed                    |
| Admin changes RCON password on game server | Admin must also update the token (or update the specific server record)  |
| Token compromise exposes RCON password     | Revoke token immediately; change RCON password on all associated servers |
| RCON password visible in admin UI          | Never exposed in queries -- only set during creation, like the raw token |

### Edge Case: RCON Password Mismatch

If the admin sets a different RCON password on the game server than what's stored in the token:

1. Token auth succeeds (token is valid)
2. Server auto-registers with token's RCON password
3. RCON connection fails (wrong password)
4. `ServerMonitoringCommand` records the failure and enters backoff
5. Admin notices in the UI (server shows "RCON failed" status)
6. Admin updates either the token's RCON password or the server's RCON password

This is the same operational failure mode as today when an admin enters the wrong RCON password in the server creation form -- no new risk introduced.

### Edge Case: Per-Server RCON Password Override

For operators using one token across multiple servers with different RCON passwords:

1. Create the token with the most common RCON password
2. Servers auto-register with that password
3. For servers with different passwords, admin updates `Server.rconPassword` via the server edit page
4. The per-server override takes precedence (RCON reads from `Server.rconPassword`, not from `ServerToken.rconPassword`)

---

## Phased To-Do Plan

### P0: Measurement / Guardrails

- [ ] **F-001** Verify the RCON dependency by tracing the full `SERVER_AUTHENTICATED` -> `connectToServerImmediately` -> `hasRconCredentials` path for a server with `rconPassword: ""`
  - Confirm that auto-registered servers are permanently excluded from RCON monitoring
- [ ] **F-002** Verify that `rinfo.port` is indeed the ephemeral source port by logging both `rinfo.port` and the game server's actual listening port in a test environment

### P1: Quick Wins (amend original refactor Phase 1)

- [ ] **F-001, F-003** Add `rconPassword` (VarChar(512), default "") and `game` (VarChar(32), default "valve") fields to the `ServerToken` Prisma model
  - Amend the migration SQL from the original refactor doc
  - Doc: https://nextjs.org/docs/app/guides/data-security (sensitive data handling)
- [ ] **F-001** Update the `CreateServerTokenInput` GraphQL input type to require `rconPassword` and `game`
- [ ] **F-001** Update the `createServerToken` API resolver to encrypt `rconPassword` via `@repo/crypto` before DB write
- [ ] **F-001** Ensure `ServerToken` GraphQL type never exposes `rconPassword` in queries (read-only prefix/name/dates)
- [ ] **F-004** Add `rconPassword` update capability to individual server records via the existing server edit page (override token default)

### P2: Architectural Changes (amend original refactor Phases 2-3)

- [ ] **F-002** Extend token extraction protocol to `HLXTOKEN:<token>:<port> <logline>` format
  - Update `extractToken()` to parse the game port
  - Add backward compatibility: if no port, default to 27015
  - Write unit tests for all format variations
- [ ] **F-001** Implement auto-registration with RCON credential copy in `TokenServerAuthenticator`
  - Copy encrypted `rconPassword` from `ServerToken` to new `Server` record
  - Set `game` from `ServerToken.game`
  - Set `port` from extracted game port
  - Set `address` from `rinfo.address`
  - Doc: https://nextjs.org/docs/app/guides/data-security (server-only data handling)
- [ ] **F-001** Verify that `SERVER_AUTHENTICATED` event triggers successful RCON connection for auto-registered servers
  - `hasRconCredentials()` must return `true` for the new server
  - `connectToServerImmediately()` must succeed and enrich the server record
- [ ] **F-003** Update AMXX plugin to include game port in the token prefix: `HLXTOKEN:%s:%d %s`
  - Use `get_cvar_num("port")` to read the game server's listening port

### P3: Admin UI (amend original refactor Phase 4 UI)

- [ ] **F-001** Update the token creation dialog to include RCON password field and game type dropdown
  - Server Action validates RCON password (required, non-empty) and game type (from known game list)
  - Encrypt RCON password server-side before GraphQL mutation
  - Doc: https://nextjs.org/docs/app/getting-started/updating-data (Server Actions for mutations)
- [ ] **F-001** Add "RCON Status" indicator to the server list in admin UI
  - Shows whether RCON is connected, failed, or unconfigured for each server
  - Helps operators identify RCON password mismatches
- [ ] **F-004** Add per-server RCON password override in the server edit page
  - "Override token RCON password" toggle with password field
  - Clear messaging: "This server's RCON password differs from its token's default"

---

## Open Questions / Follow-Ups

1. **Should the game port be optional in the protocol?** If we default to 27015 when no port is provided, we maintain backward compatibility with the original refactor doc's `HLXTOKEN:<token> <logline>` format. However, this means servers on non-standard ports won't work without the port in the prefix. **Recommendation:** Make port required in the plugin but handle missing port gracefully in the daemon (default 27015 + log a warning).

2. **Should the token creation UI allow empty RCON passwords?** Some operators may want token auth without RCON (log ingestion only, no server monitoring). **Recommendation:** Allow empty RCON password with a warning: "RCON will be unavailable for servers using this token until an RCON password is set per-server."

3. **Should per-server RCON password changes propagate back to the token?** If an admin updates a server's RCON password, should it update the token's default? **Recommendation:** No -- the token's RCON password is a default for new auto-registrations. Per-server overrides are independent.

4. **Docker server auto-registration:** For Docker deployments, the `connectionType` and `dockerHost` fields are needed for RCON to route correctly. Should the token also carry these? **Recommendation:** Not in Phase 1. Docker operators can use legacy auth mode or update the auto-registered server record manually. Revisit if Docker auto-registration demand materializes.
