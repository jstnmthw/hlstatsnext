# 0001. Use Better Auth for authentication

- Status: Accepted
- Date: 2026-10-17

## Context

HLStatsNext replaces HLstatsX:CE, whose admin login was a PHP session over a password column of its own. The rewrite needs sign-in for a public leaderboard and an admin console, in a Next.js 16 web app that renders on the server, with sessions that a separate GraphQL API can verify on every request. The database is MySQL through Prisma and is owned by this repository.

Recorded after the fact: `packages/auth` has run on this decision since it was built. The record exists so that later ones can refer to it.

## Decision

Use Better Auth with its Prisma adapter, wrapped in `packages/auth`. The web app serves its route handler at `/api/auth/*` and owns every sign-in screen. The API imports the same instance only to read the session from the forwarded cookie in `apps/api/src/context.ts`.

## Options considered

- **Better Auth.** TypeScript-native, a Prisma adapter, and sessions, email verification, OTP, social providers and an admin plugin as first-party features, with a plugin surface for providers it lacks (see [0008](0008-steam-sign-in-through-better-auth-steam.md)).
- **Auth.js (NextAuth).** Rejected. Maintained in security-patch mode by the Better Auth team, its v5 still a beta, and its own guidance points new projects at Better Auth.
- **A hand-rolled session and password layer.** Rejected. The legacy system shows how that ages, and the surface (verification, reset, OAuth, rate limits, bans) is larger than it looks.
- **A hosted identity provider.** Rejected. The project self-hosts and owns its users table; a third party in the sign-in path adds a bill and a dependency for no feature the plugin set does not already cover.

## Consequences

- Two processes construct the auth instance, so `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `DATABASE_URL` must agree between `apps/web` and `apps/api`. The API never serves the handler; it only validates.
- The `User`, `Session`, `Account` and `Verification` models belong to Better Auth. `Session`, `Account` and `Verification` stay in the GraphQL exclusion lists; `User` is exposed through a custom object to admins only.
- Passwords are hashed by Better Auth's own scrypt. `@repo/crypto` is for RCON secrets and server tokens and must not be used to verify user passwords. The API's `AuthService`, which tried to, is dead code and is removed.
- Better Auth is a shared dependency with a pinned transitive (`kysely`); every upgrade re-checks that pin (see [0008](0008-steam-sign-in-through-better-auth-steam.md)).
