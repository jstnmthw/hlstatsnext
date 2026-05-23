---
name: codegen
description: "Orchestrate the hlstatsnext.com codegen pipeline (Prisma client + Pothos types + Apollo client types) and detect schema drift. Use after schema changes, after pulling main, or when types appear to disagree with the schema."
argument-hint: '[no args, or "check" to dry-run, or "diff" to show what changed]'
model: opus
effort: medium
---

# Codegen Orchestrator

Run the three-stage codegen pipeline in the correct order and detect drift between Prisma schema, Pothos GraphQL types, and Apollo client types.

## When to invoke

- After editing `packages/db/prisma/schema.prisma`
- After adding/changing custom Pothos objects in `apps/api/src/`
- After adding/changing GraphQL operations (queries/mutations) in `apps/web/src/`
- After pulling main when teammates have changed any of the above
- When `pnpm check-types` fails with codegen-output errors
- When CI complains about generated-file drift

## Pipeline order

The three generators MUST run in this order — earlier steps' outputs are inputs to later steps:

1. **Prisma + Pothos types** — `pnpm db:generate`
   - Generates the Prisma client (`@repo/db/client`)
   - Generates Pothos `PrismaTypes` (`@repo/db/graphql/types`)
   - Reads from: `packages/db/prisma/schema.prisma`
   - Outputs to: `node_modules/.prisma/...` and `@repo/db` generated dir
2. **Apollo client codegen** — `pnpm codegen` (alias for `turbo run graphql:codegen`)
   - Generates TypeScript types for `apps/web` GraphQL operations
   - Reads from: API SDL (introspected from a running schema or from a generated SDL file) + `apps/web/src/**/*.graphql` (or inline `gql` tags)
   - Outputs to: `apps/web` generated dir (typically `__generated__` or similar)
3. **Type check** — `pnpm check-types`
   - Validates that everything compiles end-to-end after regeneration
   - Catches: stale generated files, hand-edited types that drifted, incompatible cross-package usage

## Process

### Step 1: Read the state

Before running anything:

1. `git status` — confirm a clean working tree (or note what's dirty so user knows what's "expected drift" vs your changes)
2. Check the mtime of generated files vs the source files they're generated from. If `packages/db/prisma/schema.prisma` is newer than `node_modules/.prisma/client/index.d.ts`, regeneration is required.
3. Re-skim relevant CLAUDE.md sections — confirm the pipeline order hasn't changed since the skill was written.

### Step 2: Decide what to run

- If `$ARGUMENTS` is `check` or empty: run the pipeline. Halt and report on any failure.
- If `$ARGUMENTS` is `diff`: run the pipeline in a temporary state, capture `git diff` of generated files, then report the diff without committing it. Useful for "what would change if I regenerated right now?"

### Step 3: Run the pipeline

Execute sequentially. Stop on first failure.

```bash
pnpm db:generate
pnpm codegen
pnpm check-types
```

After each step, if it succeeds: announce success and continue. If it fails: capture the error, stop, and report.

### Step 4: Check for drift

After regeneration:

```bash
git status --short
```

If any generated files changed:

- Identify the source change that caused the drift (likely the recent schema edit or a teammate's change)
- Group the changes by app/package
- Flag any change that looks substantive (new types, removed types, signature changes) vs purely cosmetic (formatter run)

### Step 5: Report

Terminal output, no file:

```
Codegen pipeline: PASS (or FAIL at step N)

Steps:
  [✓] pnpm db:generate
  [✓] pnpm codegen
  [✓] pnpm check-types

Drift detected in N files:
  - <path> (M lines changed) — <one-line summary>
  ...

Source of drift:
  - packages/db/prisma/schema.prisma (modified <when>) — <what changed>

Next steps:
  - Review generated changes: git diff <paths>
  - Commit when satisfied: git add <paths>
  - If unintentional: git checkout -- <paths> and revert the source change
```

If `pnpm check-types` fails after regen:

1. Identify the failing files. Are they:
   - Hand-written code that needs updating to match new generated types? → list the call sites, suggest fixes
   - Generated files that shouldn't have errors? → indicates a deeper schema problem; report and stop
2. Do NOT silently patch with `any` or `@ts-ignore`. Report and let the user decide.

## Common drift scenarios

- **Added Prisma field**: cascades through Pothos types; if exposed via `t.exposeString("newField")` it must be added to the object definition or it won't appear in GraphQL
- **Renamed Prisma field**: breaks every existing Pothos resolver that referenced it; check-types will flag the call sites
- **Removed Prisma model**: breaks Pothos objects + Apollo client queries; check-types catches both
- **Added GraphQL query in apps/web** without running codegen: Apollo types missing; check-types fails in `apps/web`
- **Pothos exclusion-list edit** (`pothos-schema.ts`): if a model was added to `AUTH_MODELS` mid-codebase, every auto-generated resolver for that model disappears — Apollo codegen will fail loudly when web queries reference removed types
- **Pulled main**: teammate changed schema; you need to regen even if your own files are unchanged

## Guidelines

- Never commit generated files alongside unrelated source changes — keep generation in a separate commit so reviewers can see "this is just the regen"
- Never bypass `pnpm check-types` after a regen; an unchecked regen masks real bugs
- Never hand-edit generated files; they will be overwritten on next run
- If pnpm commands time out or hang, check Docker (db needs MySQL to introspect for some configurations) — note this but do not auto-start Docker
- If `pnpm codegen` requires the API to be running (for live SDL introspection), report that and stop; let the user start `pnpm dev` or generate SDL another way

Target: $ARGUMENTS
