---
name: dead-code
description: "Find dead code in hlstatsnext.com — unused exports, orphan/unreferenced files, dead dependencies, unreachable branches, and stale commented-out blocks across the monorepo. Produces a confidence-tiered findings report. Does NOT delete code."
argument-hint: "<path to a file/folder, or 'all' for the whole monorepo>"
model: opus
effort: high
---

# Dead Code Finder

Hunt for code that is shipped but never reached: exported symbols no one imports, files no module references, dependencies no source uses, branches that can't execute, and large blocks left commented out. Produce a confidence-tiered report. **Do not delete or edit any code** — this skill is analysis only. The user decides what to remove.

Deletion is the easy part; being _certain_ something is dead is the hard part. The entire value of this skill is avoiding false positives — a confidently-reported "unused export" that turns out to be a framework entry point will break the build when someone trusts you and deletes it. **When in doubt, downgrade confidence.**

## MUST FOLLOW — review/plan production rules

When producing a review, audit, or plan document, these rules are non-negotiable:

1. **Build your own todo list.** Use TaskCreate to track the scan work before you start:
   - If the target is a **phased document** (an existing dead-code audit you're updating or continuing), mirror its phases as tasks.
   - If the scope is **`all`** or a multi-file / multi-package scan, create one task per scan root (`apps/api`, `apps/daemon`, `apps/web`, each `packages/*`) or per category.
     Update task status (`in_progress` → `completed`) as you progress.
2. **Dispatch the `dead-code-scanner` sub-agent in parallel** when scanning multiple roots. Each instance harvests declared exports + symbols for its root; you then run the cross-reference pass and recalibrate confidence. For independent roots, dispatch in one message.
3. **Emit `[ ]` checkboxes for every finding in your output.** Downstream `/execute` will tick them as the dead code is removed.

## What counts as dead code here

`tsc` already runs with `noUnusedLocals` and `noUnusedParameters` (see `packages/config/typescript/base.json`), and ESLint/`no-unreachable` runs on commit. So **do not re-report file-local unused imports, unused locals, or unused parameters** — the compiler already flags those on every `pnpm check-types`. This skill exists to find what the compiler _cannot_ see: deadness that only shows up when you look across file and package boundaries.

Focus, in rough order of value:

### 1. Unused exports (the main event)

An `export`ed symbol (function, class, const, type, interface, enum) that **nothing in the monorepo imports**. `tsc` cannot flag these because an export is, by definition, a public surface — it has to assume someone outside the file might use it.

- Named exports never imported anywhere across all apps + packages
- Default exports of non-entry-point modules never imported
- Re-exports (`export * from`, `export { x } from`) where the re-exported name is never consumed downstream
- Exported types/interfaces used by nothing (these are invisible at runtime, so they rot silently)

### 2. Orphan files / unreferenced modules

A source file that **no other file imports** and that is **not an entry point**. A module that only imports things but is never imported and has no side-effect role is dead weight.

### 3. Dead dependencies

- `dependencies` / `devDependencies` in a `package.json` that **no source file in that package imports** (check both `import ... from 'pkg'` and `import 'pkg'` side-effect forms, and dynamic `import('pkg')`)
- Workspace `@repo/*` deps declared but unused
- Inverse (report as INFO): a package imported in source but **missing** from `package.json` (phantom dependency relying on hoisting)

### 4. Unreachable / dead branches

- Code after an unconditional `return` / `throw` / `continue` / `break` in the same block
- Conditions that are statically always-true or always-false (`if (false)`, `if (true)`, `&& false`)
- `case` arms after a `default` that returns, switch arms that can never match the discriminant's type
- Feature-flag branches gated on a constant that is now permanently one value

### 5. Stale commented-out code & dead scaffolding

- Multi-line commented-out code blocks (not explanatory comments — actual code parked in a comment)
- `@deprecated` exports with zero remaining callers
- Empty/placeholder modules that re-export nothing and do nothing
- `TODO: remove`, `// HACK`, `// temporary` blocks that have outlived their note

## CRITICAL — do NOT report these as dead (false-positive guards)

This monorepo has many surfaces that look unused to a naive grep but are loaded dynamically, by convention, or as a public boundary. Treat each of these as **used** unless you have positive evidence otherwise:

- **`@repo/*` public package API.** Anything listed in a package's `package.json` `"exports"` map (e.g. `@repo/db`'s `./client`, `./graphql/types`) is a public boundary consumed cross-package. The _entry file_ named in `exports` is never an orphan. A symbol it re-exports may still be dead — but verify against **every** app + package, not just the declaring one.
- **Next.js App Router special files.** Under `apps/web/src/app/**`, these are framework entry points invoked by file-system routing, never imported: `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`, `template.tsx`, `default.tsx`, `middleware.ts`, `instrumentation.ts`, and metadata files (`opengraph-image.*`, `icon.*`, `apple-icon.*`, `sitemap.ts`, `robots.ts`, `manifest.ts`). Their **default export** and Next's special named exports (`metadata`, `generateMetadata`, `generateStaticParams`, `dynamic`, `revalidate`, `viewport`, `GET`/`POST`/etc.) are entry points.
- **Pothos schema registration.** Custom objects/resolvers in `apps/api/src/` are wired into the schema by side-effect imports through `apps/api/src/pothos-schema.ts` / `builder.ts`. A resolver file imported only there (or via a glob/registry) is **live**, not orphaned. Same for anything referenced by the four exclusion lists (`AUTH_MODELS`, `CUSTOM_MODELS`, `SENSITIVE_MODELS`, `ADMIN_ONLY_MODELS`).
- **Daemon handler/module registration.** Event handlers and modules in `apps/daemon/src/` are often registered with an orchestrator/registry or dispatched by RabbitMQ routing key (a **string**, not an import). Grep for the symbol name _and_ its kebab/snake string form before calling it dead.
- **String / dynamic references.** A symbol may be referenced only via `import()`, a string key, a decorator, a config value, or DI. Grep the bare name across the repo — not just `import` lines — before concluding nothing uses it.
- **Generated code — out of scope entirely.** Prisma client, Pothos `PrismaTypes`/inputs, Apollo codegen output, anything under `**/__generated__/**`, `**/generated/**`, `*.d.ts`. These are owned by their generator; "unused" generated symbols are the generator's business. Skip them.
- **Seed / script entry points.** Files invoked via `package.json` scripts (`db:seed`, `db:seed:geo`, etc.) or run with `node`/`tsx` directly are entry points even with no importer.
- **Config files.** `vitest.*.config.mjs`, `turbo.json`-referenced configs, `eslint.config.*`, `tailwind.config.*`, `next.config.*`, `*.config.ts` — loaded by tooling, not imported by app code.
- **Test files & fixtures.** `*.test.ts(x)`, `*.spec.ts(x)`, files under `__tests__/`, `__mocks__/`, `__fixtures__/`. A fixture used by one test still looks orphaned to a global import scan — don't flag it. (Do flag a fixture or test helper imported by **zero** tests.)
- **Barrel re-exports.** An `index.ts` that re-exports for ergonomics is "used" via the barrel even if a given re-export has no _direct_ importer — trace consumption through the barrel before flagging the underlying symbol.

If a finding matches any guard above, either drop it or file it as **Low confidence** with the guard named, so the user knows why you're unsure.

## Scope handling — `$ARGUMENTS`

- **A path (file or folder)** → the **target surface** is limited to declarations _inside_ that path. But **deadness is a whole-repo property**: a function in the target folder may be imported from a different app. So you still cross-reference every candidate against the **entire monorepo**, not just the target. Report only candidates that are declared in-scope AND unused repo-wide.
- **`all`** (or blank) → scan every source root:
  - `apps/api/src/`, `apps/daemon/src/`, `apps/web/src/`
  - `packages/*/src/` (and other first-party source dirs in each package)

Skip everywhere: `node_modules/`, `dist/`, `.next/`, `.turbo/`, `coverage/`, `**/__generated__/**`, `**/generated/**`, `*.d.ts`, `*.json`, `*.md`, lockfiles, and the generated outputs listed in the guards above.

## Process

1. **Enumerate the target.** Glob the in-scope source files. For `all`, glob each root and create a TaskCreate task per root.
2. **Harvest declarations.** For each in-scope file collect every `export`ed symbol (name + kind + line) and note whether the file is an entry point (apply the guards above). Dispatch `dead-code-scanner` instances in parallel per root to do this line-by-line — it returns the export/symbol inventory plus first-pass dead candidates.
3. **Cross-reference repo-wide.** For each candidate export/file, search the **whole repo** for consumption: `import`/`from` statements, re-exports through barrels, dynamic `import()`, and **bare-name + string-form** references (routing keys, DI tokens, config values). A candidate survives only if it has zero real consumers anywhere.
4. **Apply false-positive guards.** Run every survivor through the guard list. Entry points and dynamically-loaded symbols drop out or fall to Low confidence.
5. **Assign confidence** (see scale below) and **group by confidence**.
6. **Write the report to a file** — see below. Verify every **High confidence** claim by re-opening the file and re-running the consumption search before publishing.

For dependency deadness: read each in-scope `package.json`, list `dependencies`/`devDependencies`, and grep that package's `src` for each (covering `from 'pkg'`, `from 'pkg/sub'`, `import 'pkg'`, `import('pkg')`, and `require('pkg')`). Account for deps used only in config files or by tooling (a dep used only in `vitest.config.mjs` is still used).

## Confidence scale

Confidence is about _how sure you are it's safe to delete_, not how bad it is. Be conservative.

- **High** — declared in scope, **zero** consumers found repo-wide across imports, barrels, dynamic imports, and string/bare-name references, and it matches **none** of the false-positive guards. Safe to delete. You verified this by re-opening the source.
- **Medium** — no consumers found, but it touches a dynamic surface (registry, DI, possible string reference) you could not fully rule out, or it's an exported type whose absence of use is harder to prove. Likely dead; a human should confirm the dynamic path before deleting.
- **Low** — matches a false-positive guard (entry point, barrel re-export, generated-adjacent, test fixture) but still _looks_ unreferenced. Reported for completeness; **probably not actually dead**. Name the guard so the user understands the doubt.

When a finding could be two tiers, pick the lower one.

## Output — you MUST write a phased document

Do not just print to the terminal. Write to:

```
docs/audits/dead-code-<target-slug>-<YYYY-MM-DD>.md
```

Use `all` as the target slug when no path is given. Create `docs/audits/` if it does not exist. Never silently overwrite — if a file already exists for today's target, append a numeric suffix (`-2`, `-3`, ...).

Every finding in **High**, **Medium**, and **Low** sections MUST be a `- [ ] <item>` checkbox line so `/execute` can tick it off when the code is removed. Group findings into phases by confidence (High first — those are the safe deletions).

After writing, print a short terminal summary (file path + counts per confidence tier). Do not paste the whole document back.

Use this structure:

```markdown
# Dead Code Report — hlstatsnext.com <target>

_Scanned: <file count> files across <roots>_
_Cross-referenced against: whole monorepo_
_Date: <today>_

## Summary

<2-4 sentences: how much dead code, where it clusters, the single biggest safe win, and one caveat about confidence. Findings: X high, Y medium, Z low.>

## Phase 1 — High confidence (safe to delete)

Zero consumers repo-wide, no entry-point/dynamic-use guard matched, verified against source.

- [ ] **`path/to/file.ts:line`** — `exportName` (<kind>) — unused export
      **Evidence:** declared at `file.ts:line`; no import/re-export/dynamic/string reference found across `apps/*` + `packages/*`.
      **Searched:** `import .* exportName`, `from '.*/file'`, barrel `index.ts`, bare-name `exportName`.
      **Removal:** delete the export (and the symbol if nothing else in-file uses it).
- [ ] **`path/to/orphan.ts`** — orphan file — no module imports it; not an entry point.
- [ ] **`apps/x/package.json`** — `some-pkg` (dependency) — not imported anywhere in `apps/x/src`.
- [ ] ...

## Phase 2 — Medium confidence (likely dead — confirm the dynamic path)

No static consumer, but a registry/DI/string surface couldn't be fully ruled out.

- [ ] **`path/to/file.ts:line`** — `handlerName` — no static import; check whether it's dispatched by routing key `"<key>"` or registered via <registry>.
- [ ] ...

## Phase 3 — Low confidence (matches a guard — probably NOT dead)

Looks unreferenced but hits a false-positive guard. Listed for completeness; verify before touching.

- [ ] **`path/to/file.tsx`** — Next.js `page.tsx` default export — entry point (file-system routing); flagged only because it has no importer. **Likely live.**
- [ ] ...

## Unreachable / dead branches

- [ ] **`path/to/file.ts:line`** — code after `return` / always-false condition — <one line>.

## Stale commented-out code

- [ ] **`path/to/file.ts:line-range`** — <N> lines of commented-out <what> — safe to remove if confirmed obsolete.

## What looks clean

<Roots or packages with no dead code found. Tells the user where NOT to spend cleanup effort.>

## Provenance

<How the scanner inventory was cross-referenced. How many High candidates were demoted after the guard pass and why — e.g. "scanner flagged 14 unused exports; 5 demoted to Low (barrel re-exports / Pothos registration), 2 to Medium (possible RabbitMQ string dispatch).">
```

## Guidelines

- **Cross-reference is non-negotiable.** Never call an export dead from reading only its own file. Search the whole repo for every form of consumption (import, re-export, dynamic import, bare name, string key) before reporting.
- **Don't re-report what `tsc` already catches.** File-local unused imports/locals/params are flagged by `noUnusedLocals`/`noUnusedParameters` on every `check-types`. Adding them here is noise.
- **Quote line numbers and the exact symbol name.** "Some unused stuff in the daemon" is useless.
- **One finding per entry.** Don't bundle five unused exports from one file into a single checkbox — `/execute` ticks them individually.
- **A clean result is a real result.** If a package has no dead code, say so. Don't manufacture findings to look thorough.
- **Removing an unused `@repo/*` export is a breaking change to that package's public API** — flag it as such even when confident, because an external/un-scanned consumer could exist.
- **Prefer under-reporting to over-reporting.** A missed dead symbol costs nothing; a wrongly-deleted entry point breaks the build. Bias toward the lower confidence tier.
- **Generated code is never your finding.** If it's under `__generated__`/`generated`/`*.d.ts` or owned by Prisma/Pothos/Apollo codegen, skip it entirely.

Target: $ARGUMENTS
