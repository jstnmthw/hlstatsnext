# HLStatsNext.com — Adversarial Security Assessment

**Report Date:** 2026-02-22
**Classification:** Confidential
**Assessor:** Red Team (Automated Code Review)
**Scope:** Full monorepo — `apps/web`, `apps/api`, `apps/daemon`, all `packages/*`

---

## Executive Summary

The HLStatsNext.com codebase exhibits **strong cryptographic fundamentals** (Argon2id, AES-256-GCM, SHA-256 token hashing) and good security practices in its custom resolvers and server actions. However, **the system has a critical architectural vulnerability**: an auto-generated GraphQL CRUD layer that exposes full read/write access to **all database models** — including `User`, `Session`, `Account`, and `Verification` — **without any authentication or authorization checks**. This single issue enables complete account takeover, privilege escalation, session hijacking, and credential theft.

Additionally, sensitive fields (OAuth tokens, hashed passwords, RCON passwords, session tokens) are exposed via the auto-generated schema objects, and the GraphQL endpoint lacks depth limiting, complexity analysis, rate limiting, and production introspection controls.

**Risk Posture: HIGH** — Multiple P0/P1 findings require immediate remediation before production deployment.

---

## Attack Surface Overview

| Surface                              | Exposure           | Trust Boundary                                |
| ------------------------------------ | ------------------ | --------------------------------------------- |
| GraphQL API (`:4000/graphql`)        | Public internet    | Unauthenticated by default; per-resolver auth |
| Next.js Web (`:3000`)                | Public internet    | Cookie-based session; proxy middleware        |
| Better Auth API (`:3000/api/auth/*`) | Public internet    | Built-in rate limiting                        |
| UDP Daemon (`:27500`)                | Network-accessible | Token-based beacon auth                       |
| RabbitMQ Management (`:15672`)       | Network-accessible | Default credentials                           |
| Prometheus (`:9090`)                 | Network-accessible | No authentication                             |
| Grafana (`:3001`)                    | Network-accessible | Default `admin/admin`                         |
| Garnet/Redis (`:6379`)               | Network-accessible | No authentication                             |

**Inter-service communication paths:**

```
Browser ──HTTPS──▶ Next.js (:3000) ──HTTP+cookies──▶ GraphQL API (:4000) ──Prisma──▶ MySQL (:3306)
                        │                                    │
                        ▼                                    ▼
                 Better Auth                          Prisma ORM (shared DB)
                 (cookie sessions)

Game Servers ──UDP──▶ Daemon (:27500) ──Prisma──▶ MySQL (:3306)
                           │
                           ▼
                      RabbitMQ (:5672)

Prometheus (:9090) ──scrape──▶ Daemon metrics (:3001)
                   ──scrape──▶ RabbitMQ metrics
```

---

## Findings

---

### RT-001: Unauthenticated CRUD on Auth-Critical Models

**Severity:** P0 — Critical
**Confidence:** High
**CWE:** CWE-862 (Missing Authorization)
**OWASP:** A01:2021 Broken Access Control

**Impact:** Complete system compromise. An attacker can create admin users, read/delete all sessions, extract OAuth tokens and password hashes, forge verification records, and achieve full account takeover — all without authentication.

**Evidence:**

`apps/api/src/pothos-schema.ts:14`:

```typescript
generateAllCrud({ exclude: ["ServerToken"] })
```

Only `ServerToken` is excluded. The function at `packages/db/generated/graphql/pothos-inputs/autocrud.ts:1112-1116` registers queries and mutations for all other models. The generated resolvers pass `_context` but **never call `requireAuth()` or `requireAdmin()`**.

Models with full unauthenticated CRUD:

| Model            | Lines in autocrud.ts | Critical Operations                               |
| ---------------- | -------------------- | ------------------------------------------------- |
| **User**         | 932-948              | `createOneUser`, `updateOneUser`, `deleteOneUser` |
| **Session**      | 950-966              | `createOneSession`, `findManySession`             |
| **Account**      | 968-984              | `findManyAccount`, `createOneAccount`             |
| **Verification** | 986-1002             | `createOneVerification`                           |
| **Server**       | 824-840              | `createOneServer`, `updateOneServer`              |

**Exploit Scenario:**

1. Attacker queries `findManyAccount` to extract all OAuth tokens and password hashes
2. Attacker sends `updateOneUser` mutation to set any user's `role` to `"admin"`
3. Attacker sends `createOneSession` to forge a valid session for any user
4. Attacker sends `createOneVerification` to bypass email verification
5. Full account takeover and privilege escalation achieved

**Remediation:**

- Exclude `User`, `Session`, `Account`, `Verification` from `generateAllCrud()` entirely
- Use the `handleResolver` callback to inject `requireAdmin(context)` on all remaining mutations:

```typescript
generateAllCrud({
  exclude: ["ServerToken", "User", "Session", "Account", "Verification"],
  handleResolver: ({ field, type, modelName, operationName, t }) => {
    const originalResolve = field.resolve
    return {
      ...field,
      resolve: (query, root, args, context, info) => {
        if (type === "Mutation") requireAdmin(context)
        return originalResolve(query, root, args, context, info)
      },
    }
  },
})
```

---

### RT-002: Sensitive Credential Fields Exposed via GraphQL Schema

**Severity:** P0 — Critical
**Confidence:** High
**CWE:** CWE-200 (Exposure of Sensitive Information)
**OWASP:** A01:2021 Broken Access Control

**Impact:** Even if authentication were added to CRUD resolvers, the auto-generated GraphQL schema objects expose sensitive fields that should never be queryable.

**Evidence:**

`packages/db/generated/graphql/pothos-inputs/Account/object.base.ts`:

```typescript
// Lines 19-25 — OAuth tokens and password exposed
accessToken: t.field(AccountAccessTokenFieldObject),   // Line 19
refreshToken: t.field(AccountRefreshTokenFieldObject),  // Line 20
idToken: t.field(AccountIdTokenFieldObject),            // Line 24
password: t.field(AccountPasswordFieldObject),          // Line 25
```

`packages/db/generated/graphql/pothos-inputs/Session/object.base.ts:17`:

```typescript
token: t.field(SessionTokenFieldObject), // Session bearer token
```

`packages/db/generated/graphql/pothos-inputs/Server/object.base.ts:23`:

```typescript
rconPassword: t.field(ServerRconPasswordFieldObject), // AES-encrypted RCON password
```

`packages/db/generated/graphql/pothos-inputs/EventRcon/object.base.ts:21`:

```typescript
password: t.field(EventRconPasswordFieldObject), // Plaintext RCON password in event log
```

**Exploit Scenario:**

```graphql
query {
  findManyAccount {
    userId
    password
    accessToken
    refreshToken
    idToken
  }
  findManySession {
    userId
    token
    ipAddress
    userAgent
  }
}
```

Returns all credentials and session tokens in a single unauthenticated query.

**Remediation:**

Remove sensitive fields from auto-generated Pothos object definitions. The custom `ServerToken` resolver pattern (stripping `rconPassword` and `tokenHash` before returning) is the correct approach — apply it to all models with sensitive fields.

---

### RT-003: No GraphQL Query Depth Limiting, Complexity Analysis, or Rate Limiting

**Severity:** P1 — High
**Confidence:** High
**CWE:** CWE-770 (Allocation of Resources Without Limits)
**OWASP:** A04:2021 Insecure Design

**Impact:** Denial-of-service via deeply nested queries, batch data exfiltration, and resource exhaustion.

**Evidence:**

`apps/api/src/index.ts:10-21` — Yoga server created with no protective plugins:

```typescript
const yoga = createYoga({
  schema,
  landingPage: false,
  graphqlEndpoint: "/graphql",
  graphiql: process.env.NODE_ENV !== "production",
  context: createContext,
  cors: {
    origin:
      process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL : "http://localhost:3000",
    credentials: true,
  },
  // No: depthLimit, queryComplexity, rateLimiting
})
```

The auto-generated schema includes bidirectional relations (User → Sessions → User → Accounts → User...) enabling infinite nesting:

```graphql
query DoS {
  findManyUser {
    sessions { user { sessions { user { sessions { user {
      accounts { user { sessions { user { ... } } } }
    } } } } } }
  }
}
```

**Remediation:**

```typescript
import { useQueryDepthLimit } from "@escape.tech/graphql-armor-query-depth-limit"

const yoga = createYoga({
  plugins: [
    useQueryDepthLimit({ n: 7 }),
    // Add rate limiting and complexity analysis
  ],
})
```

---

### RT-004: GraphQL Introspection Not Disabled in Production

**Severity:** P1 — High
**Confidence:** High
**CWE:** CWE-200 (Exposure of Sensitive Information)
**OWASP:** A05:2021 Security Misconfiguration

**Impact:** Attackers can discover the entire schema — all models, fields, relationships, and mutations — significantly accelerating exploitation of RT-001 and RT-002.

**Evidence:**

`apps/api/src/index.ts:14` disables GraphiQL but not introspection:

```typescript
graphiql: process.env.NODE_ENV !== "production",
```

GraphQL Yoga enables introspection by default. No `useDisableIntrospection` plugin is present. No `maskedErrors` configuration found anywhere in `apps/api`.

**Remediation:**

```typescript
import { useDisableIntrospection } from "@graphql-yoga/plugin-disable-introspection"

const yoga = createYoga({
  plugins: process.env.NODE_ENV === "production" ? [useDisableIntrospection()] : [],
  maskedErrors: process.env.NODE_ENV === "production",
})
```

---

### RT-005: Missing Security Headers

**Severity:** P1 — High
**Confidence:** High
**CWE:** CWE-693 (Protection Mechanism Failure)
**OWASP:** A05:2021 Security Misconfiguration

**Impact:** Clickjacking, MIME-type sniffing, missing HSTS allows protocol downgrade attacks.

**Evidence:**

`apps/web/next.config.ts` — No `headers()` configuration:

```typescript
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
}
```

`apps/web/src/proxy.ts` — Middleware only handles admin redirect, no security headers.

No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, or `Referrer-Policy` found anywhere in the codebase.

**Remediation:**

Add to `apps/web/next.config.ts`:

```typescript
async headers() {
  return [{
    source: "/(.*)",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ],
  }]
},
```

---

### RT-006: Default Credentials in Infrastructure Services

**Severity:** P1 — High (in production deployment)
**Confidence:** High
**CWE:** CWE-798 (Use of Hard-coded Credentials)
**OWASP:** A07:2021 Identification and Authentication Failures

**Impact:** If these services are network-reachable, attackers gain full control of message queue, monitoring, and cache layer.

**Evidence:**

`docker/rabbitmq/rabbitmq.conf:29-31`:

```
default_user = hlstats
default_pass = hlstats
default_permissions.configure = .*
default_permissions.read = .*
default_permissions.write = .*
```

Root `.env:46-47`:

```
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
```

Garnet/Redis on port 6379 — no `--requirepass` or authentication configured in `docker-compose.yml`.

RabbitMQ Management UI binds to `0.0.0.0:15672` (`rabbitmq.conf:16`).

**Remediation:**

- Generate strong, unique passwords for all infrastructure services
- Restrict management UIs to localhost or internal network
- Enable Redis/Garnet `requirepass`
- Use environment-specific credentials (never share dev/prod)

---

### RT-007: Proxy Middleware Checks Cookie Presence, Not Validity

**Severity:** P2 — Moderate
**Confidence:** High
**CWE:** CWE-287 (Improper Authentication)
**OWASP:** A07:2021 Identification and Authentication Failures

**Impact:** Admin pages render initial HTML before the layout's server-side session check redirects. An attacker with any cookie value sees a brief flash of admin UI structure before redirect.

**Evidence:**

`apps/web/src/proxy.ts:9`:

```typescript
if (pathname.startsWith("/admin") && !getSessionCookie(request)) {
  return NextResponse.redirect(new URL("/login", request.url))
}
```

This checks if a session cookie _exists_, not if it's valid. The admin layout at `apps/web/src/app/(admin)/layout.tsx` performs real session validation:

```typescript
const session = await getSession()
if (!session) redirect("/login")
if (session.user.role !== "admin") redirect("/")
```

Defense-in-depth is present but the middleware layer provides a false sense of security.

**Remediation:** Either validate the session in middleware (costlier, requires DB hit) or document this as intentional defense-in-depth. The layout guard is the actual security boundary.

---

### RT-008: RCON Password Stored in Plaintext in EventRcon Table

**Severity:** P2 — Moderate
**Confidence:** High
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information)
**OWASP:** A02:2021 Cryptographic Failures

**Impact:** Historical RCON passwords stored in plaintext in the `EventRcon` database table and exposed via auto-generated GraphQL queries. RCON access enables arbitrary command execution on game servers.

**Evidence:**

Prisma schema `EventRcon` model:

```prisma
password String @default("") @db.VarChar(128)
```

Auto-generated GraphQL object (`packages/db/generated/graphql/pothos-inputs/EventRcon/object.base.ts:21`):

```typescript
password: t.field(EventRconPasswordFieldObject),
```

Resolver (`object.base.ts:73`):

```typescript
resolve: (parent) => parent.password,
```

This is queryable via `findManyEventRcon { password }` without authentication (per RT-001).

**Remediation:**

- Stop storing RCON passwords in event logs (log the event without the credential)
- Remove the `password` field from the EventRcon GraphQL object
- Scrub existing data in the database

---

### RT-009: UDP Packet Size Not Limited

**Severity:** P2 — Moderate
**Confidence:** Medium
**CWE:** CWE-400 (Uncontrolled Resource Consumption)
**OWASP:** A04:2021 Insecure Design

**Impact:** Memory exhaustion via oversized UDP packets sent to the ingress port.

**Evidence:**

`apps/daemon/src/modules/ingress/udp-server.ts:54-66`:

```typescript
this.socket.on("message", (buffer, rinfo) => {
  const logLine = buffer.toString("utf8").trim()
  if (logLine) {
    const payload: LogPayload = {
      logLine, // No length check
      serverAddress: rinfo.address,
      serverPort: rinfo.port,
      timestamp: new Date(),
    }
    this.emit("logReceived", payload)
  }
})
```

No maximum length check before converting buffer to string and emitting for processing.

**Remediation:**

```typescript
this.socket.on("message", (buffer, rinfo) => {
  if (buffer.length > 4096) return // Standard game log lines are < 512 bytes
  // ...
})
```

---

### RT-010: Race Condition in Server Auto-Registration

**Severity:** P2 — Moderate
**Confidence:** Medium
**CWE:** CWE-362 (Concurrent Execution Using Shared Resource with Improper Synchronization)
**OWASP:** A04:2021 Insecure Design

**Impact:** Duplicate server records created when concurrent beacons arrive with the same token before either is committed.

**Evidence:**

`apps/daemon/src/modules/ingress/adapters/token-server-authenticator.ts` — `findOrRegisterServer` performs a non-atomic read-check-write:

```typescript
const existing = await this.database.prisma.server.findFirst({...})
if (existing) {
  // Update if changed ...
  return { kind: "authenticated", serverId: existing.serverId }
}
// RACE: Two concurrent calls both reach here
const newServer = await this.database.prisma.server.create({...})
```

**Remediation:** Add a unique database constraint on `(authTokenId, port)` and handle constraint violations as a successful lookup (upsert pattern).

---

### RT-011: Beacon Parsing Fallback Allows Data Injection

**Severity:** P2 — Moderate
**Confidence:** Medium
**CWE:** CWE-20 (Improper Input Validation)
**OWASP:** A03:2021 Injection

**Impact:** Malformed beacon payloads that fail port parsing fall back to being treated as game log lines, potentially injecting attacker-controlled data into the event processing pipeline if the source IP is already authenticated.

**Evidence:**

`apps/daemon/src/modules/ingress/utils/token-extractor.ts:28-61`:

```typescript
const lastColon = payload.lastIndexOf(":")
if (lastColon === -1 || lastColon === payload.length - 1) {
  return { kind: "beacon", token: payload, gamePort: 27015 } // Fallback port
}
const token = payload.slice(0, lastColon)
const portStr = payload.slice(lastColon + 1)
const gamePort = parseInt(portStr, 10)

if (token.length === 0 || isNaN(gamePort) || gamePort < 1 || gamePort > 65535) {
  return { kind: "log_line", logLine: rawLine } // Reverts to log line!
}
```

A payload like `HLXTOKEN:crafted_data:not_a_port` reverts to `log_line` processing.

**Remediation:** Validate beacon format strictly. Reject ambiguous payloads entirely rather than falling back to log line processing.

---

### RT-012: MaxMind API Key in Repository

**Severity:** P2 — Moderate
**Confidence:** High
**CWE:** CWE-798 (Use of Hard-coded Credentials)
**OWASP:** A07:2021 Identification and Authentication Failures

**Impact:** Third-party API key abuse, quota exhaustion, potential billing impact.

**Evidence:**

`packages/db/.env:9-10`:

```
MAXMIND_ACCOUNT_ID=<redacted>
MAXMIND_LICENSE_KEY=<redacted>
```

While `.env` is in `.gitignore`, if this file was ever committed or the repository is shared, the key is exposed. Verify with `git log -p -- packages/db/.env`.

**Remediation:** Rotate the MaxMind API key immediately. Use a secrets manager for all API credentials.

---

### RT-013: Static PBKDF2 Salt for AES Key Derivation

**Severity:** P3 — Low
**Confidence:** High
**CWE:** CWE-916 (Use of Password Hash With Insufficient Computational Effort)

**Impact:** All AES encryption operations derive the same key from the master key since the salt is a constant string. The 10,000 PBKDF2 iteration count is below modern recommendations.

**Evidence:**

`packages/crypto/src/encryption.ts`:

```typescript
const encryptionKey = pbkdf2Sync(this.masterKey, "aes-encryption", 10000, 32, "sha256")
```

The salt `"aes-encryption"` is static, making the derived key deterministic from the master key alone.

**Remediation:** Partially mitigated by unique random IVs per encryption and GCM authentication tags. Increase PBKDF2 iterations to 100,000+ if the derived key is not cached. Consider deriving per-record keys with unique salts.

---

### RT-014: No Audit Logging

**Severity:** P3 — Low
**Confidence:** High
**CWE:** CWE-778 (Insufficient Logging)
**OWASP:** A09:2021 Security Logging and Monitoring Failures

**Impact:** No forensic trail for authentication events, admin actions, or authorization failures. Incident response and breach detection are impaired.

**Evidence:** No audit log table in Prisma schema. No structured logging of:

- Authentication success/failure
- Role changes
- Token creation/revocation
- Data modifications via admin mutations

**Remediation:** Implement an audit log table and emit structured events for all security-relevant operations. At minimum, log authentication events, privilege changes, and administrative mutations.

---

### RT-015: Prometheus Metrics Endpoint Unauthenticated

**Severity:** P3 — Low
**Confidence:** High
**CWE:** CWE-200 (Exposure of Sensitive Information)
**OWASP:** A05:2021 Security Misconfiguration

**Impact:** Internal operational metrics (queue depths, connection counts, resource usage) exposed to anyone who can reach port 9090 or daemon metrics port 3001.

**Evidence:**

`docker/prometheus/prometheus.yml` — Scrapes daemon and RabbitMQ metrics with no authentication. `apps/daemon/Dockerfile` exposes port 3001 for metrics.

```yaml
scrape_configs:
  - job_name: "daemon"
    static_configs:
      - targets: ["daemon:3001"]
```

**Remediation:** Restrict metrics endpoints to internal network via firewall rules or Docker network isolation. Add authentication proxy for Prometheus and Grafana if externally accessible.

---

## Positive Security Findings

| Area                      | Implementation                                              | Assessment |
| ------------------------- | ----------------------------------------------------------- | ---------- |
| Password hashing          | Argon2id (65536 KiB memory, time cost 3, parallelism 4)     | Excellent  |
| Data encryption           | AES-256-GCM with 12-byte random IV per operation            | Excellent  |
| Token storage             | SHA-256 hash only; raw token never persisted                | Excellent  |
| Token generation          | `crypto.randomBytes(32)` — 256-bit entropy                  | Excellent  |
| Server Actions            | All check `getSession()` + `userHasPermission()`            | Good       |
| Input validation          | Zod schemas on all admin forms with IP/port/URL validators  | Good       |
| XSS prevention            | No `dangerouslySetInnerHTML`; React automatic escaping      | Good       |
| CSRF                      | Next.js Server Actions built-in protection                  | Good       |
| Custom resolvers          | `requireAdmin()` on ServerToken and Server mutations        | Good       |
| RCON in custom resolvers  | Stripped from responses before returning to client          | Good       |
| Client-side secrets       | No private keys exposed via `NEXT_PUBLIC_*` variables       | Good       |
| Better Auth rate limiting | 3 req/60s on signup, OTP, password reset; 100/60s global    | Good       |
| Daemon auth               | Token-based beacon with 10-attempt rate limit per source IP | Good       |
| Redirect safety           | All redirects use hardcoded paths or `encodeURIComponent()` | Good       |
| No file uploads           | Attack surface minimized; no upload handling exists         | Good       |

---

## Summary

| Severity          | Count | Findings                                       |
| ----------------- | ----- | ---------------------------------------------- |
| **P0 — Critical** | 2     | RT-001, RT-002                                 |
| **P1 — High**     | 4     | RT-003, RT-004, RT-005, RT-006                 |
| **P2 — Moderate** | 6     | RT-007, RT-008, RT-009, RT-010, RT-011, RT-012 |
| **P3 — Low**      | 3     | RT-013, RT-014, RT-015                         |

## Remediation Priority

### Immediate — Before Any Production Deployment

1. **RT-001** — Lock down auto-generated CRUD (exclude auth models, add `handleResolver` auth middleware)
2. **RT-002** — Remove sensitive fields from auto-generated GraphQL objects

### This Week

3. **RT-003** — Add query depth limit and rate limiting to GraphQL endpoint
4. **RT-004** — Disable introspection in production, enable masked errors
5. **RT-005** — Add security headers to Next.js config

### Before Production

6. **RT-006** — Replace all default infrastructure credentials with strong unique passwords
7. **RT-008** — Stop logging RCON passwords in EventRcon table
8. **RT-012** — Rotate MaxMind API key, verify not in git history

### Near-Term Hardening

9. **RT-007 through RT-015** — Defense-in-depth improvements as capacity allows
