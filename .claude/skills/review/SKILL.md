---
name: review
description: "Code review against hlstatsnext.com conventions, security practices, and full-stack best practices (Pothos, Prisma, Next.js, daemon). Use when the user asks for a code review or second opinion on code."
argument-hint: "<files or feature>"
model: opus
effort: high
---

# Reviewer

Review code changes against hlstatsnext.com conventions, security practices, and full-stack best practices.

## MUST FOLLOW — review/plan production rules

When producing a review, audit, or plan document, these rules are non-negotiable:

1. **Build your own todo list.** Use TaskCreate to track the scan/plan work before you start:
   - If the target is a **phased document** (an existing review/audit you're updating or continuing), mirror its phases as tasks.
   - If the scope is **`all`** or a multi-file / multi-module review, create one task per file or concern area.
     Update task status (`in_progress` → `completed`) as you progress.
2. **Dispatch review agents in parallel when applicable.** When multiple files or concern areas can be inspected independently, run them as parallel Agent tool calls in a single message. Fall back to sequential only when one finding must inform the next.
3. **Emit `[ ]` checkboxes for every phase in your output.** Findings will be consumed by `/execute` and other refactoring skills.

## Review checklist

Apply only the sections relevant to the changed files.

### Conventions (CLAUDE.md alignment)

- TS strict, no `any` without justification, ESM imports
- `@repo/*` aliases used; no relative imports across app boundaries
- Winston logger with `[component]` prefix
- Prometheus metrics defined in `packages/observability` not inline
- `ENCRYPTION_KEY`/secrets never logged or serialized

### GraphQL / Pothos (`apps/api/`)

- New resolvers use the Prisma plugin (`builder.prismaObject` / `prismaField`) where possible
- Auto-generated resolvers on `ADMIN_ONLY_MODELS` are wrapped in `requireAdminResolver`
- New models exposed via GraphQL are NOT in `AUTH_MODELS`/`SENSITIVE_MODELS`/`ADMIN_ONLY_MODELS` without an explicit custom object that strips sensitive fields
- Prisma N+1 risks: resolvers use `t.relation` / `t.prismaField` instead of fetching in JS; nested selects use Pothos `select`
- Relay pagination correctness (cursor encoding, edge ordering)
- `maxDepthPlugin(7)` is not bypassed; introspection stays disabled in prod
- CORS origin allowlist updated if a new client is added
- Errors masked in prod paths

### Prisma / database (`packages/db/`)

- Migrations are reversible where reasonable; destructive ops (column drop, type narrowing) flagged in the migration name
- Schema additions include sensible indexes (FKs, fields used in `where`)
- No raw SQL with user input — always parameterized via `$queryRaw` tagged template or Prisma's query builder
- New models that hold credentials/PII go through `@repo/crypto` for at-rest encryption

### Daemon (`apps/daemon/`)

- Every new `setInterval`/`setTimeout` is stored and cleared on shutdown (`HLStatsDaemon` teardown path)
- RabbitMQ consumers explicitly ack/nack; dead-letter handling considered for poison messages
- Event handlers catch errors at the boundary — one bad event must not unwind the dispatcher
- New RCON commands respect the existing scheduler — no rogue intervals
- `server-state-manager` collections have eviction logic (PART/QUIT/server-removed)
- `process.on('SIGTERM')` teardown ordering preserved (consumers → channel → connection → Prisma `$disconnect` → exit)

### Web (`apps/web/`)

- GraphQL operations are generated via codegen, not hand-rolled types
- Apollo cache `id` fields are stable
- React Server Components vs Client Components used appropriately (no `useState`/`useEffect` in server components)
- Auth-gated routes check the Better Auth session server-side, not just on the client
- No secrets embedded in client bundles
- `next/image` used for raster images; explicit `alt` text
- TanStack table column definitions extracted when reused

### Testing

- Test exists at the right tier (unit for pure logic, integration for Prisma, e2e for daemon/MQ)
- Tests reset DB state between cases (don't leak fixtures across tests)
- Mocks are minimal; integration/e2e tests don't mock the things they're testing
- Coverage matters for new code paths — not just totals

### Security

- New endpoints/resolvers check auth before returning data
- Better Auth session is the source of truth for `ctx.user`
- RCON passwords/encryption keys never logged
- User input that flows into SQL, RCON commands, or shell goes through validation/sanitization
- New env vars are added to `turbo.json` `globalEnv` so Turbo caches correctly

## Output — you MUST write a phased document

Do **not** stop at printing findings to the terminal. Every run of this skill must produce a file at:

```
docs/audits/review-<target>-<YYYY-MM-DD>.md
```

where `<target>` is a slugified version of the scope (e.g., `server-token-resolver`, `rcon-scheduler`, `auth-flow`, `pr-1234`). Create the `docs/audits/` folder if it does not yet exist. If a review for the same target already exists for today, append a suffix (`-2`, `-3`, ...) — never silently overwrite.

Every actionable finding MUST be rendered as a `- [ ] <item>` checkbox line so `/execute` and related skills can tick them off as they complete the work. Group findings into phases by severity.

```markdown
# Review: <target>

**Date:** YYYY-MM-DD
**Scope:** <files or feature reviewed>
**Reviewer:** /review skill

## Summary

<1-2 sentence overall assessment>
**Findings:** X critical, Y warning, Z suggestion

## Phase 1 — Critical (security / correctness)

- [ ] **`path/to/file.ts:line`** — <problem statement>
      **Why:** <why it's broken or unsafe>
      **Fix:** <specific change, quoting the code>
- [ ] ...

## Phase 2 — Warning (not ideal but works)

- [ ] **`path/to/file.ts:line`** — <problem>
      **Fix:** <specific change>
- [ ] ...

## Phase 3 — Suggestion (improvements)

- [ ] **`path/to/file.ts:line`** — <improvement>
- [ ] ...

## Looks good

<Specific things worth keeping — this tells downstream skills what NOT to change>
```

After writing the file, print a 2–4 line terminal summary with the file path. Do not paste the entire document back.

## Guidelines

- Be specific — quote the problematic code and show the fix
- Prioritize: security > correctness > codegen drift > conventions > style
- Don't nitpick formatting if the code is functionally sound (Prettier handles it)
- If the code is good, say so briefly
- Cross-check against `/security`, `/quality`, `/daemon`, `/graphql` findings if those audits exist for the same target — don't duplicate

Target: $ARGUMENTS
