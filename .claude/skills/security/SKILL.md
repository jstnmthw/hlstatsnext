---
name: security
description: "Audit hlstatsnext.com code for web/API/auth/RCON security vulnerabilities. Produces a structured findings report. Use before deploying, after major features land, or before exposing new surface area."
argument-hint: "<target: file, module, app, or 'all'>"
model: opus
effort: max
---

# Security Auditor

Audit hlstatsnext.com code for vulnerabilities across the full stack: GraphQL/Pothos exposure, Better Auth, Prisma injection, RCON credentials, Next.js, env-var leakage, and supply chain.

## MUST FOLLOW — review/plan production rules

When producing a review, audit, or plan document, these rules are non-negotiable:

1. **Build your own todo list.** Use TaskCreate to track the scan/plan work before you start:
   - If the target is a **phased document** (an existing audit you're updating or continuing), mirror its phases as tasks.
   - If the scope is **`all`** or a multi-file / multi-module scan, create one task per file or concern area.
     Update task status (`in_progress` → `completed`) as you progress.
2. **Dispatch review agents in parallel when applicable.** Independent files/modules can be scanned in parallel via Agent tool calls in one message. Use the `graphql-security-scanner` sub-agent for Pothos/Yoga work. Fall back to sequential only when one finding informs another.
3. **Emit `[ ]` checkboxes for every finding in your output.** Downstream `/execute` will tick them as remediated.

## Baseline

Always read first:

- `CLAUDE.md` — project conventions and exclusion-list rules
- `apps/api/src/pothos-schema.ts` — exclusion lists (`AUTH_MODELS`, `CUSTOM_MODELS`, `SENSITIVE_MODELS`, `ADMIN_ONLY_MODELS`) + `requireAdminResolver`
- `apps/api/src/index.ts` — Yoga security plugins (depth limit, introspection toggle, CORS, error masking)
- Any prior `docs/audits/security-*.md` for this scope — don't re-flag findings that were already triaged

## Audit process

### Step 1: Scope

- **File/module**: audit that file and anything it directly calls
- **App**: audit a full app (`apps/api`, `apps/daemon`, `apps/web`)
- **`all`**: audit every `.ts`/`.tsx` file under `apps/` and `packages/` excluding generated and test files

### Step 2: Read every file in scope thoroughly

Read line-by-line. Skim mode misses the subtle stuff (a missing `await` before a permission check; a `select` that returns a sensitive field; a CORS origin set to `*`).

### Step 3: Check each category

#### 3a. GraphQL exposure (Pothos + Yoga)

Delegate the schema-wide scan to the `graphql-security-scanner` sub-agent when scope is `apps/api` or larger. For smaller scopes, check inline:

- Auto-generated resolvers on `ADMIN_ONLY_MODELS` must be wrapped in `requireAdminResolver`
- Fields from `AUTH_MODELS` / `SENSITIVE_MODELS` / `CUSTOM_MODELS` must NOT appear in any exposed Pothos object
- New `prismaObject` definitions must not expose `*Password`, `*Secret`, `*Token`, `apiKey`, encrypted credential fields, or PII without explicit acknowledgement
- `maxDepthPlugin(7)` present in prod path; `useDisableIntrospection()` enabled in prod
- CORS origin is a specific URL in prod, not `*`
- Errors masked in prod (`maskedErrors`) — internal error details must not leak
- Resolvers performing privileged actions check auth at the start, not after side effects
- Mutations that change permissions/roles require explicit re-authorization (not just session presence)

#### 3b. Authentication (Better Auth)

- Sessions validated server-side on every authenticated route (Next.js server components, API resolvers, daemon HTTP handlers if any)
- No use of `localStorage` for session tokens in the web app
- Password hashing via `@repo/crypto` (Argon2) — no SHA/MD5/bcrypt for new code
- Account linking / OAuth (Steam, etc.) verifies state/nonce; redirect URIs allowlisted
- Session cookies use `Secure`, `HttpOnly`, `SameSite=Lax` (or stricter)
- Login/registration rate-limited at the edge or in the resolver
- Account enumeration via timing or distinct error messages avoided
- Email verification flow doesn't expose tokens in logs

#### 3c. RCON & game-server credentials

The daemon's RCON surface is high-risk because credentials are stored at rest and used to issue privileged commands to remote game servers.

- RCON passwords encrypted via `@repo/crypto` before persistence — never stored plain in DB or logs
- `ENCRYPTION_KEY` loaded from env, never committed; the `.env.example` uses a placeholder
- Decrypted RCON passwords held in memory only as long as needed; not logged, not put in error messages
- RCON command construction validates user-controlled input (no shell-style injection into RCON protocol strings)
- Connection-string parsing safe against control-char injection
- Scheduled RCON commands have per-command timeouts (no infinite wait on dead servers)
- Token-based auth for servers (if used) uses cryptographically random tokens of sufficient length

#### 3d. Prisma & SQL injection

- Raw queries (`$queryRaw`, `$executeRaw`) use the tagged-template form (parameterized) — never the `Unsafe` variants with concatenation
- User-supplied filter fields not passed directly as Prisma `where` keys (whitelist allowed keys)
- `orderBy` / `select` driven by user input is restricted to a whitelist
- Soft-delete / "include hidden" toggles cannot be flipped by unauthenticated requests
- Multi-tenant scoping (server, clan, game): every query that returns scoped data includes the scope filter — flag any query missing it

#### 3e. Daemon ingestion (UDP + RabbitMQ)

- UDP packets are size-bounded; oversize packets dropped, not buffered
- Log-line parsing handles malformed input without throwing into the event loop
- RabbitMQ message handlers explicitly nack-or-dead-letter on parse failure; no silent drop that hides corruption
- Per-server origin validation on UDP source — packets from unknown servers either rejected or rate-limited
- Cross-server contamination prevented: events from server A cannot mutate server B's state by spoofing server IDs

#### 3f. Web app (Next.js + Apollo)

- No secrets in client bundles (check `NEXT_PUBLIC_*` envs for sensitive data)
- Server actions / API routes validate auth via Better Auth, not just trust headers
- XSS: any `dangerouslySetInnerHTML` justified and sanitized
- Open redirect: `redirect` / `router.push` with user-controlled paths restricted to internal routes
- CSP headers configured (if not, flag as INFO)
- Image proxies (`next/image` remote patterns) restricted to known hosts
- File upload endpoints validate MIME type, size, and storage path

#### 3g. Secrets & env

- `.env*` in `.gitignore`; no secret material committed to history
- Sensitive env vars in `turbo.json` `globalEnv` so Turbo doesn't cache outputs differently between environments
- Log statements scrubbed of secret material (no `console.log({...config})` if config contains keys)
- Container images don't bake secrets at build time
- `ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, `STEAM_API_KEY`, DSNs, RCON passwords, JWT signing keys: enumerate where each is used and confirm no leakage

#### 3h. Supply chain & dependencies

- `pnpm audit` clean (or known-issues documented)
- New dependencies vetted: maintained, popular, not typo-squats
- `pnpm.overrides` and `peerDependencyRules` in root `package.json` reviewed when changed
- Postinstall scripts blocked by default (`onlyBuiltDependencies` and `ignoredBuiltDependencies` lists in root `package.json`)

### Step 4: Write report

Write to:

```
docs/audits/security-<target-slug>-<YYYY-MM-DD>.md
```

```markdown
# Security Audit: <target>

**Date:** YYYY-MM-DD
**Scope:** <what was audited>

## Summary

<overall assessment>
**Findings:** X critical, Y warning, Z info

## Findings

### [CRITICAL] <title>

- [ ] **File:** `path:line`
      **Category:** <category from above>
      **Description:** <vulnerability and how it would be exploited>
      **Evidence:** <quote the specific code>
      **Remediation:** <specific fix>

### [WARNING] ...

### [INFO] ...

## Passed checks

<things you verified are correct — builds confidence and tells the user what NOT to change>

## Recommendations

<grouped by effort — Quick wins / Medium / Architectural>
```

After writing, print a 2-4 line summary with the file path and finding counts. Do not paste the whole document.

## Severity levels

The bar for CRITICAL is strict. A finding is CRITICAL only when ALL of these hold:

1. The vulnerability is exploitable now, against the deployed surface (prod or near-prod)
2. The exploitation does not require an already-privileged actor
3. There is no in-process compensating mechanism (auth wall, depth limit, masked errors, network ACL) that prevents the exploit

If any clause fails, the finding is WARNING or INFO. When in doubt, downgrade.

- **CRITICAL** — Exploitable now by an unauthenticated or low-privilege actor against the deployed surface. Fix before deploying.
- **WARNING** — Violates security practices or is exploitable only in a specific configuration / by an already-privileged actor. Fix before feature complete.
- **INFO** — Defense-in-depth, missing observability, or a practice that should be improved. Address when convenient.

### Severity recalibration is mandatory

Subagents auditing in parallel inflate severity. Before publishing:

1. **Verify every CRITICAL claim against source.** Open the cited file at the cited line and check the claim holds; demote on disagreement.
2. **Apply the bar above.** Any CRITICAL that fails clauses 1, 2, or 3 is demoted to WARNING with the reason recorded inline.
3. **Document the recalibration.** Note in a `## Provenance` section how many CRITICALs were demoted and why.

## Guidelines

- Be specific — quote exact code, show exact fix
- Don't flag theoretical issues that can't happen given the architecture
- Do flag missing checks even if nothing currently triggers them (defense-in-depth)
- The exclusion-list system in `pothos-schema.ts` is load-bearing — extra scrutiny on changes there
- A clean audit is valid — say so explicitly with `Passed checks` so the user knows what was verified

Target: $ARGUMENTS
