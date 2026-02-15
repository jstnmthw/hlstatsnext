# Next.js v16 Work Log — fix-ci-gql-types

## Request

Fix CI/CD type-checking failures in `web#check-types`. All 32 errors were caused by missing GraphQL codegen output (`@/lib/gql` module not found, and query result types resolving to `{}`).

## Context captured

- Runtime introspection: No (dev server not running)
- Affected routes/layouts: All files importing from `@/lib/gql` — admin pages (games, players, servers, users), public server page, feature modules

## Changes made

- **Root cause**: `apps/web/src/lib/gql/` was listed in `apps/web/.gitignore` (line 39), so the GraphQL codegen output was not tracked by git. CI checked out the repo without these files, causing all 32 type errors.
- **Fix**: Removed the `src/lib/gql` gitignore entry so the codegen output is committed and available in CI checkout.

### Files touched

- `apps/web/.gitignore` — removed `src/lib/gql` gitignore rule
- `apps/web/src/lib/gql/` — 4 files now tracked (index.ts, gql.ts, fragment-masking.ts, graphql.ts)

## Rationale

Committing `@graphql-codegen/client-preset` output is the standard approach when codegen requires a running API server for schema introspection (`http://localhost:4000/graphql`). Since CI cannot run the API, the generated types must be checked in.

## Verification

- `pnpm --filter web run check-types` — passes (0 errors)
- `pnpm run check-types` — all 9 tasks pass

## Follow-ups

- When the GraphQL schema changes, developers must re-run `pnpm --filter web graphql:codegen` and commit the updated output
- Consider adding a CI check that verifies codegen output is up-to-date (run codegen against a committed schema file and diff)
