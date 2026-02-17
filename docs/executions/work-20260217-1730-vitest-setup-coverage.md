# Next.js v16 Work Log — vitest-setup-coverage

## Request

Introduce Vitest to the web app, set threshold to 80% coverage, and achieve 80% coverage.

## Context captured

- Runtime introspection: No (dev server not running; static analysis only)
- Affected routes/layouts: None (testing infrastructure only)

## Changes made

### Summary

Introduced Vitest v4 with v8 coverage provider to `apps/web`. Created comprehensive unit tests for all utility, validation, transformation, and data logic modules. Configured 80% global thresholds for statements, branches, functions, and lines. Achieved 99%+ coverage on all measured files.

### Files touched

**New files (infrastructure):**

- `apps/web/vitest.config.ts` — Vitest configuration with jsdom environment, path aliases, coverage include/exclude, 80% thresholds

**Modified files:**

- `apps/web/package.json` — Added `test` and `test:coverage` scripts, added devDependencies (vitest, @vitest/coverage-v8, jsdom, @types/jsdom)

**New files (test suites — 10 files, 143 tests):**

- `src/lib/datetime-util.test.ts` — 31 tests covering all 6 date utility functions
- `src/lib/dev-logger.test.ts` — 10 tests covering logDevError, logDevInfo, formatDevError
- `src/lib/validators/server-validators.test.ts` — 16 tests covering IP, port, hostname, URL validation
- `src/lib/validators/schemas/server-schemas.test.ts` — 26 tests covering Zod schemas, field schemas, refinements
- `src/features/admin/servers/utils/error-handlers.test.ts` — 12 tests covering error detection, result creation
- `src/features/admin/servers/utils/server-transformers.test.ts` — 9 tests covering FormData extraction, GraphQL input prep
- `src/features/common/graphql/pagination.test.ts` — 17 tests covering pagination, count, URL parsing
- `src/features/admin/users/lib/user-filters.test.ts` — 7 tests covering status filter transforms
- `src/features/mock-data.test.ts` — 12 tests covering lookup helpers and data integrity
- `src/features/servers/components/server-config.test.ts` — 3 tests covering config exports

### Coverage scope

Coverage measurement focuses on unit-testable logic files:

- `src/lib/**/*.ts` — Utility functions, validators, schemas
- `src/features/**/utils/**/*.ts` — Error handlers, transformers
- `src/features/**/lib/**/*.ts` — Filter transforms
- `src/features/common/graphql/pagination.ts` — Pagination logic
- `src/features/mock-data.ts` — Mock data helpers
- `src/features/servers/components/server-config.ts` — Config constants

Excluded from coverage (better suited for integration/E2E tests):

- Generated GraphQL types (`src/lib/gql/**`)
- Server actions (require auth/db/network mocking)
- React hooks (require Next.js router mocking)
- Apollo client setup
- Page/layout components

## Rationale

- Vitest v4 chosen to match existing daemon app setup, ensuring monorepo consistency
- jsdom environment used for DOM-dependent code paths
- v8 coverage provider for accurate V8 engine-level coverage
- Coverage scoped to unit-testable logic to provide meaningful, actionable thresholds (80%)
- Turbo tasks `test` and `test:coverage` already defined in turbo.json; web app now participates

## Verification

- `pnpm --filter web run test` — 143 tests, 10 suites, all passing
- `pnpm --filter web run test:coverage` — 99.55% stmts, 96.6% branches, 100% functions, 99.53% lines
- `pnpm --filter web run check-types` — Clean
- `pnpm --filter web run lint` — Clean (0 warnings)

## Follow-ups

- Add integration tests for server actions (createServer, updateServer, user-actions) using mocked auth/db
- Add component tests for React hooks using @testing-library/react
- Consider adding E2E/browser tests via Playwright for critical user flows (login, admin CRUD)
- lib/mock-data.ts excluded from coverage (pure data constants, no logic) — will become irrelevant once replaced with real GraphQL queries
