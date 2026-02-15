# Next.js v16 Work Log — proxy-session-validation

## Request

Fix client-side redirect behavior where navigating to `/admin` shows `200 /admin` then `200 /login` instead of a clean 302 redirect at the proxy level. Compared to the working lowrez.sh project which handles this correctly.

## Context captured

- Runtime introspection: Yes — no errors, routes confirmed
- Affected routes/layouts: `/admin` (and all sub-routes), `(admin)/layout.tsx`

## Root Cause

The `proxy.ts` was **synchronous** and only checked for session cookie **presence** via `getSessionCookie()`. This is an optimistic check that does NOT validate the session against the database. When a stale/expired session cookie exists:

1. Proxy sees cookie → `!sessionCookie` is false → passes through → renders admin page (200)
2. Admin layout calls `getSession()` → validates against DB → session invalid → `redirect("/login")` fires in the RSC payload → client navigates to `/login` (200)

The lowrez.sh project avoids this because its proxy is **async** and calls `auth.api.getSession()` to validate sessions, catching stale cookies at the proxy level.

## Changes made

- **`apps/web/src/proxy.ts`**: Made `proxy()` async. For `/admin` routes, added full session validation via `auth.api.getSession()` after the quick cookie-presence check. Added role check (`session.user.role !== "admin"`) to redirect non-admin users at the proxy level. Also fixed matcher escaping (dots in `favicon.ico`, `sitemap.xml`, `robots.txt`).

The admin layout (`(admin)/layout.tsx`) remains unchanged as a defense-in-depth safety net.

## Rationale

- `getSessionCookie` from `better-auth/cookies` only checks cookie existence, not validity (per Better Auth docs: "THIS IS NOT SECURE! This is the recommended approach to optimistically redirect users. We recommend handling auth checks in each page/route").
- `auth.api.getSession()` with `cookieCache` enabled (5-min maxAge in this project's config) validates the session without a DB call most of the time — the session data is cached in the cookie itself.
- Making the proxy async matches the lowrez.sh pattern and is fully supported in Next.js 16 proxy.ts (runs in Node.js runtime, not edge).

## Verification

- `pnpm --filter web run check-types` — clean, no errors

## Follow-ups

- Clear stale `better-auth.session_token` cookies in the browser during testing to verify the no-cookie path also works correctly
- The admin layout's `getSession()` + `redirect()` remains as a safety net; this is intentional redundancy
