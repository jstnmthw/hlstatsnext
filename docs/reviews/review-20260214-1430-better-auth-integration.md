# Next.js v16 Engineering Review — Better Auth Integration

## Scope

This review covers the integration of **Better Auth** into the HLStatsNext.com web application (`apps/web`), including:

- Authentication (credentials + Google OAuth)
- Database session management via Better Auth's Prisma adapter
- Role-based access control (RBAC) with the Better Auth admin plugin
- Route protection for admin pages
- Registration/login UI pages
- Default admin seeder with permissions

## Repo/System Context

| Property                | Value                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| **Monorepo**            | Turborepo + pnpm workspaces                                                    |
| **Frontend**            | Next.js v16.1.6, App Router, Turbopack                                         |
| **React**               | v19.2.4                                                                        |
| **GraphQL API**         | Pothos + Apollo Server (port 4000)                                             |
| **Database**            | MySQL/MariaDB via Prisma v7 (`@prisma/adapter-mariadb`)                        |
| **Prisma output**       | `generated/prisma` (custom path)                                               |
| **Auth status**         | None — admin routes are publicly accessible                                    |
| **Existing User model** | `username` (PK), `password` (Argon2id), `acclevel` (0-100), linked to `Player` |
| **Crypto**              | Custom `@repo/crypto` package (Argon2id hashing, AES-256-GCM encryption)       |

### Current Route Map (from DevTools MCP)

```
App Router:
  /                        (public - homepage)
  /servers                 (public - stub)
  /servers/[id]            (public - server detail)
  /admin                   (UNPROTECTED - dashboard)
  /admin/games             (UNPROTECTED - games CRUD)
  /admin/players           (UNPROTECTED - players CRUD)
  /admin/servers            (UNPROTECTED - servers CRUD)
  /admin/servers/[id]/edit  (UNPROTECTED - edit server)
  /admin/servers/add        (UNPROTECTED - add server)
  /admin/ui-kit             (UNPROTECTED - UI showcase)
  /admin/users              (UNPROTECTED - users CRUD)
```

## Measurement Methodology (DevTools)

| Tool                | Status                                                  |
| ------------------- | ------------------------------------------------------- |
| `nextjs_index`      | Dev server running on port 3000 (6 MCP tools available) |
| `get_routes`        | All 12 app routes confirmed                             |
| `get_errors`        | No errors detected in 1 browser session                 |
| `get_page_metadata` | Available for runtime metadata                          |

## Baseline Results

| Metric                   | Value                                                              |
| ------------------------ | ------------------------------------------------------------------ |
| Total routes             | 12 (App Router)                                                    |
| Admin routes             | 8 (all unprotected)                                                |
| Public routes            | 4                                                                  |
| Middleware/Proxy         | None                                                               |
| Auth provider            | None                                                               |
| Session management       | None                                                               |
| RBAC/Permissions         | None (legacy `acclevel` field on `User` model, unused by frontend) |
| Client components        | 10 files with `"use client"`                                       |
| Server actions           | 2 (create-server, update-server) — no auth checks                  |
| Loading/error boundaries | None                                                               |
| Route groups             | None                                                               |

---

## Findings

### F-001: No Authentication Layer

**Summary**: The web application has zero authentication. All admin routes (`/admin/*`) are publicly accessible to any visitor. Server actions for creating/editing servers have no auth checks.

**Evidence**:

- DevTools `get_routes`: All 8 admin routes confirmed active without protection
- No `proxy.ts` or `middleware.ts` file exists
- No session/cookie management code
- Server actions at `apps/web/src/features/admin/servers/actions/create-server.ts` and `update-server.ts` perform mutations without verifying user identity

**Next.js best-practice**: Authentication should be implemented using database sessions with auth checks in pages/routes, not just proxy.

- [https://nextjs.org/docs/app/guides/authentication](https://nextjs.org/docs/app/guides/authentication)

**Proposed change**: Integrate Better Auth with:

- Database session strategy (via Prisma adapter)
- Email/password credentials
- Google OAuth social provider
- Server-side session verification using `auth.api.getSession()` in protected pages

**Risk/complexity**: Medium-High. Requires new Prisma models, new packages, route restructuring, and seeder updates. Better Auth handles the heavy lifting but touching every admin page is needed.

**Expected impact**: Critical security fix. Admin functionality becomes inaccessible to unauthenticated users.

---

### F-002: No Route Organization for Auth Boundaries

**Summary**: Admin and public pages share the same flat route structure with a single root layout. There are no route groups to separate authenticated from unauthenticated experiences.

**Evidence**:

- Single `app/layout.tsx` wrapping everything with `ApolloWrapper`
- No `(auth)`, `(admin)`, or `(public)` route group folders
- Admin layout is applied via component composition (`AdminHeader`, `Navbar`) rather than file-system conventions

**Next.js best-practice**: Route Groups partition the application into sections with separate layouts. Use `(folderName)` convention.

- [https://nextjs.org/docs/app/api-reference/file-conventions/route-groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)

**Proposed change**: Restructure routes using route groups:

```
app/
  (public)/          # Public pages - no auth required
    layout.tsx       # Public header/footer layout
    page.tsx         # Homepage
    servers/
  (auth)/            # Auth pages - only for unauthenticated users
    layout.tsx       # Minimal centered layout
    login/page.tsx
    register/page.tsx
  (admin)/           # Admin pages - requires authentication + admin role
    layout.tsx       # Admin layout with sidebar/navbar + auth guard
    admin/
      page.tsx
      games/
      players/
      servers/
      users/
  api/auth/[...all]/route.ts  # Better Auth catch-all handler
  layout.tsx         # Root layout (ApolloWrapper + fonts)
```

**Risk/complexity**: Medium. File moves are mechanical but must preserve all imports and routing behavior.

**Expected impact**: Clean separation of concerns. Auth checks centralized in layout rather than repeated per-page.

---

### F-003: No Proxy/Middleware for Optimistic Auth Checks

**Summary**: No `proxy.ts` (or legacy `middleware.ts`) exists. There is no optimistic redirect for unauthenticated users attempting to access admin routes.

**Evidence**:

- Glob search for `proxy.ts` and `middleware.ts` returns no results
- No request interception layer

**Next.js best-practice**: Proxy (formerly middleware) is recommended for optimistic cookie-based checks that redirect unauthenticated users. It should NOT be the only security layer — auth must also be verified in pages/server actions.

- [https://nextjs.org/docs/app/api-reference/file-conventions/proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [https://nextjs.org/docs/app/guides/authentication#optimistic-checks-with-proxy-optional](https://nextjs.org/docs/app/guides/authentication#optimistic-checks-with-proxy-optional)

**Proposed change**: Create `proxy.ts` at project root using Better Auth's `getSessionCookie()` for optimistic checks:

```typescript
import { NextResponse, NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)

  if (request.nextUrl.pathname.startsWith("/admin") && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

**Risk/complexity**: Low. Simple file addition. `getSessionCookie()` is a cookie existence check only (not secure validation).

**Expected impact**: Instant UX improvement — unauthenticated users are redirected to login before the page even renders.

---

### F-004: No Better Auth API Route Handler

**Summary**: Better Auth requires a catch-all route handler at `/api/auth/[...all]/route.ts` to handle all authentication endpoints (sign-in, sign-up, sign-out, OAuth callbacks, session management).

**Evidence**:

- No `api/auth` directory exists in `apps/web/src/app/`
- Better Auth docs require this handler: [https://www.better-auth.com/docs/integrations/next](https://www.better-auth.com/docs/integrations/next)

**Next.js best-practice**: Route Handlers are the App Router equivalent of API Routes. They use standard Request/Response APIs.

- [https://nextjs.org/docs/app/getting-started/route-handlers](https://nextjs.org/docs/app/getting-started/route-handlers)

**Proposed change**: Create `app/api/auth/[...all]/route.ts`:

```typescript
import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const { GET, POST } = toNextJsHandler(auth)
```

**Risk/complexity**: Low. Single file creation.

**Expected impact**: Enables all Better Auth endpoints (sign-in, sign-up, OAuth flow, session management).

---

### F-005: Prisma Schema Needs Better Auth Models

**Summary**: The current Prisma schema has a legacy `User` model with `username` as PK and `password` stored directly on it. Better Auth requires its own `user`, `session`, `account`, and `verification` tables. The existing `User` model conflicts with Better Auth expectations (which stores passwords in the `account` table, not `user`).

**Evidence**:

- Current `User` model: `username` (PK, VARCHAR 16), `password`, `acclevel`, `playerId`
- Better Auth core schema requires: `user` (id, name, email, emailVerified, image, role, banned, createdAt, updatedAt), `session`, `account`, `verification`
- Better Auth stores credentials in `account` table with `providerId: "credential"` — **NOT** in the user table
- GitHub issue confirms: having a `password` field on the `User` model causes Prisma adapter errors

**Next.js best-practice**: N/A (database schema concern)

**Better Auth reference**: [https://www.better-auth.com/docs/adapters/prisma](https://www.better-auth.com/docs/adapters/prisma)

**Decision**: No backward compatibility required (early dev stage). Refactor the existing `User` model to conform to Better Auth's requirements. The daemon must be updated to use the correct fields from the new schema.

**Proposed change**:

1. Remove the existing `User` model entirely
2. Add new Better Auth models via CLI: `npx @better-auth/cli generate` — creates `user`, `session`, `account`, `verification` tables
3. The Better Auth `user` table becomes the sole auth identity, with an optional relation to `Player` for game stats linking
4. Update the daemon's auth service to use the new `user`/`account` schema (passwords are in `account` table)
5. Run Prisma migration after schema generation

**Risk/complexity**: Medium. Schema changes affect the daemon and API app, but since we're in early dev with no backward compatibility requirement, this is a clean-break migration.

**Expected impact**: Enables Better Auth's full feature set. Clean separation between auth identity and game player data.

---

### F-006: No RBAC/Permissions System

**Summary**: The app has no role-based access control. The legacy `acclevel` integer (0-100) on the `User` model is unused by the frontend. All admin pages are equally accessible with no permission differentiation.

**Evidence**:

- `acclevel` field exists but is never checked in `apps/web`
- No permission checks in any admin page or server action
- API has an `AuthService.checkAccess()` method but it's unused by the web app

**Better Auth reference**: Admin plugin with custom RBAC

- [https://www.better-auth.com/docs/plugins/admin](https://www.better-auth.com/docs/plugins/admin)

**Proposed change**: Implement Better Auth's admin plugin with custom access control:

```typescript
// lib/auth-permissions.ts (shared between server and client)
import { createAccessControl } from "better-auth/plugins/access"
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access"

export const statement = {
  ...defaultStatements,
  server: ["create", "read", "update", "delete"],
  game: ["read", "update"],
  player: ["read", "update", "ban"],
  dashboard: ["read"],
} as const

export const ac = createAccessControl(statement)

export const adminRole = ac.newRole({
  ...adminAc.statements,
  server: ["create", "read", "update", "delete"],
  game: ["read", "update"],
  player: ["read", "update", "ban"],
  dashboard: ["read"],
})

export const userRole = ac.newRole({
  server: ["read"],
  game: ["read"],
  player: ["read"],
  dashboard: [],
})
```

**Risk/complexity**: Medium. Requires defining all permissions upfront and adding checks throughout admin pages and server actions.

**Expected impact**: Granular control over who can access what. Prevents unauthorized modifications.

---

### F-007: Server Actions Lack Auth Guards

**Summary**: The two existing server actions (`create-server.ts`, `update-server.ts`) perform GraphQL mutations without any authentication or authorization checks.

**Evidence**:

- `apps/web/src/features/admin/servers/actions/create-server.ts`: Validates form data with Zod, calls `getClient().mutate()`, but never checks session
- `apps/web/src/features/admin/servers/actions/update-server.ts`: Same pattern

**Next.js best-practice**: Server Actions should be treated as public API endpoints. Always verify authentication and authorization before performing mutations.

- [https://nextjs.org/docs/app/guides/authentication#server-actions](https://nextjs.org/docs/app/guides/authentication#server-actions)

**Proposed change**: Add `auth.api.getSession()` check at the top of every server action:

```typescript
"use server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function createServer(prevState: unknown, formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { error: "Authentication required" }
  }
  // Check permissions via admin plugin
  const hasPermission = await auth.api.userHasPermission({
    body: { userId: session.user.id, permission: { server: ["create"] } },
  })
  if (!hasPermission) {
    return { error: "Insufficient permissions" }
  }
  // ... existing logic
}
```

**Risk/complexity**: Low per action, but must be applied to all existing and future actions.

**Expected impact**: Prevents unauthorized data modification even if proxy/UI checks are bypassed.

---

### F-008: No Login/Register Pages

**Summary**: The application has no authentication UI. No login, register, or account management pages exist.

**Evidence**:

- No routes at `/login`, `/register`, `/sign-in`, `/sign-up`, or similar
- No auth forms or components exist in the features directory
- Public header links to `/admin` without any auth gate

**Next.js best-practice**: Use Server Actions with `useActionState` for auth forms. Better Auth provides a React client (`better-auth/react`) with hooks like `useSession()`, `signIn.email()`, `signUp.email()`, `signIn.social()`.

- [https://nextjs.org/docs/app/guides/authentication#sign-up-and-login-functionality](https://nextjs.org/docs/app/guides/authentication#sign-up-and-login-functionality)

**Better Auth reference**: [https://www.better-auth.com/docs/basic-usage](https://www.better-auth.com/docs/basic-usage)

**Proposed change**: Create auth pages using shadcn components from `@repo/ui`:

1. **`/login`** — Email/password form + Google OAuth button
2. **`/register`** — Name, email, password form + Google OAuth button
3. Both pages redirect to `/admin` on success, or to homepage for regular users

**Risk/complexity**: Low-Medium. Standard form implementation using existing UI components.

**Expected impact**: Users can authenticate. OAuth flow enables Google sign-in.

---

### F-009: No Admin Seeder with Permissions

**Summary**: The existing seed system (`packages/db/src/seed.ts`) seeds games, servers, players, etc. but does not create any auth users, admin accounts, or permission records. There is no way for a fresh install to have an initial admin user.

**Evidence**:

- `packages/db/src/seed.ts` calls seeders for Games, Servers, Players, etc.
- No user/auth seeder exists
- No mention of admin account creation in any seed file

**Proposed change**: Create a new seeder that:

1. Creates a default admin user via Better Auth's server API
2. Generates a random password using `crypto.randomBytes()`
3. Assigns the `admin` role via the admin plugin
4. Echoes the credentials to console output
5. Seeds default permission definitions

```typescript
// packages/db/src/seeders/auth.ts
import { randomBytes } from "crypto"

export async function seedDefaultAdmin(auth: typeof import("@/lib/auth").auth) {
  const password = randomBytes(16).toString("hex")

  const user = await auth.api.signUpEmail({
    body: {
      name: "Admin",
      email: "admin@hlstatsnext.local",
      password,
    },
  })

  await auth.api.setRole({
    body: { userId: user.id, role: "admin" },
  })

  console.log("=".repeat(50))
  console.log("Default admin account created:")
  console.log(`  Email:    admin@hlstatsnext.local`)
  console.log(`  Password: ${password}`)
  console.log("=".repeat(50))
}
```

**Risk/complexity**: Low. Additive change to existing seeder infrastructure.

**Expected impact**: Fresh installations have a working admin account. Password is random and displayed only once.

---

### F-010: Better Auth Configuration Needed

**Summary**: A central Better Auth configuration file (`lib/auth.ts`) and client file (`lib/auth-client.ts`) need to be created in the web app.

**Better Auth references**:

- Server config: [https://www.better-auth.com/docs/installation](https://www.better-auth.com/docs/installation)
- Prisma adapter: [https://www.better-auth.com/docs/adapters/prisma](https://www.better-auth.com/docs/adapters/prisma)
- Next.js integration: [https://www.better-auth.com/docs/integrations/next](https://www.better-auth.com/docs/integrations/next)
- Session management: [https://www.better-auth.com/docs/concepts/session-management](https://www.better-auth.com/docs/concepts/session-management)
- Google OAuth: [https://www.better-auth.com/docs/authentication/google](https://www.better-auth.com/docs/authentication/google)
- Email/Password: [https://www.better-auth.com/docs/authentication/email-password](https://www.better-auth.com/docs/authentication/email-password)
- Admin plugin: [https://www.better-auth.com/docs/plugins/admin](https://www.better-auth.com/docs/plugins/admin)

**Proposed change**:

**Server config (`apps/web/src/lib/auth.ts`)**:

```typescript
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { admin } from "better-auth/plugins"
import { prisma } from "@repo/db"
import { ac, adminRole, userRole } from "./auth-permissions"

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "mysql" }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  plugins: [
    admin({
      ac,
      roles: { admin: adminRole, user: userRole },
    }),
  ],
})
```

**Client config (`apps/web/src/lib/auth-client.ts`)**:

```typescript
import { createAuthClient } from "better-auth/react"
import { adminClient } from "better-auth/client/plugins"
import { ac, adminRole, userRole } from "./auth-permissions"

export const authClient = createAuthClient({
  plugins: [adminClient({ ac, roles: { admin: adminRole, user: userRole } })],
})
```

**Risk/complexity**: Medium. Requires correct Prisma client import path (custom output in this monorepo), proper env vars, and shared permissions file that's safe for both server and client bundles.

**Expected impact**: Core auth infrastructure. Everything else depends on this.

---

### F-011: Environment Variables Missing for Auth

**Summary**: No auth-related environment variables exist. Better Auth requires `BETTER_AUTH_SECRET` (or `AUTH_SECRET`), and Google OAuth needs client credentials.

**Evidence**:

- Current `.env` only has `NODE_ENV`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_GRAPHQL_URL`
- No secrets, no OAuth credentials

**Proposed change**: Add to `.env`:

```bash
# Better Auth
BETTER_AUTH_SECRET=  # Generate with: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth (optional for development)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

**Risk/complexity**: Low. Standard env var setup.

**Expected impact**: Required for auth to function.

---

## Phased To-Do Plan

### P0: Measurement & Guardrails

- [x] **P0-1**: Install Better Auth and dependencies (F-010)
  - Installed `better-auth` in `apps/web` (+14 packages)

  ```bash
  pnpm --filter web add better-auth
  ```

  - Next.js docs: [https://nextjs.org/docs/app/guides/authentication#auth-libraries](https://nextjs.org/docs/app/guides/authentication#auth-libraries)
  - Better Auth docs: [https://www.better-auth.com/docs/installation](https://www.better-auth.com/docs/installation)

- [x] **P0-2**: Set up environment variables (F-011)
  - Generated `BETTER_AUTH_SECRET` via `openssl rand -base64 32`
  - Added `DATABASE_URL` (required for Prisma adapter — was missing from web .env)
  - Added `BETTER_AUTH_URL`, Google OAuth placeholders
  - Next.js docs: [https://nextjs.org/docs/app/guides/environment-variables](https://nextjs.org/docs/app/guides/environment-variables)

- [x] **P0-3**: Refactor Prisma schema for Better Auth (F-005)
  - Removed old `User` model (username PK, password, acclevel, playerId)
  - Added Better Auth models: `User` (id, name, email, role, banned), `Session`, `Account`, `Verification`
  - Removed `user User?` relation from `Player` model
  - Updated API `AuthRepository` and `AuthService` for new schema (email-based, account table for passwords)
  - Updated admin users GraphQL queries and columns for new fields (name, email, role, banned, createdAt)
  - Regenerated: Prisma client, Pothos types, GraphQL codegen
  - Schema pushed to database via `prisma db push`
  - All packages pass typecheck (web, api, database)
  - Better Auth Prisma docs: [https://www.better-auth.com/docs/adapters/prisma](https://www.better-auth.com/docs/adapters/prisma)

### P1: Quick Wins (Core Auth)

- [x] **P1-1**: Create shared permissions/access control file (F-006)
  - Created `apps/web/src/lib/auth-permissions.ts` — client-safe, no server imports
  - Defines `statement` (server, game, player, dashboard resources), `ac`, `adminRole`, `userRole`
  - Merges `defaultStatements` and `adminAc.statements` for admin role
  - Better Auth admin docs: [https://www.better-auth.com/docs/plugins/admin#custom-permissions](https://www.better-auth.com/docs/plugins/admin#custom-permissions)

- [x] **P1-2**: Create Better Auth server config (F-010)
  - Updated `apps/web/src/lib/auth.ts` with full config: Prisma adapter (`db` from `@repo/db/client`), email/password, Google OAuth, admin plugin with RBAC, session cookie cache (5min)
  - Better Auth Next.js docs: [https://www.better-auth.com/docs/integrations/next](https://www.better-auth.com/docs/integrations/next)

- [x] **P1-3**: Create Better Auth client config (F-010)
  - Created `apps/web/src/lib/auth-client.ts` with `createAuthClient`, `adminClient` plugin, exports `useSession`, `signIn`, `signUp`, `signOut`
  - Better Auth client docs: [https://www.better-auth.com/docs/basic-usage#session](https://www.better-auth.com/docs/basic-usage#session)

- [x] **P1-4**: Create catch-all API route handler (F-004)
  - Created `apps/web/src/app/api/auth/[...all]/route.ts` with `toNextJsHandler(auth)`
  - Next.js Route Handlers: [https://nextjs.org/docs/app/getting-started/route-handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
  - Better Auth handler docs: [https://www.better-auth.com/docs/integrations/next#create-api-route](https://www.better-auth.com/docs/integrations/next#create-api-route)

- [x] **P1-5**: Create `proxy.ts` for optimistic auth checks (F-003)
  - Created `apps/web/src/proxy.ts` with `getSessionCookie()` from `better-auth/cookies`
  - Redirects `/admin/*` to `/login` if no session cookie
  - Redirects `/login` and `/register` to `/admin` if session cookie exists
  - Matcher excludes api, \_next/static, \_next/image, favicon, sitemap, robots
  - Next.js Proxy docs: [https://nextjs.org/docs/app/api-reference/file-conventions/proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

### P2: Architectural Refactors

- [x] **P2-1**: Restructure routes with route groups (F-002)
  - Created `(public)`, `(auth)`, and `(admin)` route groups
  - Moved homepage + `/servers` to `(public)/`, admin pages to `(admin)/admin/`
  - Created `(auth)/layout.tsx` with centered card layout and AppLogo
  - URLs unchanged: route groups don't affect URL paths
  - Next.js Route Groups: [https://nextjs.org/docs/app/api-reference/file-conventions/route-groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)

- [x] **P2-2**: Create admin layout with server-side auth guard (F-001)
  - Created `app/(admin)/layout.tsx` — calls `auth.api.getSession()` with `headers()`
  - Redirects to `/login` if no session, redirects to `/` if not admin role
  - Layered security: proxy (optimistic cookie check) + layout (real session verification)
  - Next.js auth in layouts: [https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks](https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks)

- [x] **P2-3**: Create login page (F-008)
  - Created `app/(auth)/login/page.tsx` + `features/auth/components/login-form.tsx`
  - Email/password form using `signIn.email()` from auth client
  - Google OAuth button (`features/auth/components/google-button.tsx`) using `signIn.social()`
  - Error display, loading states, link to register
  - Better Auth sign-in docs: [https://www.better-auth.com/docs/basic-usage#sign-in](https://www.better-auth.com/docs/basic-usage#sign-in)

- [x] **P2-4**: Create register page (F-008)
  - Created `app/(auth)/register/page.tsx` + `features/auth/components/register-form.tsx`
  - Name, email, password form using `signUp.email()` from auth client
  - Shared Google OAuth button component
  - Error display, loading states, link to login
  - Better Auth sign-up docs: [https://www.better-auth.com/docs/basic-usage#sign-up](https://www.better-auth.com/docs/basic-usage#sign-up)

- [x] **P2-5**: Add auth guards to all server actions (F-007)
  - Added `auth.api.getSession()` + `auth.api.userHasPermission()` to both `create-server.ts` and `update-server.ts`
  - `create-server.ts` checks `server: ["create"]` permission
  - `update-server.ts` checks `server: ["update"]` permission
  - Returns `{ success: false, message }` if auth fails (no redirect/throw)
  - Next.js Server Actions auth: [https://nextjs.org/docs/app/guides/authentication#server-actions](https://nextjs.org/docs/app/guides/authentication#server-actions)

- [x] **P2-6**: Add user session display to admin header
  - Created `features/admin/common/components/user-menu.tsx` (client component)
  - Shows user name/email + sign-out button with `LogOutIcon`
  - Uses `useSession()` for session data, `signOut()` for logout
  - Integrated into admin header alongside existing nav items
  - Better Auth sign-out: [https://www.better-auth.com/docs/basic-usage#signout](https://www.better-auth.com/docs/basic-usage#signout)

- [x] **P2-7**: Create admin seeder with default admin + permissions (F-009)
  - Created `apps/web/src/scripts/seed-admin.ts` (standalone script)
  - Uses `auth.api.signUpEmail()` for proper password hashing in account table
  - Sets admin role via Prisma directly (avoids authenticated session requirement)
  - Generates random 32-char hex password, echoes credentials to console
  - Skips if admin already exists (idempotent)
  - Added `seed:admin` script to web package.json (`tsx src/scripts/seed-admin.ts`)
  - Added `tsx` to web devDependencies

### P3: Deeper / Optional

- [x] **P3-1**: Add `loading.tsx` and `error.tsx` boundaries
  - Created `app/(admin)/loading.tsx` — centered spinning loader icon for admin section
  - Created `app/(auth)/loading.tsx` — centered spinning loader icon for auth pages
  - Created `app/(admin)/error.tsx` — Card-based error UI with retry button (Client Component)
  - Created `app/(auth)/error.tsx` — Card-based error UI matching auth layout (Client Component)
  - All use `@repo/ui` components (Card, Button, lucide icons)
  - Typecheck passes
  - Next.js loading UI: [https://nextjs.org/docs/app/api-reference/file-conventions/loading](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
  - Next.js error handling: [https://nextjs.org/docs/app/api-reference/file-conventions/error](https://nextjs.org/docs/app/api-reference/file-conventions/error)

- [x] **P3-2**: Add permission-based UI filtering
  - Created `usePermission` hook (`features/auth/hooks/use-permission.ts`) — wraps `checkRolePermission()` with session role
  - Created `PermissionGate` component (`features/auth/components/permission-gate.tsx`) — conditionally renders children based on permissions
  - Converted Navbar to client component with permission-based filtering on nav items (server, player, user, game)
  - Wrapped "Add server" buttons on dashboard and servers pages with `PermissionGate { server: ["create"] }`
  - All synchronous checks via `authClient.admin.checkRolePermission()` — no server calls
  - Typecheck passes
  - Better Auth permission checks: [https://www.better-auth.com/docs/plugins/admin#access-control-usage](https://www.better-auth.com/docs/plugins/admin#access-control-usage)

- [x] **P3-3**: Account linking (Google + credentials)
  - Added `account.accountLinking` config to `packages/auth/src/server.ts`
  - `enabled: true` with `trustedProviders: ["google"]`
  - Users who sign in with Google can later set a password (via `setPassword` API)
  - Users with email/password can link their Google account (via `linkSocial`)
  - Typecheck passes
  - Better Auth account linking: [https://www.better-auth.com/docs/concepts/users-accounts#account-linking](https://www.better-auth.com/docs/concepts/users-accounts#account-linking)

- [x] **P3-4**: Email verification with OTP (F-008)
  - Created mail adapter (`packages/auth/src/mail.ts`) — dispatches via `MAIL_PROVIDER` env var
  - `console` adapter: logs OTP to stdout with formatted output (development default)
  - `resend` adapter: sends via Resend SDK with graceful fallback to console if API key missing
  - Added `emailOTP` plugin to server config with `sendVerificationOnSignUp: true`, 6-digit OTP, 5min expiry
  - Added `emailOTPClient()` to client config
  - Enabled `emailAndPassword.requireEmailVerification: true` — blocks sign-in without verified email
  - Enabled `emailVerification.sendOnSignUp: true` + `autoSignInAfterVerification: true`
  - Created `(auth)/verify-email/page.tsx` — accepts `?email=` query param
  - Created `VerifyEmailForm` component — OTP input with verify + resend functionality
  - Updated auth layout: only redirects verified users (unverified can access verify-email page)
  - Updated register form: redirects to `/verify-email?email=...` after signup
  - Updated login form: handles 403 (unverified email) by redirecting to verify-email page, added "Forgot password?" link
  - Updated seed-admin script: sets `emailVerified: true` for seeded admin
  - Added env vars: `MAIL_PROVIDER`, `RESEND_API_KEY`, `MAIL_FROM`
  - Typecheck passes (auth + web)
  - Better Auth email OTP: [https://www.better-auth.com/docs/plugins/email-otp](https://www.better-auth.com/docs/plugins/email-otp)

- [x] **P3-5**: Forgotten password flow
  - Created `(auth)/forgot-password/page.tsx` + `ForgotPasswordForm` component — email input, always redirects to reset-password (prevents user enumeration)
  - Created `(auth)/reset-password/page.tsx` + `ResetPasswordForm` component — OTP code + new password form with resend capability
  - Uses `authClient.emailOtp.requestPasswordReset()` to send OTP, `authClient.emailOtp.resetPassword()` to reset
  - Shows success state with sign-in link after successful reset
  - Uses same mail adapter system from P3-4 (console/resend)
  - Added "Forgot password?" link to login form
  - Typecheck passes
  - Better Auth email OTP reset: [https://www.better-auth.com/docs/plugins/email-otp](https://www.better-auth.com/docs/plugins/email-otp)

- [x] **P3-6**: Add auth to GraphQL API
  - Added `@repo/auth` workspace dependency to `apps/api`
  - Updated `context.ts`: async context factory extracts session from request headers via `auth.api.getSession()`
  - Added `requireAuth()` and `requireAdmin()` helpers that throw `GraphQLError` with proper codes (UNAUTHENTICATED/FORBIDDEN)
  - Singleton services pattern avoids re-creating services per request
  - Added `requireAdmin(context)` guard to `createServerWithConfig` and `updateServerWithConfig` mutations
  - Removed debug console.log statements from create mutation
  - Queries remain public (read-only data)
  - Typecheck passes

- [x] **P3-7**: Rate limiting tuning
  - Added explicit `rateLimit` config to `packages/auth/src/server.ts`
  - Defaults: 60s window, 100 max requests (disabled in dev, enabled in production automatically)
  - Custom rules for sensitive endpoints: sign-up (3/60s), OTP send (3/60s), password reset (3/60s)
  - Built-in Better Auth rule for `/sign-in/email` already limits to 3 req/10s
  - Storage: in-memory (default) — suitable for single-instance deployment
  - Typecheck passes
  - Better Auth rate limiting: [https://www.better-auth.com/docs/concepts/rate-limiting](https://www.better-auth.com/docs/concepts/rate-limiting)

---

## Open Questions / Follow-ups

All original open questions have been resolved:

1. **Legacy `users` table**: **RESOLVED** — No backward compatibility needed (early dev). Remove existing `User` model entirely and refactor to Better Auth schema. Daemon will be updated to use the new `user`/`account` tables.

2. **Prisma client sharing**: **RESOLVED** — Use the shared `@repo/db` exported client. Better Auth's `auth.ts` will `import { prisma } from "@repo/db"`.

3. **Google OAuth redirect URI**: **RESOLVED** — Document `http://localhost:3000/api/auth/callback/google` (dev) and production domain in `INSTALLATION.md`.

4. **Email verification**: **RESOLVED** — Deferred to P3-4 as its own phase. Will implement:
   - Mail adapter system via env variable (`MAIL_PROVIDER=console|resend`)
   - Better Auth OTP code verification (not magic link)
   - Standalone verification page with proxy redirect for unverified users
   - Forgotten password flow (P3-5) using same mail adapter

5. **Rate limiting**: **RESOLVED** — Use Better Auth defaults. Tune in production (P3-7).
