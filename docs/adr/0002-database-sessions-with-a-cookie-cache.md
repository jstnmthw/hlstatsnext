# 0002. Database sessions with a cookie cache

- Status: Accepted
- Date: 2026-10-17

## Context

Better Auth stores sessions as database rows or as stateless tokens. Admins need to end a user's sessions when they ban them, and users will want to see and end their own devices. The API reads the session on every GraphQL request, so the per-request cost matters.

Recorded after the fact; the configuration in `packages/auth/src/server.ts` has had this shape since the package was built.

## Decision

Store sessions in the `session` table, Better Auth's default, and keep its cookie cache on with a five-minute lifetime. Keep the default lifetime of seven days, extended by a day of use. Write these values into the configuration rather than relying on defaults, so a reader sees them.

## Options considered

- **Database rows with a cookie cache.** Rows make revoke, ban and a sessions list possible. The cache answers most reads from a signed cookie, so a page render and an API request rarely hit the database for the session.
- **Stateless JWT.** Rejected. Nothing can be revoked before it expires, which defeats bans.
- **Rows with no cache.** Rejected. One session query per server component tree and per API request, to close a staleness window of a few minutes that bans and role changes can tolerate.

## Consequences

- A ban, a role change or a remote sign-out reaches a device within five minutes, when its cached cookie expires. Pages must not promise it is immediate.
- The API reads the same cookies through the forwarded `cookie` header but cannot set cookies on the browser; the web app is the only writer of the session cookies.
- Better Auth's freshness check (`session.freshAge`, 24 hours by default) guards `listSessions`, `unlinkAccount` and password-less `deleteUser`. The daily extension never moves `createdAt`, so every session is stale from its second day and those endpoints answer `SESSION_NOT_FRESH`. Whoever exposes one of them sets `freshAge: 0` or catches the refusal at that one call; nothing else in the app asks about freshness.
- Expired rows are deleted on access. No cleanup job at this scale.
