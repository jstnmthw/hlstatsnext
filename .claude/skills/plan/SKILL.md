---
name: plan
description: "Analyze feature feasibility against the hlstatsnext.com monorepo and produce a structured implementation plan. Use when the user wants to plan a new feature, schema change, daemon module, or API surface before building it."
argument-hint: "<feature description>"
model: opus
effort: high
---

# Planner

Analyze feature feasibility against the current hlstatsnext.com codebase (Turborepo: `apps/api`, `apps/daemon`, `apps/web`, `packages/*`) and produce a structured implementation plan. This skill does NOT write code — it produces a markdown plan that `/execute` runs.

## MUST FOLLOW — review/plan production rules

When producing a review, audit, or plan document, these rules are non-negotiable:

1. **Build your own todo list.** Use TaskCreate to track the scan/plan work before you start:
   - If the target is a **phased document** (an existing plan/audit you're updating or continuing), mirror its phases as tasks.
   - If the scope is **`all`** or a multi-file / multi-module scan, create one task per section (file, module, package, or concern area) you intend to cover.
     Update task status (`in_progress` → `completed`) as you progress.
2. **Dispatch review agents in parallel when applicable.** When multiple files, modules, or concern areas can be inspected independently, run them as parallel Agent tool calls in a single message. Fall back to sequential only when one finding must inform the next.
3. **Emit `[ ]` checkboxes for every phase in your output.** The document you produce will be consumed by `/execute` and other refactoring skills that tick them off as they progress. Every phase, section, or actionable finding in your output must appear as a `- [ ] <item>` line so downstream skills can mark it `[x]` when complete.

## Process

### Step 1: Understand the request

Clarify what the user wants. Ask questions if the scope is ambiguous. Identify which parts of the system are affected:

- **Schema changes** (`packages/db/prisma/schema.prisma`) — these cascade through Prisma client + Pothos types + Apollo codegen
- **API surface** (`apps/api/src/`) — new Pothos objects, custom resolvers, exclusion-list updates
- **Daemon module** (`apps/daemon/src/modules/<module>`) — new ingress handler, event coordinator, scheduler
- **Web feature** (`apps/web/src/`) — new page, component, GraphQL operation
- **Shared package** (`packages/<name>`) — affects multiple apps
- **Infrastructure** — Docker, observability, env vars in `turbo.json`

### Step 2: Read the codebase

Before assessing feasibility, read:

1. `CLAUDE.md` — project conventions and load-bearing facts (already in context, re-skim relevant sections)
2. The relevant source files that would need to change
3. Any similar existing feature for pattern reference (e.g., an existing Pothos object before adding a new one; an existing daemon module before adding one)
4. `packages/db/prisma/schema.prisma` if any model is involved
5. `turbo.json` if a new task or env var is needed
6. Existing tests at the right tier (unit/integration/e2e) for the affected surface
7. `apps/api/src/pothos-schema.ts` if exposing or hiding data via GraphQL

### Step 3: Feasibility assessment

Produce a brief assessment covering:

- **Alignment**: Does this fit the monorepo's architecture? Which app(s) and package(s) own the change?
- **Codegen cascade**: Does this touch Prisma schema → Pothos types → Apollo? List the regen steps required.
- **Dependencies**: What existing modules/packages does this depend on? Are they built?
- **Security implications**: Does this expose new data via GraphQL? Need exclusion-list updates? Auth checks?
- **Blockers**: Anything that must be resolved first (missing migration, env var, infra change).
- **Complexity estimate**: S (hours) / M (day) / L (days) / XL (significant effort).
- **Risk areas**: Edge cases, codegen drift, RCON timing, RabbitMQ delivery semantics, Prisma transaction boundaries.

### Step 4: Produce the plan

Write a markdown file to `docs/plans/<feature-slug>.md` with this structure:

```markdown
# Plan: <Feature Name>

## Summary

One paragraph: what this feature does, why it's needed, which app(s) it touches.

## Feasibility

<assessment from step 3>

## Dependencies

- [ ] <thing that must exist first — e.g., migration applied, env var added to turbo.json>

## Phases

### Phase 1: <name>

**Goal:** <what this phase accomplishes>
**App/package:** <apps/daemon | apps/api | apps/web | packages/db | etc.>

- [ ] <concrete task with file path>
- [ ] <concrete task with file path>
- [ ] <verification step — what command/check proves this phase works>

### Phase 2: <name>

...

## Schema changes

<any new Prisma models/fields, with the exact schema.prisma snippet. Note migration vs db:push strategy.>

## Codegen steps

Order matters. Run after schema or API changes:

- [ ] `pnpm db:generate` (Prisma client + Pothos types)
- [ ] `pnpm codegen` (Apollo client types in apps/web)
- [ ] `pnpm check-types` (verify no drift)

## API surface changes

<new GraphQL queries/mutations, exclusion-list updates, requireAdminResolver wraps, custom objects.>

## Daemon changes

<new event handlers, RabbitMQ topics, RCON scheduled commands, shutdown ordering implications.>

## Test plan

Per tier:

- **Unit** — <what to test in isolation>
- **Integration** — <what needs real MySQL>
- **E2E** — <what needs the full Docker stack>

## Observability

<new Prometheus metrics in packages/observability, Grafana dashboard updates, Winston log additions.>

## Open questions

<anything needing user input before /execute runs>
```

### Step 5: Present to user

Print a 3-4 line terminal summary pointing at the file path. Highlight any open questions that need answers before `/execute` runs. Do not paste the entire plan back.

## Guidelines

- Plans should be executable by `/execute` without ambiguity
- Each checklist item should be small enough to complete in one focused step
- Always include verification steps — how do you know each phase works?
- Reference specific files, functions, and Pothos object names — not vague descriptions
- If the feature requires a breaking schema change (column drop, type narrowing), flag it prominently as a migration concern
- Codegen drift is the #1 source of bugs after schema changes — always include the regen sequence
- Consider Turbo task graph: if you add a script, does it need a `dependsOn` clause?
- Daemon work: think about shutdown ordering and RabbitMQ ack semantics from the start, not as an afterthought
- API work: every new field that exposes a sensitive model needs explicit acknowledgement against the exclusion lists

Target: $ARGUMENTS
