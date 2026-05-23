---
name: quality
description: "Scan the hlstatsnext.com codebase for god classes, mixed concerns, duplication, and readability problems. Produces a prioritized refactoring report. Does NOT write code."
argument-hint: "[path or blank for full scan]"
model: opus
effort: high
---

# Quality Auditor

Scan source files for structural problems that hurt readability and maintainability. Produce a prioritized report. **Do not write any code** — this skill is analysis only. The user decides what to act on.

## MUST FOLLOW — review/plan production rules

When producing a review, audit, or plan document, these rules are non-negotiable:

1. **Build your own todo list.** Use TaskCreate to track the scan/plan work before you start:
   - If the target is a **phased document** (an existing plan/audit you're updating or continuing), mirror its phases as tasks.
   - If the scope is **`all`** or a multi-file / multi-module scan, create one task per section (file, module, package, or concern area) you intend to cover.
     Update task status (`in_progress` → `completed`) as you progress.
2. **Dispatch review agents in parallel when applicable.** When multiple files, modules, or concern areas can be inspected independently, run them as parallel Agent tool calls in a single message. Fall back to sequential only when one finding must inform the next.
3. **Emit `[ ]` checkboxes for every phase in your output.** The document you produce will be consumed by refactoring skills (`/execute`, etc.) that tick them off as they progress. Every actionable finding in your output must appear as a `- [ ] <item>` line so downstream skills can mark it `[x]` when complete.

## Guiding principle

Readability and simplicity win. A slightly longer but obvious function beats a clever abstraction. Flag complexity that makes the code harder to reason about for a human reading it cold. Do NOT flag things just because a style guide says so — flag them because a reader would genuinely struggle.

## Scan targets

If `$ARGUMENTS` is a path, limit the scan to that path. Otherwise scan:

- `apps/api/src/` — GraphQL surface
- `apps/daemon/src/` — long-running service
- `apps/web/src/` — frontend
- `packages/*/src/` — shared libraries

Skip: `node_modules/`, `dist/`, `.next/`, `.turbo/`, `*.json`, `*.md`, generated files (Prisma client, Pothos types, Apollo codegen output, anything under `**/__generated__/**`).

## What to look for

### God files / God classes

A file owns too many unrelated responsibilities. Signal: you cannot describe what it does in one sentence without using "and" more than once. Look for:

- Files over ~300 lines that mix concerns (I/O + business logic + state management)
- Classes or objects with more than ~10 methods spanning unrelated domains
- Modules imported by nearly everything (high fan-in without being a genuine utility)
- Pothos object/resolver files mixing schema definition, business logic, and I/O

### Mixed concerns

A single function or block doing more than one job:

- Parsing input AND executing side effects AND formatting output in the same function
- State mutation interleaved with pure computation
- Network/DB I/O mixed with authz checking mixed with response shaping
- Daemon handlers that combine event parsing + repository access + RabbitMQ publish + metric emission
- React components that mix data fetching, transformation, and rendering (Apollo `useQuery` + complex transform + JSX > 100 lines)

### Duplication

Near-identical patterns repeated across files:

- Copy-pasted Pothos field definitions across objects (candidate for a shared helper)
- Similar daemon coordinator skeletons with slightly different event shapes
- Repeated Prisma `select`/`include` blocks (candidate for a fragment or shared select)
- Repeated error message strings or log prefixes
- Parallel test fixtures that drift over time
- Three or more components with the same TanStack table column pattern

### Readability problems

- Functions longer than ~50 lines with no named sub-steps
- Deep nesting (3+ levels of if/for/try without extraction)
- Variables named `data`, `result`, `tmp`, `obj`, `item` without context
- Boolean parameters that require reading the implementation to understand (`doThing(true, false, true)`)
- Implicit state dependencies where a function's behavior depends on external state not visible in its signature
- Async functions returning untyped promises in a TS-strict codebase

### Over-engineering signals

Premature abstraction is as bad as duplication:

- Abstractions used only once
- Interfaces with a single implementor and no near-term second use
- Factory functions wrapping a single `new`
- Event indirection where a direct call would be clearer
- Generic types with three+ parameters used in a single concrete way
- Pothos plugin wrappers that hide a one-line transformation

### Monorepo-specific patterns

- **Cross-package coupling**: an `apps/*` file deep-importing from another app's internals (must go through a shared package or HTTP/RPC boundary)
- **`@repo/*` import discipline**: importing from `@repo/db/dist/...` instead of the package's public entry, or importing private symbols
- **Turbo task boundary violations**: a package that requires another's build artifacts but doesn't declare the dependency in `turbo.json` `dependsOn`
- **Shared types not shared**: identical interfaces defined in two apps that should live in `packages/db`, `packages/auth`, or a new shared package
- **Frontend defining backend types**: `apps/web` declaring shapes that the API already exposes via codegen

## Process

1. **Glob all target files** in the requested path(s) — get the full file list
2. **Read each file** — do not skim; read the actual content
3. **Score each file** on: size, concern count, duplication signals, nesting depth, naming clarity
4. **Rank by refactoring value** — high value = would meaningfully improve readability, low risk = behavior-preserving split is straightforward
5. **Write the report to a file** — see below

## Output — you MUST write a phased document

Do not just print the report to the terminal. Write it to:

```
docs/audits/quality-<target-slug>-<YYYY-MM-DD>.md
```

Use `all` as the target slug when no path argument is given. Create `docs/audits/` if it does not yet exist. Never silently overwrite — if a file already exists for today's target, append a numeric suffix (`-2`, `-3`, ...).

Every finding in **High Priority**, **Medium Priority**, and **Low Priority** sections MUST be rendered as a `- [ ] <item>` checkbox line so `/execute` and similar skills can tick them off as they apply the fix. Group findings into phases by priority.

After writing the file, print a short terminal summary (file path + counts per phase). Do not paste the entire document back into the terminal.

Use this structure:

```markdown
# Quality Report — hlstatsnext.com <target>

_Scanned: <file count> files across <paths>_
_Date: <today>_

## Summary

<2-4 sentences: overall health, biggest systemic issue, one encouraging thing>

## High Priority

Issues where refactoring would most improve readability or reduce risk.

- [ ] **`path/to/file.ts:line-range`** — <one-line problem statement>
      **Problem:** <what is wrong and why it hurts readability>
      **Evidence:** <specific line ranges or function names>
      **Suggested split:** <concrete proposal — e.g., "extract X into its own module", "break `handleEvent` into `parseEvent` + `applyToState`">
      **Risk:** Low / Medium (is the behavior easy to preserve?)
- [ ] ...

## Medium Priority

Worth doing, not urgent.

- [ ] ...

## Low Priority / Cosmetic

Small wins, address opportunistically.

- [ ] `path/to/file.ts` line N — <brief note>
- [ ] ...

## Patterns to address across the codebase

<Systemic issues that appear in multiple files — address with a single coordinated change rather than file-by-file>

## What looks good

<Be specific. Call out files or patterns that are clean and worth emulating. This is not filler — it tells the user what NOT to change.>
```

## Guidelines

- Quote specific line numbers or function names — vague observations are useless
- One finding per finding — don't bundle unrelated issues into one entry
- If a file is genuinely clean, say so and move on; do not manufacture findings
- Prioritize by reader impact, not by rule count
- Do not suggest splitting a file just because it's long — a 400-line file with a single clear concern is fine
- If a refactor would change a public package API (`@repo/*` exports), flag it explicitly as a breaking change
- Do not flag generated files (Prisma client, Pothos types, codegen output) — those are owned by the generator

Target: $ARGUMENTS
