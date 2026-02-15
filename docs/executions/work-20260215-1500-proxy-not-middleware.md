# Next.js v16 Work Log — proxy-not-middleware

## Request

Fix incorrect use of `middleware.ts` — Next.js 16 deprecated `middleware` and renamed it to `proxy`. The auth package should export a proxy helper, and `apps/web` should use `proxy.ts` (not `middleware.ts`).

## Context captured

- Runtime introspection: No (dev server not running)
- Affected routes/layouts: All routes (proxy runs before every matched request)

## Changes made

- Deleted `packages/auth/src/middleware.ts` and `apps/web/src/middleware.ts` (incorrectly created)
- Created `packages/auth/src/proxy.ts` — exports `authProxy()` function and `authProxyConfig`
- Created `apps/web/src/proxy.ts` — re-exports the auth proxy as the required `proxy` named export
- Updated `packages/auth/package.json` export: `./middleware` → `./proxy`

### Files touched

- `packages/auth/src/proxy.ts` (created)
- `packages/auth/package.json` (updated export path)
- `apps/web/src/proxy.ts` (created — replaces deleted middleware.ts)

## Rationale (doc-backed)

- **`middleware` is deprecated in Next.js 16, renamed to `proxy`**: https://nextjs.org/docs/app/api-reference/file-conventions/proxy — "The middleware file convention is deprecated and has been renamed to proxy."
- **File must be `proxy.ts` with a `proxy` named export**: https://nextjs.org/docs/app/getting-started/proxy — "Starting with Next.js 16, Middleware is now called Proxy to better reflect its purpose."
- **Proxy is for optimistic checks, not full session management**: https://nextjs.org/docs/app/getting-started/proxy — "it should not be used as a full session management or authorization solution."

## Verification

- `pnpm --filter @repo/auth run check-types` — pass
- `pnpm --filter web run check-types` — pass
- `pnpm run lint` — 8/8 tasks pass, 0 errors

## Follow-ups

- None. The proxy performs a lightweight cookie check (via `getSessionCookie`) for admin paths, which aligns with the Next.js recommendation for optimistic checks. Full session validation remains in the layout via `getSession()`.
