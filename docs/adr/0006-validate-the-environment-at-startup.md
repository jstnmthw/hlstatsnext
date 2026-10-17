# 0006. Validate the environment at startup and build auth on first use

- Status: Accepted
- Date: 2026-10-17

## Context

`packages/auth/src/server.ts` reads `process.env` while the module loads and constructs the Better Auth instance at import. `apps/web` validates no environment at all; `apps/api` throws for two variables in `index.ts` and `context.ts`. A missing or misspelled variable surfaces at the first request that needs it, in whichever process got there first. `next build` evaluates every server module, so an import-time construction also ties the build to the environment.

## Decision

The auth package owns a Zod schema of every variable it reads, parsed once on first use by `getEnv()`, and exports `getAuth()`, which builds the instance on first call. `apps/web/instrumentation.ts` and the API's startup call `getAuth()` before serving, so a bad environment stops the process with the names of what is missing. Every name appears in the app's `.env.example` and in `turbo.json`.

## Options considered

- **Zod schema, lazy construction, startup check.** One list of variables, one error message naming every problem, and builds that need no environment.
- **Eager construction with an early throw (today).** Rejected. Two apps each guard a subset, and the build still evaluates the module.
- **A schema per app.** Rejected. Both apps read the same auth variables; one schema in the package they share means one place to add a name.

## Consequences

- Call sites move from the `auth` export to `getAuth()`: the proxy, three layouts, the server actions, the route handler and `apps/api/src/context.ts`.
- Zod 4 is already a dependency of `@repo/auth`; no new package.
- Variables that only one app reads (`FRONTEND_URL`, `ENCRYPTION_KEY`, `NEXT_PUBLIC_*`) stay in that app's own check. This record covers the auth set: `BETTER_AUTH_*`, `GOOGLE_*`, `MAIL_*`, `RESEND_API_KEY`, `STEAM_API_KEY`, `ADMIN_EMAILS`.
