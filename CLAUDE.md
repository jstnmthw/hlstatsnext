# CLAUDE.md — Instructions for Claude Code

This file tells Claude Code how to work on the **hlstatsnext.com** project. Treat the facts and conventions here as authoritative for every conversation in this repo.

## Project context

`hlstatsnext.com` is a modern, full-stack rewrite of HLstatsX:CE — a player/server statistics platform for Half-Life engine games (CS 1.6, CS:S, CS:GO, CS2, TF2, DoD, NS, HL2DM, etc.). A long-running daemon ingests UDP log events from game servers, processes them through a CQRS-style pipeline, persists to MySQL via Prisma, publishes domain events via RabbitMQ, and exposes the data through a GraphQL API consumed by a Next.js web frontend.

This is a **production system** with three tightly-coupled processes: the daemon must never lose events; the API must enforce strict authz on sensitive models; the web app is the public face of the leaderboards and admin console.

## Monorepo layout

Turborepo + pnpm workspaces. Three apps and several packages under `@repo/*`:

```
apps/
├── api/        GraphQL Yoga + Pothos schema builder. Entry: src/index.ts. Schema bootstrap: src/pothos-schema.ts. Pothos builder: src/builder.ts.
├── daemon/     Long-running UDP ingester + RCON + RabbitMQ. Entry: src/main.ts (HLStatsDaemon class). DDD-ish: modules/ + shared/{application,infrastructure}.
└── web/        Next.js 16 (app router, React 19). Apollo Client 4 → API. Tailwind 4 + shadcn/ui (via @repo/ui).

packages/
├── auth/                       Better Auth 1.6.x wrapper. Session/Account/Verification models live here.
├── config/{eslint,tailwind,typescript}  Shared configs. Extend, do not fork.
├── crypto/                     Argon2 wrapper. RCON passwords + Better Auth password hashing.
├── db/                         Prisma 7 + MySQL/MariaDB. Schema: prisma/schema.prisma. Exports: client, graphql/types, codegen.
├── observability/              Prometheus client + Prisma metrics extension. Add new metrics here.
├── plugins/amx/                AMX plugin management for game servers.
└── ui/                         Shared React component library (shadcn/ui).
```

Turbo task graph essentials: `build` depends on `^build`; codegen is `turbo run graphql:codegen`; `db:generate` runs Prisma + Pothos type generation. See `turbo.json` for the full task definitions and the 49 globally-tracked env vars.

## Where things live

| Concern                                   | File                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| API entry                                 | `apps/api/src/index.ts` (Yoga, depth limit, introspection toggle, CORS)                               |
| Pothos SchemaBuilder                      | `apps/api/src/builder.ts`                                                                             |
| GraphQL schema bootstrap + security model | `apps/api/src/pothos-schema.ts` (exclusion lists + `requireAdminResolver`)                            |
| Daemon entry                              | `apps/daemon/src/main.ts` (`HLStatsDaemon` class)                                                     |
| RabbitMQ surface                          | `apps/daemon/src/shared/infrastructure/messaging/queue/rabbitmq/{client,consumer,event-processor}.ts` |
| RCON schedulers/timers                    | `apps/daemon/src/modules/rcon/schedulers/rcon-schedule.service.ts`                                    |
| Server state (unbounded-collection risk)  | `apps/daemon/src/modules/server/state/server-state-manager.ts`                                        |
| Prisma schema                             | `packages/db/prisma/schema.prisma`                                                                    |
| Observability metrics                     | `packages/observability/`                                                                             |
| Auth                                      | `packages/auth/` (Better Auth)                                                                        |
| Pre-commit hook                           | `.husky/pre-commit`                                                                                   |
| Docker stack                              | `docker-compose.yml` (scripts in root `package.json` under `docker:*`)                                |

## Critical conventions

- **TypeScript strict + ESM throughout.** `import` from `@repo/*` for workspace packages. The Prisma client comes from `@repo/db/client`; Prisma types from `@repo/db/graphql/types`.
- **Pothos resolver pattern.** Auto-generated resolvers via the Prisma plugin; custom objects/resolvers for anything in the security exclusion lists. The four lists in `pothos-schema.ts` are load-bearing: `AUTH_MODELS` (Better Auth internals — never expose), `CUSTOM_MODELS` (replace auto-generated), `SENSITIVE_MODELS` (strip secrets via custom object), `ADMIN_ONLY_MODELS` (gate behind `requireAdminResolver`).
- **`requireAdminResolver`** wraps auto-generated query/mutation resolvers for admin-only models. Any new admin-only model must be added to the exclusion list AND its resolvers wrapped.
- **Better Auth sessions** are the source of truth for `ctx.user`. Don't roll new session logic — extend Better Auth.
- **Winston logger** with `[component]` prefix. Match existing conventions.
- **Prometheus metrics** are defined in `packages/observability/`. New metrics go there, not inline.
- **RCON credentials** are encrypted at rest via `@repo/crypto` (Argon2) using `ENCRYPTION_KEY` from env. Never log, never serialize.
- **Yoga security plugins**: `maxDepthPlugin(7)` and `useDisableIntrospection()` (prod only) live in `apps/api/src/index.ts`. Don't remove without explicit security review.

## Test tiers

Three Vitest configurations, each with a different cost/realism trade-off. Match the tier to the surface you're testing:

| Tier        | Config                          | Dependencies                             | When to write                                                        |
| ----------- | ------------------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| Unit        | `vitest.config.mjs` (per app)   | Mocks via `vitest-mock-extended`         | Pure logic, validators, formatters, individual handlers in isolation |
| Integration | `vitest.integration.config.mjs` | Real MySQL (via docker-compose.test.yml) | Repository methods, Prisma queries, anything that touches the DB     |
| E2E         | `vitest.e2e.config.mjs`         | MySQL + RabbitMQ + Garnet (Redis)        | Daemon lifecycle, full event pipeline, RCON flows                    |

Commands: `pnpm test` (unit), `pnpm test:integration`, `pnpm test:e2e`. Coverage: `pnpm test:coverage`.

E2E requires `pnpm docker:test:up` first; tear down with `pnpm docker:test:down`.

## Codegen pipeline

Three generators must stay in sync after any schema change:

1. `pnpm db:generate` — generates Prisma client + Pothos `PrismaTypes` from `schema.prisma`
2. `pnpm codegen` — generates Apollo client types from the API SDL (consumed by `apps/web`)
3. `pnpm check-types` — verifies nothing drifted

Run all three after editing `packages/db/prisma/schema.prisma`, custom Pothos objects in `apps/api/src/`, or any GraphQL operation in `apps/web/src/`. The `/codegen` skill orchestrates this.

## Pre-commit hook

`.husky/pre-commit` runs (in order): `pnpm check-types`, `pnpm test`, `pnpm lint`, `pnpm format`. This is **heavy** — the full unit test suite runs on every commit.

- Do not trigger commits casually. Let the user drive `git commit`.
- Never use `--no-verify` to bypass the hook unless the user explicitly asks for it.
- If `format` modifies files, the commit will need to be re-staged.

## Output conventions

| Output                                                      | Location                                                                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implementation plans                                        | `docs/plans/<feature>.md`                                                                                                                         |
| Audit findings (security, quality, review, daemon, graphql) | `docs/audits/<category>-<target>-<YYYY-MM-DD>.md`                                                                                                 |
| Architecture / deployment / best-practices docs             | `docs/<TOPIC>.md` (top-level, ALL_CAPS — match the existing convention: `ARCHITECTURE.md`, `BEST_PRACTICES.md`, `PRODUCTION_DEPLOYMENT.md`, etc.) |

Never silently overwrite a dated file — append a numeric suffix (`-2`, `-3`).

## Skills available in this project

| Slash                | Purpose                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `/plan <feature>`    | Feasibility + phased plan → `docs/plans/`                        |
| `/execute <plan>`    | Execute a plan phase-by-phase, tick checkboxes                   |
| `/security <target>` | Web/API/auth/RCON security audit → `docs/audits/security-*`      |
| `/quality <target>`  | God files, mixed concerns, duplication → `docs/audits/quality-*` |
| `/review <target>`   | Code review against project conventions → `docs/audits/review-*` |
| `/doc <target>`      | Generate/update READMEs, ARCHITECTURE, JSDoc                     |
| `/codegen`           | Run Prisma + GraphQL codegen; detect schema drift                |
| `/daemon <scope>`    | Memleak + stability audit tuned for the daemon                   |
| `/graphql <scope>`   | Pothos + Yoga + Apollo security/correctness audit                |

## What NOT to do

- **Don't add comments by default.** Only explain WHY when non-obvious. Don't restate what the code does.
- **Don't run destructive migrations** (`prisma migrate reset`, `db:reset`) without explicit user confirmation, even in dev.
- **Don't bypass Husky** with `--no-verify`.
- **Don't commit `.env*` files** or anything containing `ENCRYPTION_KEY`, `STEAM_API_KEY`, `BETTER_AUTH_SECRET`, RCON passwords, or DSNs with credentials.
- **Don't add fields to `AUTH_MODELS`/`SENSITIVE_MODELS`/`ADMIN_ONLY_MODELS`** without also updating `pothos-schema.ts` exclusions — the security model is enforced through those lists.
- **Don't introduce a 4th codegen** — fold any new generation into the existing Prisma/Pothos/Apollo pipeline.
- **Don't add a new `setInterval`/`setTimeout` to the daemon** without a paired `clearInterval`/`clearTimeout` in the shutdown path. The daemon must be cleanly stoppable.
