# Next.js v16 Engineering Review — auth-architecture

## Scope

This review covers the authentication architecture across the monorepo, focusing on:

1. **The `/admin/tokens/add` token creation bug** — `CombinedGraphQLErrors: Authentication required`
2. **Architectural question #1**: How should the web app communicate with GraphQL (auth, access control, API abuse)?
3. **Architectural question #2**: GraphQL API layer vs direct Prisma access — is the GraphQL layer justified? **Decision: Yes — keep GraphQL as the single data access layer. Server actions call GraphQL, not Prisma directly.**

## Repo/System context

| Property        | Value                                                     |
| --------------- | --------------------------------------------------------- |
| Framework       | Next.js ^16.1.6 (App Router, Turbopack)                   |
| Auth library    | Better Auth v1.4.18 (database sessions, Prisma adapter)   |
| GraphQL         | GraphQL Yoga + Pothos schema builder                      |
| DB              | MySQL 8.4 via Prisma v7 (MariaDB adapter)                 |
| Monorepo        | Turborepo + pnpm workspaces                               |
| Apps            | `apps/web` (Next.js), `apps/api` (GraphQL), `apps/daemon` |
| Shared packages | `@repo/auth`, `@repo/db`, `@repo/crypto`                  |
| Docker (dev)    | MySQL, RabbitMQ, Garnet (Redis), Prometheus, Grafana      |

### Critical auth flow path

```
Browser → proxy.ts (session cookie check) → Page render
         → Server Action (createToken)
           → getSession() via Better Auth (reads cookie from Next.js headers())
           → getClient().mutate() — Apollo HTTP request to GraphQL API
             → Cookie forwarded via custom fetch in apollo-client.ts
               → GraphQL Yoga receives request
                 → createContext() calls auth.api.getSession({ headers: request.headers })
                   → Better Auth decodes session cookie using BETTER_AUTH_SECRET
                     → requireAdmin(context) checks session.user.role === "admin"
```

## Measurement methodology (DevTools)

| Tool                 | Status    | Notes                                                    |
| -------------------- | --------- | -------------------------------------------------------- |
| `nextjs_index`       | Connected | Dev server on port 3000 with 6 MCP tools                 |
| `nextjs_call/errors` | Clean     | "No errors detected in 1 browser session(s)."            |
| `nextjs_call/routes` | Captured  | 26 app routes including `/admin/tokens/add`              |
| Better Auth docs     | Queried   | Via MCP tool                                             |
| Next.js v16 docs     | Queried   | proxy.js, authentication, BFF, data-security, use-server |

## Baseline results

| Metric                                  | Value                                                          |
| --------------------------------------- | -------------------------------------------------------------- |
| Dev server errors                       | 0                                                              |
| Token creation result                   | `CombinedGraphQLErrors: Authentication required`               |
| `BETTER_AUTH_SECRET` in `apps/web/.env` | Set (Gpx++...)                                                 |
| `BETTER_AUTH_SECRET` in `apps/api/.env` | **MISSING**                                                    |
| `BETTER_AUTH_URL` in `apps/api/.env`    | **MISSING**                                                    |
| Apollo server-side cookie forwarding    | Implemented correctly                                          |
| Apollo client-side `credentials`        | **NOT configured** (no `credentials: "include"`)               |
| GraphQL CORS `credentials`              | true                                                           |
| GraphQL API externally exposed?         | Yes — port 4000 on localhost (dev); not exposed in Docker prod |
| Query-level auth gating in GraphQL      | Mutations only (queries are public)                            |

---

## Findings

### F-001: CRITICAL — `BETTER_AUTH_SECRET` missing from GraphQL API environment

**Summary**: The GraphQL API server (`apps/api`) does not have `BETTER_AUTH_SECRET` set in its `.env` file. Since the API imports `auth` from `@repo/auth` and calls `auth.api.getSession()`, Better Auth cannot decode session cookies signed by the web app. This is the **root cause** of the `Authentication required` error.

**Evidence**:

- `apps/api/.env` (lines 1–19): No `BETTER_AUTH_SECRET` or `BETTER_AUTH_URL` present.
- `apps/web/.env` (line 14): `BETTER_AUTH_SECRET="Gpx++qJGvkXHJUUKieios6QDN22Vzf91WvI0dX/7n+w="` is set.
- `apps/api/src/context.ts` (line 72): `auth.api.getSession({ headers: request.headers })` — this creates the `auth` instance from `@repo/auth`, which reads `BETTER_AUTH_SECRET` from env.
- Better Auth documentation confirms: when `BETTER_AUTH_SECRET` is missing, it falls back to `"better-auth-secret-123456789"` in dev. Since the web app signs cookies with the real secret, the API server can never decode them because the secrets don't match.

**Next.js best-practice**: N/A (Better Auth library issue, not Next.js). Better Auth docs: https://www.better-auth.com/docs/reference/options

**Proposed change**: Add `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` to `apps/api/.env` with the same values as `apps/web/.env`:

```env
BETTER_AUTH_SECRET="Gpx++qJGvkXHJUUKieios6QDN22Vzf91WvI0dX/7n+w="
BETTER_AUTH_URL=http://localhost:3000
```

**Risk/complexity**: Minimal — env var addition only.

**Expected impact**: Fixes the token creation bug immediately. All authenticated GraphQL mutations will start working.

---

### F-002: HIGH — Client-side Apollo Client lacks `credentials: "include"`

**Summary**: The browser-side Apollo Client (`apps/web/src/lib/apollo-wrapper.tsx`) does not set `credentials: "include"` on its HTTP link. Any client-side GraphQL queries/mutations (e.g., `useQuery`, `useMutation` from `"use client"` components) will not send session cookies to the API.

**Evidence**:

- `apps/web/src/lib/apollo-wrapper.tsx` (lines 20–21): `new HttpLink({ uri: "http://localhost:4000/graphql" })` — no `credentials` option.
- The server-side client (`apps/web/src/lib/apollo-client.ts`) correctly forwards cookies via a custom `fetch` function.
- The GraphQL Yoga server has `credentials: true` in CORS config (`apps/api/src/index.ts`, line 19).

**Next.js best-practice**: https://nextjs.org/docs/app/guides/data-security (External HTTP APIs section — "follow a Zero Trust model... pass authentication tokens/cookies from Server Components")

**Proposed change**:

```typescript
const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql",
  credentials: "include",
})
```

**Risk/complexity**: Low. One-line change.

**Expected impact**: Client-side GraphQL operations will be authenticated. Required for any future `useQuery`/`useMutation` calls from client components.

---

### F-003: HIGH — GraphQL queries are completely unauthenticated

**Summary**: All GraphQL query resolvers (`findManyServerToken`, `countServerToken`, `findServerToken`) have no authentication checks. Only mutations call `requireAdmin(context)`. This means anyone who can reach the API can read all server tokens (minus the hash), player data, server configs, etc.

**Evidence**:

- `apps/api/src/modules/server-token/server-token.resolver.ts` (lines 151–194): `findManyServerToken`, `countServerToken`, and `findServerToken` queries have no auth checks.
- `apps/api/src/context.ts` (line 72): `createContext()` sets `session` to null if no valid cookie — queries proceed with null session.

**Next.js best-practice**: https://nextjs.org/docs/app/guides/authentication (Server Actions section — "Treat Server Actions with the same security considerations as public-facing API endpoints")

**Proposed change**: Add `requireAuth(context)` or `requireAdmin(context)` to sensitive query resolvers. Consider a two-tier model:

- Public queries (games list, public server info) → no auth
- Admin queries (tokens, user management) → `requireAdmin(context)`

**Risk/complexity**: Medium — requires reviewing each query resolver and deciding public vs admin.

**Expected impact**: Prevents unauthorized data access to admin-only resources.

---

### F-004: MEDIUM — Architectural analysis: Web-to-GraphQL communication pattern

**Summary**: The current architecture uses Next.js server actions as a BFF (Backend for Frontend) that forwards session cookies to the GraphQL API. This is a valid pattern but has inherent complexity around cookie forwarding.

**Evidence**:

- `apps/web/src/lib/apollo-client.ts` (lines 17–31): Custom `fetch` that reads `headers()` and forwards cookies.
- `apps/web/src/features/admin/tokens/actions/create-token.ts` (lines 50–62): Server action calls `getClient().mutate()`.
- The cookie forwarding chain: Browser → Next.js → `headers()` → Apollo `fetch` → GraphQL API → Better Auth.
- F-001 demonstrates how fragile this chain is — one missing env var breaks all auth.

**Next.js best-practice**:

- https://nextjs.org/docs/app/guides/backend-for-frontend (Proxying to a backend — "You can use a Route Handler as a proxy to another backend")
- https://nextjs.org/docs/app/guides/data-security (External HTTP APIs — "continue calling your existing API endpoints... just as you would in Client Components")
- https://nextjs.org/docs/app/guides/authentication (Server Actions — "Always authenticate and authorize users before performing sensitive server-side operations")

**Analysis of the user's questions**:

**Q1: How should the web app communicate with GraphQL?**

The current approach (server-side cookie forwarding) is architecturally sound and matches the Next.js "External HTTP APIs" data-fetching pattern. However, there are two viable strategies:

| Strategy                                                        | Pros                                                                        | Cons                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **A. Current: Cookie forwarding**                               | Standard web auth, session stays in HTTP-only cookie, works across services | Fragile (F-001), requires CORS + credentials on both sides, extra network hop |
| **B. Hybrid: Direct Prisma for internal, GraphQL for external** | No auth forwarding needed for internal calls, faster, simpler               | Two data access patterns to maintain, codegen benefits reduced                |

For **API abuse protection**: The GraphQL API on port 4000 is not exposed in Docker prod (no port mapping). This means only services on the internal Docker network can reach it. This is sufficient network-level protection. However, in development, port 4000 is wide open on localhost. Consider:

- Rate limiting via Better Auth (already configured at 100 req/60s)
- Depth/complexity limiting in GraphQL Yoga
- Auth-required queries for sensitive data (F-003)

**Q2: GraphQL API vs direct Prisma?**

The GraphQL API layer is **justified** for these reasons:

1. **External consumers**: Admins and developers get a self-documenting, typed API with GraphiQL
2. **Daemon integration**: The game server daemon needs API access (it runs as a separate process)
3. **Separation of concerns**: Business logic lives in service classes, not scattered across Next.js routes
4. **Type safety**: Codegen generates client-side types from the schema

However, for **internal server-side operations** (server actions, server components), you could optionally use Prisma directly via `@repo/db` — bypassing GraphQL entirely. This eliminates the cookie-forwarding complexity for server-side mutations.

**Proposed change**: No immediate architectural change needed. Fix F-001 to unblock current auth flow. Consider F-005 for a longer-term simplification.

**Risk/complexity**: Informational finding. No change required.

**Expected impact**: Clarifies architectural direction.

---

### ~~F-005~~ — REMOVED: Direct Prisma access for server actions

**Status**: Rejected by project owner. Architectural decision: all data access goes through GraphQL. Server actions call GraphQL exclusively. This maintains a single data access layer and benefits external consumers (admins, devs, daemon).

**Cookie forwarding validated**: Research confirms three viable patterns for server action → external API auth: (1) cookie forwarding, (2) service-to-service trust tokens, (3) bearer token exchange. Cookie forwarding is the correct choice here because both services share the same Better Auth secret and database, allowing the API to natively validate the same session cookie with zero additional infrastructure.

---

### F-006: LOW — Client-side Apollo URI is hardcoded

**Summary**: The client-side Apollo Client uses a hardcoded URL `http://localhost:4000/graphql` instead of the `NEXT_PUBLIC_GRAPHQL_URL` env var.

**Evidence**:

- `apps/web/src/lib/apollo-wrapper.tsx` (line 21): `uri: "http://localhost:4000/graphql"` — hardcoded.
- `apps/web/src/lib/apollo-client.ts` (line 9): `process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql"` — correctly uses env var.

**Next.js best-practice**: https://nextjs.org/docs/app/guides/environment-variables (NEXT*PUBLIC* prefix exposes to client)

**Proposed change**:

```typescript
const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql",
  credentials: "include",
})
```

**Risk/complexity**: Trivial.

**Expected impact**: Enables deployment to non-localhost environments.

---

### F-007: LOW — proxy.ts uses lightweight cookie-check, not session validation

**Summary**: The Next.js proxy file (`proxy.ts`) checks for the presence of a session cookie but doesn't validate it. This is acceptable for an optimistic check per Next.js guidance, but the check should match the cookie name Better Auth actually sets.

**Evidence**:

- `apps/web/src/proxy.ts` (line 9): `getSessionCookie(request)` — checks for Better Auth cookie existence.
- This re-exports from `better-auth/cookies`, which is the correct lightweight check.

**Next.js best-practice**: https://nextjs.org/docs/app/guides/authentication#optimistic-checks-with-proxy-optional ("Since Proxy runs on every route... only read the session from the cookie (optimistic checks), and avoid database checks to prevent performance issues")

**Analysis**: This is correctly implemented. The proxy performs an optimistic cookie-presence check and redirects to `/login` if missing. Actual auth validation happens in server actions and the GraphQL API. No change needed.

**Risk/complexity**: None.

**Expected impact**: Informational — confirms proxy.ts is correctly implemented.

---

## Phased to-do plan

### P0: Critical fix (unblocks auth immediately) — DONE

- [x] **T-001** (F-001): Add `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` to `apps/api/.env` — **DONE** (manually applied by owner)
  - **Docs**: https://www.better-auth.com/docs/reference/options

### P1: Quick wins (low effort, high impact) — DONE

- [x] **T-002** (F-002): Add `credentials: "include"` to client-side Apollo Client — **DONE**
  - File: `apps/web/src/lib/apollo-wrapper.tsx`
  - Also use `NEXT_PUBLIC_GRAPHQL_URL` env var (F-006)
  - Added `credentials: "include"` and `process.env.NEXT_PUBLIC_GRAPHQL_URL` fallback
  - Typecheck: pass | Runtime errors: 0
  - **Docs**: https://nextjs.org/docs/app/guides/data-security

- [x] **T-003** (F-003): Add auth checks to sensitive GraphQL queries — **DONE**
  - Review all query resolvers and classify as public or admin-only
  - Add `requireAuth(context)` or `requireAdmin(context)` to admin-only queries
  - Token queries should require admin: `findManyServerToken`, `countServerToken`, `findServerToken`
  - Added `requireAdmin(context)` to all 3 token query resolvers
  - Player queries (getPlayers, getServerPlayers, getPlayerById) remain public — game stats are public data
  - Health query remains public — monitoring endpoint
  - Auto-generated CRUD queries remain unguarded (public server/game data; admin layout enforces access on web side)
  - Typecheck: pass | Runtime errors: 0
  - **Docs**: https://nextjs.org/docs/app/guides/authentication

### P2: Architectural improvements — DONE

- [x] **T-004** (F-004): Document the auth architecture — **DONE**
  - Created `docs/architecture/auth-flow.md` documenting cookie-forwarding chain, auth check levels, query classification, and env var requirements
  - Updated `apps/web/env.example` to include `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`
  - Cleaned up `apps/api/env.example` (removed outdated JWT placeholder)
  - **Docs**: https://nextjs.org/docs/app/guides/backend-for-frontend

- ~~**T-005**~~ (F-005): ~~Evaluate direct Prisma access for server actions~~ — **REJECTED** (architectural decision: GraphQL is the single data access layer)

### P3: Deeper/optional hardening

- [ ] **T-006** (F-003): Add GraphQL depth/complexity limiting
  - GraphQL Yoga supports depth limiting plugins
  - Prevents abuse via deeply nested queries
  - **Docs**: https://nextjs.org/docs/app/guides/backend-for-frontend (Rate limiting section)

- [ ] **T-007**: Add API key authentication for external GraphQL consumers
  - When the API is exposed externally, support API key auth in addition to session cookies
  - Useful for daemon connections and third-party integrations
  - **Docs**: N/A (custom implementation)

---

## Open questions / follow-ups

1. **Shared secret management**: Currently `BETTER_AUTH_SECRET` needs to be duplicated across `apps/web/.env` and `apps/api/.env`. Should this be a root-level env var loaded by both apps (e.g., via a shared `.env` file or Docker env injection)?

2. **Daemon auth**: How does the daemon (`apps/daemon`) authenticate with the GraphQL API? If it uses server tokens (not session cookies), the token-based auth flow in the daemon should be reviewed separately.

3. **Production GraphQL exposure**: In Docker production, is the GraphQL API port (4000) exposed externally, or only on the internal Docker network? If internal-only, F-003 is lower priority. If exposed, F-003 and T-006 become critical.
