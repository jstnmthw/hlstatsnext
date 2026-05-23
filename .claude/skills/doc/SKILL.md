---
name: doc
description: "Generate or update documentation for hlstatsnext.com — package READMEs, ARCHITECTURE.md, JSDoc on exported surfaces, CHANGELOG entries. Use when code needs docs or existing docs are outdated."
argument-hint: "<target file, package, or feature>"
model: opus
effort: medium
---

# Documenter

Generate and update documentation for hlstatsnext.com.

## Documentation types

- **Package README** (`packages/<name>/README.md`, `apps/<name>/README.md`): purpose, public API surface, install/use snippet, env vars consumed, related packages
- **Top-level project docs** under `docs/` (ALL_CAPS naming — `ARCHITECTURE.md`, `BEST_PRACTICES.md`, `PRODUCTION_DEPLOYMENT.md`, `DOCKER_NETWORKING_SETUP.md`, etc.): keep in sync when patterns change; if a new subsystem deep-dive is needed, add a new `docs/<TOPIC>.md` matching that style
- **JSDoc** on exported functions/classes — only for non-obvious surfaces (Pothos resolvers, RCON protocol handlers, validators, RabbitMQ adapters). Skip getters and trivial passthroughs.
- **`CHANGELOG.md`** (if used): Keep a Changelog format — `[Unreleased]` → Added / Changed / Fixed / Removed

## Process

1. Read the code being documented
2. Read existing docs in the same area to match tone and format
3. Identify whether existing docs are stale (reference renamed files, removed functions, old patterns)
4. Write or update — additive by default, only remove things that are factually wrong
5. Verify code examples compile (mentally type-check the snippet against the current API)
6. Check for stale cross-references (links to moved files, removed functions, deprecated env vars)

## Guidelines

- **Accuracy over comprehensiveness.** Wrong docs are worse than no docs.
- **Code examples must be copy-pasteable** with the right imports — use the `@repo/*` aliases.
- **Package READMEs are 60-second briefings**, not exhaustive references. Lead with the purpose and a single usage snippet.
- **Don't document internal implementation** in user-facing docs. Internal patterns go in JSDoc, or in a new top-level `docs/<TOPIC>.md` for cross-cutting subsystems.
- **Use the project's terminology** consistently: daemon, ingester, ingress, orchestrator, coordinator, repository, GraphQL resolver, RCON command — match how the codebase names things.
- **For JSDoc**: explain WHY when not obvious. Don't restate the signature. The CLAUDE.md rule about comments applies here too.
- **For ARCHITECTURE updates**: include a one-line diff in the doc itself ("Updated 2026-MM-DD to reflect X") when the change is significant.
- **For schema docs**: don't duplicate the Prisma schema in prose. Link to it.

Target: $ARGUMENTS
