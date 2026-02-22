# Authentication Architecture

## Overview

HLStatsNext uses **Better Auth** (database sessions, Prisma adapter) for authentication across two services: the Next.js web app (`apps/web`) and the GraphQL API (`apps/api`). Both services share the same Better Auth secret and database, enabling cookie-based session forwarding without additional infrastructure.

## Auth Flow: Browser → Web → GraphQL API

```
Browser (session cookie in HTTP-only cookie)
  │
  ├─► proxy.ts — optimistic cookie-presence check (no DB hit)
  │     └─► redirects to /login if cookie missing
  │
  ├─► Server Component / Server Action
  │     ├─► getSession() via Better Auth (reads cookie from headers())
  │     └─► getClient().mutate() / query()
  │           └─► Apollo HttpLink with custom fetch
  │                 └─► forwards cookies from headers() to GraphQL API
  │
  └─► Client Component (useQuery / useMutation)
        └─► Apollo HttpLink with credentials: "include"
              └─► browser sends cookie directly to GraphQL API

GraphQL API (apps/api, port 4000)
  │
  ├─► createContext() — auth.api.getSession({ headers: request.headers })
  │     └─► Better Auth decodes session cookie using BETTER_AUTH_SECRET
  │           └─► sets context.session (or null if invalid/missing)
  │
  └─► Resolver
        ├─► requireAdmin(context) — throws UNAUTHENTICATED/FORBIDDEN
        └─► or proceeds with context.session (may be null for public queries)
```

## Two Cookie Forwarding Paths

### 1. Server-side (Server Components / Server Actions → GraphQL)

The Apollo client (`apps/web/src/lib/apollo-client.ts`) uses a custom `fetch` that reads `headers()` from Next.js and forwards cookies to the API:

```
Next.js headers() → cookie header → Apollo fetch → GraphQL API
```

This works because both services share the same `BETTER_AUTH_SECRET`, so the API can decode cookies signed by the web app.

### 2. Client-side (Browser → GraphQL directly)

The client Apollo wrapper (`apps/web/src/lib/apollo-wrapper.tsx`) sets `credentials: "include"` on its HttpLink, so the browser sends the session cookie directly to the API. CORS on the API must allow credentials from the web app origin.

## Auth Check Levels

| Layer                       | Check                           | Purpose                                 |
| --------------------------- | ------------------------------- | --------------------------------------- |
| `proxy.ts`                  | Cookie presence (optimistic)    | Fast redirect for unauthenticated users |
| Admin layout                | `getSession()` + role check     | Server-side gate for admin pages        |
| Server Actions              | `getSession()` before mutations | Validates session before calling API    |
| GraphQL mutations           | `requireAdmin(context)`         | Defense-in-depth at API level           |
| GraphQL queries (sensitive) | `requireAdmin(context)`         | Prevents unauthorized data access       |
| GraphQL queries (public)    | No check                        | Player stats, server info, health       |

## Query Auth Classification

| Query                                                        | Auth Required | Rationale             |
| ------------------------------------------------------------ | ------------- | --------------------- |
| `findManyServerToken`, `countServerToken`, `findServerToken` | Admin         | Sensitive credentials |
| `createServerToken`, `revokeServerToken`                     | Admin         | Credential management |
| `updateServerWithConfig`, `createServerWithConfig`           | Admin         | Server administration |
| `getPlayers`, `getServerPlayers`, `getPlayerById`            | None          | Public game stats     |
| `health`                                                     | None          | Monitoring endpoint   |
| Auto-generated CRUD (servers, games, etc.)                   | None          | Public game data      |

## Required Environment Variables

### `apps/web/.env`

| Variable                  | Required | Description                                                   |
| ------------------------- | -------- | ------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`      | Yes      | Shared secret for signing/verifying session cookies           |
| `BETTER_AUTH_URL`         | Yes      | Base URL of the auth server (usually `http://localhost:3000`) |
| `NEXT_PUBLIC_GRAPHQL_URL` | Yes      | GraphQL API URL for client-side requests                      |

### `apps/api/.env`

| Variable             | Required | Description                                                          |
| -------------------- | -------- | -------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET` | Yes      | **Must match `apps/web`** — used to decode forwarded session cookies |
| `BETTER_AUTH_URL`    | Yes      | Base URL of the auth server (usually `http://localhost:3000`)        |
| `ENCRYPTION_KEY`     | Yes      | Key for encrypting sensitive data (RCON passwords, etc.)             |
| `FRONTEND_URL`       | Yes      | Web app origin for CORS                                              |

### Critical: Shared secrets

`BETTER_AUTH_SECRET` **must be identical** across `apps/web` and `apps/api`. If they differ, the API cannot decode session cookies from the web app, and all authenticated operations will fail with `Authentication required`.

## Network Security (Production)

In Docker production, the GraphQL API (port 4000) is **not exposed externally** — only services on the internal Docker network can reach it. This provides network-level protection for unauthenticated queries.

In development, port 4000 is open on localhost. Rate limiting is configured via Better Auth (100 req/60s).
