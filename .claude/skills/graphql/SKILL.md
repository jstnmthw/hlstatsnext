---
name: graphql
description: "Audit the hlstatsnext.com GraphQL surface (Pothos schema + Yoga server + Apollo client) for security, correctness, performance, and exclusion-list hygiene. Produces a structured findings report. Does NOT fix code."
argument-hint: "<scope: file, module, or 'all' for full apps/api + apps/web scan>"
model: opus
effort: max
---

# GraphQL Auditor

Audit the GraphQL stack — `apps/api` (Pothos schema + Yoga server + Prisma plugin) and `apps/web` (Apollo client + generated types) — for the failure modes specific to this architecture.

This skill **audits and reports only** — it does not modify code.

## MUST FOLLOW — review/plan production rules

When producing a review, audit, or plan document, these rules are non-negotiable:

1. **Build your own todo list.** Use TaskCreate to track the scan/plan work:
   - **Phased document** target → mirror its phases as tasks.
   - **`all`** or multi-file scope → one task per concern area (schema definition, security model, resolvers, server config, client operations).
     Update status (`in_progress` → `completed`) as you progress.
2. **Dispatch the `graphql-security-scanner` sub-agent in parallel** for line-by-line scanning. The sub-agent returns structured findings; you compile, recalibrate, and write the report.
3. **Emit `[ ]` checkboxes for every finding in your output.** Downstream `/execute` ticks them as remediated.

## Context

Always read first:

- `CLAUDE.md` — exclusion-list rules, `requireAdminResolver` discipline
- `apps/api/src/builder.ts` — Pothos `SchemaBuilder` with Prisma + Relay + WithInput plugins
- `apps/api/src/pothos-schema.ts` — the four exclusion lists (`AUTH_MODELS`, `CUSTOM_MODELS`, `SENSITIVE_MODELS`, `ADMIN_ONLY_MODELS`) and `requireAdminResolver`
- `apps/api/src/index.ts` — Yoga server, `maxDepthPlugin(7)`, `useDisableIntrospection`, CORS, error masking
- `apps/api/src/modules/` — domain modules with custom objects and resolvers
- `apps/web/src/**/*.{ts,tsx,graphql}` — Apollo operations
- `packages/db/prisma/schema.prisma` — source of truth for model field exposure decisions

## Audit process

### Step 1: Scope

- **File/module**: audit that file and direct dependencies
- **Module name** (`player`, `server`, `clan`, etc.): audit `apps/api/src/modules/<name>/`
- **`all`**: audit `apps/api/src/`, `apps/web/src/` GraphQL operations, and exclusion lists

### Step 2: Read every file in scope thoroughly

The Pothos exclusion-list system is load-bearing. A single missing entry in `ADMIN_ONLY_MODELS` can expose admin-only data publicly.

### Step 3: Check each category

Dispatch the `graphql-security-scanner` sub-agent for line-by-line schema scanning. Compile findings here.

#### 3a. Exclusion-list hygiene

The four lists in `pothos-schema.ts` enforce the security model. For every Prisma model:

- **`AUTH_MODELS`** (Session, Account, Verification, etc.): must NEVER appear in any Pothos object, custom or auto-generated. Any field that references these models in a relation must be hidden or custom-resolved.
- **`CUSTOM_MODELS`** (ServerToken, etc.): the auto-generated resolvers are replaced by custom ones. Check that the custom resolver exists, is exported, and handles all CRUD operations the schema needs.
- **`SENSITIVE_MODELS`** (Server, EventRcon, etc.): auto-generated object is replaced with a custom one that strips secret fields (`rconPassword`, `password`, encrypted credentials). Verify the custom object actually omits the sensitive fields — compare against `schema.prisma`.
- **`ADMIN_ONLY_MODELS`** (User, etc.): every auto-generated query/mutation resolver must be wrapped in `requireAdminResolver`. Verify by reading the resolver registration code.

For every new model added to the Prisma schema, check that it's been classified into one of these buckets (or explicitly accepted as public via comment).

#### 3b. `requireAdminResolver` coverage

The wrapper handles both `prismaField` and plain `field` resolvers, but only protects what's wrapped. Check:

- All auto-generated query/mutation resolvers for `ADMIN_ONLY_MODELS` are wrapped
- The wrapper is applied at registration, not after — wrappers added later don't retroactively protect calls that bypassed them
- Custom resolvers that return admin-only data are wrapped explicitly (the auto-generated wrapper doesn't catch hand-written ones)
- The "is admin" check used by `requireAdminResolver` reads from Better Auth session, not a header/cookie that can be forged

#### 3c. Sensitive-field exposure

Beyond the exclusion lists:

- New Pothos object definitions don't expose `*Password`, `*Secret`, `*Token`, `*Key`, `apiKey`, `accessToken`, `refreshToken`, encrypted credential fields, raw email, IP address (unless intentional and gated), date-of-birth, or other PII without explicit acknowledgement
- `t.expose*` calls match the Prisma field exactly — no accidental aliasing that exposes a sensitive field under a tame name
- Relations exposed via `t.relation` don't transitively pull in sensitive fields (the relation target must also be a safe Pothos object)
- Scalar serialization (`Decimal`, `DateTime`, `Json`) doesn't leak internal representation that could hint at data structure

#### 3d. N+1 risk (Prisma plugin)

- Resolvers fetching related data use `t.relation` / `t.prismaField` (which the Prisma plugin batches) instead of fetching in JS after the parent loads
- Nested queries use Pothos `select` to flatten what Prisma fetches in one query
- List resolvers that fan out per-item (`.map(async item => fetch(item.id))`) are flagged — should use `groupBy`/`findMany` with `whereIn`
- Pothos `onUnusedQuery: "warn"` (set in `builder.ts`) is respected — production should be `null` or `"warn"`, not silent

#### 3e. Yoga server config

- `maxDepthPlugin(7)` enabled in production path
- `useDisableIntrospection()` enabled in production
- Errors masked in production (`maskedErrors: { isDev: false }` equivalent)
- CORS `origin` is a specific URL list in production, not `*`
- No introspection-exposing dev tools mounted on a production-facing port

#### 3f. Custom resolver correctness

For every custom resolver (not auto-generated):

- Auth check at the start, not after side effects
- Input validation present (use `zod` or Pothos `validate` plugin if available)
- Pagination respects Relay conventions if the model is paginated
- Errors thrown are `GraphQLError` (or wrapped) with safe messages — internal exceptions are masked
- No `console.log` of request payloads (which may include sensitive input)

#### 3g. Apollo client (apps/web)

- All operations imported from generated codegen output — no hand-rolled types
- Operations have stable, typed `id` fields for cache normalization
- Subscriptions (if any) handle reconnect cleanly
- `useQuery` / `useSuspenseQuery` / server-component `query()` used consistently per surface
- Errors surfaced to users via UI, not silently swallowed
- No private operations rendered on public pages (auth check at the Next.js route level)

#### 3h. Schema evolution

- Renames are non-breaking: new field added → old field deprecated → old field removed in a later release
- Type narrowing (e.g., `String!` → `Int!`) flagged as breaking
- Removed fields: confirm no Apollo operation in `apps/web` still references them; confirm no external consumer relies on them

### Step 4: Write report

Write to:

```
docs/audits/graphql-<scope-slug>-<YYYY-MM-DD>.md
```

```markdown
# GraphQL Audit: <scope>

**Date:** YYYY-MM-DD
**Scope:** <what was audited>
**Estimated security:** <Low / Medium / High>

## Summary

<2-3 sentences. Findings: X critical, Y warning, Z info.>

## Findings

### [CRITICAL] <title>

- [ ] **File:** `path:line`
      **Category:** <exclusion-list | requireAdmin | sensitive-exposure | n+1 | yoga-config | resolver-correctness | client | schema-evolution>
      **Description:** <vulnerability or defect>
      **Evidence:** <quote the code>
      **Remediation:** <specific fix>

### [WARNING] ...

### [INFO] ...

## Coverage matrix

| Model  | Bucket     | Custom object | `requireAdminResolver` | Notes                 |
| ------ | ---------- | ------------- | ---------------------- | --------------------- |
| User   | ADMIN_ONLY | Yes           | Yes                    | OK                    |
| Server | SENSITIVE  | Yes           | N/A                    | rconPassword stripped |
| ...    | ...        | ...           | ...                    | ...                   |

(Fill this in when scope includes the exclusion-list system.)

## Stable patterns found

<Patterns worth keeping/emulating — well-structured resolvers, correct exclusion handling, clean Apollo operations.>

## Recommendations

<Quick wins / Medium / Architectural.>

## Provenance

<Sub-agent returned N CRITICALs; M survived recalibration. Notes on demotions.>
```

After writing, print a 2-4 line summary. Do not paste the whole document.

## Severity levels

CRITICAL bar — all three must hold:

1. The flaw exposes sensitive data, allows privilege escalation, or breaks the security model in a way exploitable by an unauthenticated or low-privileged actor
2. The exposure is on the deployed surface (not behind a feature flag, not in a dev-only path)
3. No in-process compensating mechanism (auth wall, exclusion-list entry, depth limit) prevents the exploit

- **CRITICAL** — meets the bar. Fix before deploying.
- **WARNING** — security-relevant but requires unusual conditions or already-privileged actor; or a correctness defect that breaks queries.
- **INFO** — defense-in-depth, performance concern, missing observability.

### Severity recalibration is mandatory

Sub-agents inflate severity. Before publishing:

1. **Verify every CRITICAL against source** — open the file, confirm the claim. Demote on disagreement.
2. **Apply the 3-part bar.** Demote failures.
3. **Document recalibration in `## Provenance`.**

## Guidelines

- The exclusion-list system is load-bearing — extra scrutiny on changes there
- A missing `requireAdminResolver` wrap on an `ADMIN_ONLY_MODEL` is CRITICAL by default
- Exposing a `*Password` or `*Token` field is CRITICAL by default
- Don't flag legitimate public surface as a security issue — public leaderboards exposing player stats is the product
- N+1 problems are WARNING by default, CRITICAL only if they cause production timeouts at current scale
- A clean audit on the exclusion lists is valuable; say so explicitly
- Cross-reference `/security` findings if both have been run on overlapping scope
- Do not propose schema rewrites without flagging scope

Target: $ARGUMENTS
