# Next.js v16 Work Log — Steam Link-Only Review

## Request

Create a review document for an alternative Steam integration approach: instead of modifying Better Auth, design a flow that allows registered users to link their Steam account, providing their SteamID to reconcile Player stats recorded by the daemon.

## Context Captured

- Runtime introspection: No (dev server not running)
- Affected routes/layouts:
  - `apps/web/src/app/(accounts)/accounts/settings/page.tsx` — existing account settings (will add Steam card)
  - `apps/web/src/app/api/steam/link/route.ts` — new route handler (proposed)
  - `apps/web/src/app/api/steam/callback/route.ts` — new route handler (proposed)
- Existing infrastructure reviewed:
  - Account settings page with profile form + password form
  - Protected `(accounts)` layout using `requireAuth()`
  - Better Auth server config (packages/auth/src/server.ts)
  - Prisma schema: User, Account, Player, PlayerUniqueId models
  - No existing Steam integration code

## Changes Made

- Created `docs/reviews/review-20260217-1500-steam-link-only-alternative.md` — comprehensive review document with 11 findings and a 4-phase to-do plan

No code changes — this is a design review document only.

## Rationale (doc-backed where applicable)

- Route Handlers for Steam OpenID flow: https://nextjs.org/docs/app/api-reference/file-conventions/route
- Route Handler nesting and catch-all compatibility: https://nextjs.org/docs/app/getting-started/route-handlers
- Environment variable security (STEAM_API_KEY server-only): https://nextjs.org/docs/app/guides/environment-variables
- Auth checks in Route Handlers: https://nextjs.org/docs/app/guides/authentication
- Server/Client component boundaries for settings UI: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Redirect patterns in Route Handlers: https://nextjs.org/docs/app/guides/redirecting

## Verification

- N/A (review document only, no code changes)

## Follow-ups

- Decide between this approach vs. Better Auth plugin approach (or do both — they're compatible)
- State parameter signing strategy for CSRF protection
- Whether to add Steam login later when PR #4877 merges
- Daemon integration for auto-linking new players to existing Steam-linked users
