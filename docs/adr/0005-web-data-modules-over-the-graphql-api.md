# 0005. Web data modules over the GraphQL API

- Status: Accepted
- Date: 2026-10-17

## Context

[0004](0004-authorization-in-the-data-layer.md) wants every protected read to guard itself. In the web app, reads are Apollo `query` calls made directly from server components, and writes are server actions that build a mutation inline. There is no module between a page and the API where a guard could live. The API strips sensitive fields from `Server`, `Player`, `EventConnect` and `EventRcon` and sanitizes their filter inputs; that work must not be duplicated.

## Decision

Records reach web pages only through per-domain data modules in `apps/web/src/lib/data/<domain>.ts`. Each module imports `server-only`; every exported function that touches protected data awaits a guard on its first line; the Apollo client stays inside; the function returns a DTO whose type a pure module in `lib/<domain>.ts` declares. Server actions validate, guard, call a data module function, `revalidatePath`, and return `{ ok: true } | { ok: false, errors }`. The API remains the enforcer for game data. User management reads the admin-gated `findManyUser` query and writes through Better Auth endpoints ([0003](0003-roles-through-the-admin-plugin-with-one-access-statement.md)).

## Options considered

- **Thin data modules over Apollo.** One guarded seam per domain, DTOs instead of generated query result types in components, and the API keeps its single sanitization point.
- **The API as the only data layer.** Rejected. Pages and actions would each carry their own guard, and nothing fails when one is missing.
- **Prisma directly from web data modules.** Rejected. It would re-implement the sensitive-field stripping and filter sanitization a second time, and the two would drift. Better Auth's own tables are the one place the web app already writes the database directly, and that stays with the plugin.

## Consequences

- An ESLint `no-restricted-imports` rule limits `@/lib/apollo-client` to `src/lib/data/**` and the Apollo wrapper.
- Public leaderboard pages use the same modules without a guard; such a module starts with a comment stating it is public, so a reviewer can tell at a glance.
- Generated operation types stay inside `lib/data`; components receive the DTO shapes.
- The existing feature folders (`features/admin/servers`, `features/admin/tokens`, `features/admin/users`) migrate one domain at a time; a plan in `docs/plans/` orders it.
