# 0004. Authorization in the data layer; the proxy only routes

- Status: Accepted
- Date: 2026-10-17

## Context

Access to the admin console is decided in three places that each believe they are the gate. `apps/web/src/proxy.ts` runs a full session read and role check on every `/admin` request, the `(admin)` and `(accounts)` layouts repeat it, and server actions check inconsistently: the server actions check a permission, the token actions check only that a session exists. Pages call the GraphQL API directly and rely on the layout above them. The Next.js authentication guide says a layout does not re-render on client navigation, a page-level check does not cover the server actions defined for it, and the check belongs next to the data, wrapped in React `cache` and marked `server-only`. A proxy's cookie check can be fooled by a stale or forged cookie; it was never a check.

The GraphQL API already does this right: `requireAdmin` runs inside every auto-generated mutation, every `User` query and every custom admin resolver.

## Decision

Authorization happens where data is read or written, and nowhere outside it. `proxy.ts` checks only that a session cookie exists, with `getSessionCookie`, and redirects between the console, the account pages and the sign-in pages; it never reads the session. Layouts call `requireAuth` only to draw chrome and redirect. Every exported function in a web data module ([0005](0005-web-data-modules-over-the-graphql-api.md)) and every server action calls `requireAuth`, `requireAdmin` or `requirePermission` on its first line. `getSession` in `packages/auth/src/session.ts` is wrapped in React `cache`, awaits `headers()` before touching the auth client, and the module imports `server-only`. `requireAdmin` answers a signed-in non-admin with `notFound()`, so an admin page is a 404 to anyone else.

## Options considered

- **Guard in the data layer and in every action.** A page cannot forget, because the data it asks for refuses to load. Repeated guards in one render cost nothing once the read is cached.
- **Proxy plus layouts (today).** Rejected. The proxy validates nothing, the layout check does not survive client navigation, and neither covers a server action, which is a public POST endpoint.
- **A guard in every page only.** Rejected. One obvious line per page, and nothing fails when a new page omits it.
- **Redirect non-admins home (today), or a 403 page.** Rejected. Both confirm the route exists. The Admin menu item is already hidden for non-admins, so nobody arrives by accident.

## Consequences

- The proxy matcher grows to `/admin/:path*`, `/accounts/:path*`, `/login` and `/register`; a signed-in visitor is bounced off the sign-in pages by cookie presence alone.
- The `requirePermission` helper in `user-actions.ts` moves into `@repo/auth/session`; the token actions gain a first-line guard. One helper set, three functions.
- The `(auth)` layout keeps a real session read, because it must send a signed-in visitor whose cookie the proxy let through away from the sign-in pages, and an unverified one to `/verify-email`.
- Tests: a Playwright protection spec (signed out lands on `/login`; a user gets 404 on `/admin`; an admin renders) and an API integration test that `requireAdminResolver` refuses a user-role context. Playwright is new to this repository and is added for this.
- A missed guard in the web app can still only leak a read; the API refuses the write. That is why the API's guards are not relaxed.
