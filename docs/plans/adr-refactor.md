# ADR refactor: bring the code in line with records 0001 to 0009

- Status: In progress
- Started: 2026-10-17
- Order: dependency order, chosen 2026-10-17. One phase per commit; the user reviews and commits between phases.

The records in `docs/adr/` say what was decided and why. This plan only orders the work and itemizes each record's consequences so a phase can be picked up, finished and ticked off. Every phase ends at the same stopping point: `pnpm check-types`, `pnpm lint`, `pnpm test` and `pnpm format` pass, and the boxes below are ticked.

Why this order and not the numbering: 0003 needs the environment schema from 0006 (`ADMIN_EMAILS`), 0005's data modules need the guards from 0004, and 0007's screens need the Steam plugin from 0008.

## Phase 1: ADR 0001 + 0002. Dead code out, session lifetimes written down

- [x] Delete `apps/api/src/modules/auth/` (`auth.service.ts`, `auth.repository.ts`, `auth.schemas.ts`). Only `context.ts` imported it; nothing read `services.auth`.
- [x] Remove `AuthService` from the `Services` container in `apps/api/src/context.ts`.
- [x] `packages/auth/src/server.ts`: set `session.expiresIn` (seven days) and `session.updateAge` (one day) beside the existing `cookieCache` (five minutes), so the lifetimes are visible in one place.
- [x] Checks pass.

## Phase 2: ADR 0006. Validate the environment at startup, build auth on first use

- [x] `packages/auth/src/env.ts`: a Zod schema of every variable the package reads (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MAIL_PROVIDER`, `MAIL_FROM`, `RESEND_API_KEY`), parsed once by `getEnv()`. The error names every missing or invalid variable. `DATABASE_URL` stays with `@repo/db`, which reads and guards it itself.
- [x] Unit tests for the schema in `packages/auth/src/env.test.ts`; vitest is added to the package the same way `@repo/crypto` has it.
- [x] `server.ts` exports `getAuth()`, which builds the instance on first call. `mail.ts` reads through `getEnv()`.
- [x] Call sites move from `auth` to `getAuth()`: `apps/web/src/proxy.ts`, the three layouts (through `getSession`), the server actions, `app/api/auth/[...all]/route.ts` (resolved per request so the build needs no environment), `apps/api/src/context.ts`. The login and register pages read the Google flag through `getEnv()` instead of `process.env`.
- [x] `apps/web/src/instrumentation.ts` calls `getAuth()` in `register()`. The API calls it before `listen`.
- [x] `apps/web/.env.example` lists every name. The repo had both `env.example` and `.env.example` in different places; it now uses `.env.example` everywhere, with the stale dotless duplicates at the root, `apps/api` and `apps/daemon` removed and the setup docs updated. `apps/api` already carries the Better Auth pair. `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` join `globalEnv` in `turbo.json`.
- [x] Checks pass.

## Phase 3: ADR 0003. One access statement

- [ ] `permissions.ts` gains `hasPermission(role, permissions)` built on the roles' own `authorize`, plus `roleOf(user)` and `isAdmin(user)`. The file stays free of server-only imports.
- [ ] Admin plugin options: `defaultRole: "user"`, `adminRoles: ["admin"]`.
- [ ] Replace every role string compare: `proxy.ts`, the `(auth)` and `(admin)` layouts, both headers, `apps/api/src/context.ts`.
- [ ] Server actions check the statement in process through the helpers instead of the `auth.api.userHasPermission` round trip.
- [ ] `updateUserName` and `anonymizeUser` write through `auth.api.adminUpdateUser`; `@repo/db` leaves `user-actions.ts`.
- [ ] `ADMIN_EMAILS` joins the env schema; a `databaseHooks.user.create.before` hook promotes a matching sign-up to `admin`.
- [ ] Checks pass.

## Phase 4: ADR 0004. Authorization in the data layer

- [ ] `packages/auth/src/session.ts`: `import "server-only"`, `getSession` wrapped in React `cache`, `headers()` awaited before the auth client is touched. `requireAuth`, `requireAdmin` (answers a non-admin with `notFound()`) and `requirePermission` live here; the copy in `user-actions.ts` is removed.
- [ ] `proxy.ts` uses `getSessionCookie` only. Matcher: `/admin/:path*`, `/accounts/:path*`, `/login`, `/register`. It redirects by cookie presence and never reads the session.
- [ ] `(admin)` and `(accounts)` layouts call the helpers only for chrome and redirects. `(auth)` keeps the real session read.
- [ ] The token actions gain a first-line guard. Every action uses the shared helpers.
- [ ] Add Playwright to `apps/web` with a protection spec: signed out lands on `/login`; a user gets 404 on `/admin`; an admin renders.
- [ ] Add a Vitest integration config to `apps/api` (it has none) and a test that `requireAdminResolver` refuses a user-role context.
- [ ] Checks pass.

## Phase 5: ADR 0005. Web data modules over the GraphQL API

- [ ] `apps/web/src/lib/data/<domain>.ts` modules: `import "server-only"`, a guard on the first line of every protected export, the Apollo client inside, DTOs whose types live in `lib/<domain>.ts`.
- [ ] ESLint `no-restricted-imports`: `@/lib/apollo-client` is importable only from `src/lib/data/**` and `apollo-wrapper.tsx`.
- [ ] Migrate one domain at a time: servers, tokens, users (admin); then games, players, servers, homepage (public, each module opening with a comment that it is public).
- [ ] Actions become validate, guard, call a data module, `revalidatePath`, return `{ ok: true } | { ok: false, errors }`.
- [ ] Checks pass.

## Phase 6: ADR 0008. Better Auth 1.7.10, then Steam

- [ ] Commit A: upgrade `better-auth` to 1.7.10. Re-check the `kysely` 0.28.17 override, the Prisma adapter and the e2e sign-in paths; the web build must pass.
- [ ] Commit B: add `better-auth-steam` at an exact version. Before merging, read its callback: it must round-trip the assertion to Steam's `check_authentication`, match `return_to` exactly, and take the Steam ID from the verified `claimed_id`.
- [ ] `steamId String? @unique` on `User`; run `pnpm db:generate`, `pnpm codegen`, `pnpm check-types`; expose `steamId` on the custom `User` object.
- [ ] `/steam/login` joins the rate-limit rules; `STEAM_API_KEY` joins the env schema.
- [ ] Checks pass.

## Phase 7: ADR 0007. Steam, email and password, and Google

- [ ] Steam is the first button on the login and register pages. `allowDifferentEmails: true`. The `(auth)` layout redirects on session presence, not on `emailVerified`.
- [ ] Settings gains a connected-accounts section (Steam, Google, password). The password form and the forgot-password link are hidden for users with no credential account. Change-email with verification is enabled.
- [ ] Checks pass.

## Phase 8: ADR 0009. Claim players by Steam identity

- [ ] `UserPlayer` model mapped to `user_players`: `userId`, `playerId`, `game`, `claimedAt`; unique on `playerId`; indexed by `userId`; cascades with the user.
- [ ] A claim routine in `packages/auth` looks up `player_unique_ids` by the user's SteamID64 and upserts a row per match. It runs after a Steam account is created or linked, and when the players page opens.
- [ ] `UserPlayer` joins the exclusion lists in `pothos-schema.ts`. Custom resolvers: `myPlayers` behind `requireAuth`; `updateMyPlayer` behind `requireAuth` plus an ownership check. `player: ["update-own"]` is added to the `user` role.
- [ ] Codegen trio; checks pass.
