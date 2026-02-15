# Next.js v16 Work Log — proxy-auth-simplify

## Request

Fix persistent auth redirect issue: navigating from homepage to `/admin` incorrectly redirected to `/login` despite the user being authenticated.

## Context captured

- Runtime introspection: No (dev server not running during fix)
- Affected routes: `/admin/*` (admin route group)
- Dev server logs showed: `GET /admin 200 (proxy.ts: 3ms)` followed by `GET /login 200` — proxy passed but layout redirected

## Root cause

The `proxy.ts` imported `@repo/auth/server` to call `auth.api.getSession()` for full session validation. This created a Better Auth + Prisma instance in the proxy runtime context, separate from the Server Component context where the admin layout runs its own `getSession()`. The redundant session validation in two different runtime contexts caused the layout's session check to fail.

Reference: the working `lowrez.sh` project uses a lightweight proxy that only checks cookie existence (via `getSessionCookie` from `better-auth/cookies`), with no session validation in the proxy. Full session validation is handled exclusively in the admin layout.

## Changes made

1. **Simplified `apps/web/src/proxy.ts`**:
   - Removed `auth` import from `@repo/auth/server` (no longer loads Better Auth + Prisma in proxy context)
   - Removed full session validation (`auth.api.getSession()`) and role checking from proxy
   - Changed to import `getSessionCookie` from new `@repo/auth/cookies` entry point (lightweight, no server module)
   - Made function synchronous (no `await` needed)
   - Proxy now only checks cookie existence for admin routes (fast redirect for unauthenticated users)

2. **Created `packages/auth/src/cookies.ts`**:
   - New lightweight entry point re-exporting `getSessionCookie` from `better-auth/cookies`
   - Avoids pulling in `./server.ts` (Better Auth + Prisma) when only cookie utilities are needed

3. **Updated `packages/auth/package.json`**:
   - Added `"./cookies": "./src/cookies.ts"` export map entry

## Rationale

- The proxy's role is optimistic redirection — fast cookie-existence check to avoid rendering protected pages for completely unauthenticated users
- Full session validation (DB lookup, role checking) belongs in the admin layout where Server Components have proper access to the runtime context
- Importing the full auth server module in proxy.ts created unnecessary coupling and potential module duplication between proxy and Server Component contexts
- This matches the recommended Better Auth pattern: "getSessionCookie only checks cookie existence, not validity. Handle auth checks in each page/route"

## Verification

- `pnpm run check-types` — all 9 packages pass
- Files touched:
  - `apps/web/src/proxy.ts` (modified)
  - `packages/auth/src/cookies.ts` (created)
  - `packages/auth/package.json` (modified)

## Follow-ups

- Test in browser: navigate Homepage -> Admin to verify no redirect occurs for authenticated admin users
- The admin layout already handles full session validation + role checking, so security is maintained
