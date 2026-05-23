---
name: execute
description: "Execute an implementation plan step by step for hlstatsnext.com. Use when a plan markdown file exists (in docs/plans/) and the user wants it built, or when directly asked to implement something against an existing plan."
argument-hint: "<plan.md path or feature>"
model: opus
effort: high
---

# Executor

Execute an implementation plan produced by `/plan`, building features step by step against the hlstatsnext.com monorepo.

## MUST FOLLOW — phased execution rules

When a plan, audit, refactor, or similar document with phased work is provided, these rules are non-negotiable:

1. **Build your own todo list.** Use TaskCreate to mirror the document's phases/steps as tasks and update status (`in_progress` → `completed`) as you progress. Do not track progress in your head.
2. **Parallel vs sequential dispatch.** When phases/steps are independent and the plan permits it, dispatch Skilled Agents in parallel (one message, multiple Agent tool calls). When steps have dependencies (e.g., schema change must precede codegen must precede API change), dispatch them sequentially and wait for each to complete before starting the next.
3. **Check off `[ ]` boxes as you go.** If the document contains Markdown `[ ]` checkboxes, edit the document in place and mark each one `[x]` the moment the corresponding work is complete — do not batch at the end.

## Process

### Step 1: Read the plan

Read the plan markdown completely. Identify:

- The phases and their order
- Cross-phase dependencies (schema → codegen → API → web)
- App(s)/package(s) being modified
- Schema, API, daemon, or web changes
- Test tier requirements

### Step 2: Read project context

Before writing any code:

1. Re-skim relevant sections of `CLAUDE.md` (already in context)
2. Read existing code in each area being modified to understand current patterns
3. Read existing tests at the right tier to follow conventions
4. Check `package.json` in the target app/package for available dependencies
5. For daemon work: check `apps/daemon/src/main.ts` shutdown ordering
6. For API work: check `apps/api/src/pothos-schema.ts` exclusion lists
7. For schema work: check `packages/db/prisma/schema.prisma` and any pending migrations

### Step 3: Execute phase by phase

For each phase in the plan:

1. **Announce** what you're building in this phase
2. **Implement** each checklist item, writing clean code that follows project conventions (TS strict, ESM, Pothos patterns, Winston logging)
3. **Verify** using the plan's verification step — run the relevant test tier, check types, check the running surface
4. **Tick the checkbox** in the plan document immediately
5. **Report** completion of the phase and any deviations
6. **Wait for user confirmation** before proceeding to the next phase, unless the user has said to go ahead

### Step 4: Codegen discipline

If the plan includes schema or API changes, run the codegen pipeline in order — do NOT skip:

1. `pnpm db:generate` (Prisma client + Pothos types)
2. `pnpm codegen` (Apollo client types in apps/web)
3. `pnpm check-types`

If any step fails, stop and report. Do not paper over codegen drift with manual type assertions.

### Step 5: Post-implementation

After all phases are complete:

1. Run the affected test tier(s): `pnpm test` and/or `pnpm test:integration` and/or `pnpm test:e2e`
2. Run `pnpm check-types` and `pnpm lint`
3. Update any documentation affected (README, ARCHITECTURE, JSDoc on new public surface)
4. Confirm every plan checkbox is `[x]`
5. Summarize what was built, any deviations from the plan, and any TODOs

## Code conventions

**Imports — ESM with workspace package aliases:**

```typescript
import { db, Prisma } from "@repo/db/client"
import type PrismaTypes from "@repo/db/graphql/types"
import { builder } from "../builder"
import { logger } from "@repo/observability"
```

**Pothos resolver (auto-generated, simple case):**

```typescript
builder.prismaObject("Player", {
  fields: (t) => ({
    id: t.exposeID("playerId"),
    lastName: t.exposeString("lastName"),
    // ...
  }),
})
```

**Pothos admin-only auto-generated resolvers — wrap with requireAdminResolver:**

```typescript
// see apps/api/src/pothos-schema.ts for ADMIN_ONLY_MODELS list
```

**Daemon module — error boundaries + winston:**

```typescript
import { logger } from "@repo/observability"

export class FooHandler {
  async handle(event: FooEvent): Promise<void> {
    try {
      // ...
    } catch (error) {
      logger.error("[foo-handler] failed", { error, event })
      // contain at the boundary; do not rethrow into the dispatcher
    }
  }
}
```

**RabbitMQ consumer — always ack/nack:**

```typescript
// see apps/daemon/src/shared/infrastructure/messaging/queue/rabbitmq/consumer.ts for the pattern
```

**Logging:** `logger.info("[component] message", { context })` — match the existing Winston format with `[component]` prefix.

## Guidelines

- Never deviate from CLAUDE.md conventions without flagging it to the user first
- If a plan step is ambiguous, ask before guessing
- Write tests alongside code at the appropriate tier — not after
- When in doubt about which tier: unit if mockable, integration if it touches Prisma, e2e if it crosses process boundaries (daemon ↔ MQ ↔ API)
- Schema changes: use `prisma migrate dev --name <description>` for committable migrations; `db:push` is for throwaway experimentation
- Daemon work: every new timer needs a paired clear in shutdown; every new consumer needs explicit ack and dead-letter consideration
- API work: exposing a new field on a sensitive model? Check `pothos-schema.ts` exclusion lists FIRST
- Web work: respect Apollo cache normalization — new operations should have stable `id` fields
- Never commit secrets, never `--no-verify`, never `prisma migrate reset` without explicit confirmation
- The Husky pre-commit hook runs the full unit test suite — don't trigger `git commit` casually

Target: $ARGUMENTS
