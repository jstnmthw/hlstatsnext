# ADR refactor: bring the code in line with records 0001 to 0009

- Status: Complete as of 2026-10-18. All nine records are reflected in the code. Two schema changes (`user.steam_id`, `user_players`) must be applied to each database by hand until the `server_tokens.rcon_address` drift is resolved and `db push` can run again.
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

- [x] `permissions.ts` gains `hasPermission(role, permissions)` built on the roles' own `authorize`, plus `roleOf(user)` and `isAdmin(user)`, with unit tests. The file stays free of server-only imports. `user` gains `update` and `set-email`, which `adminUpdateUser` checks; a shared `roles` map feeds both the server and client plugins.
- [x] Admin plugin options: `defaultRole: "user"`, `adminRoles: ["admin"]`.
- [x] Replace every role string compare: `proxy.ts`, the `(auth)` and `(admin)` layouts, both headers, `apps/api/src/context.ts`.
- [x] Server actions check the statement in process through the helpers instead of the `auth.api.userHasPermission` round trip.
- [x] `updateUserName` and `anonymizeUser` write through `auth.api.adminUpdateUser`; `@repo/db` leaves `user-actions.ts`.
- [x] `ADMIN_EMAILS` joins the env schema; a `databaseHooks.user.create.before` hook promotes a matching sign-up to `admin`.
- [x] Checks pass.

## Phase 4: ADR 0004. Authorization in the data layer

- [x] `packages/auth/src/session.ts`: `import "server-only"`, `getSession` wrapped in React `cache`, `headers()` awaited before the auth client is touched. `requireAuth` redirects to `/login`; `requireAdmin` and `requirePermission` answer a signed-in user without the right with `notFound()`. Guards navigate rather than throw typed errors (chosen 2026-10-17), so the unused `AuthError` class is removed along with the copy of `requirePermission` in `user-actions.ts`.
- [x] `proxy.ts` never reads the session. Matcher: `/admin/:path*`, `/accounts/:path*`, `/login`, `/register`. Protected routes redirect on a missing session cookie (`getSessionCookie`). The sign-in pages bounce on the signed cookie cache (`getCookieCache`) rather than the bare token, because the token cookie outlives a revoked or reset session by up to seven days and would otherwise lock that visitor out of the sign-in page; the cache expires in five minutes.
- [x] `(admin)` and `(accounts)` layouts call the helpers only for chrome and redirects. `(auth)` keeps the real session read.
- [x] The token actions gain a first-line guard. Every action uses the shared helpers.
- [x] Add Playwright to `apps/web` with a protection spec: signed out lands on `/login`; a user gets 404 on `/admin`; an admin renders. The run starts its own `next dev` on port 3100 and API on 4100 (metrics off), creates two users through the real sign-up endpoint, and removes them afterwards. `pnpm --filter web test:e2e`; while `pnpm dev` is running, `PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm --filter web test:e2e`, because Next allows one dev server per project.
- [x] Add a Vitest integration config to `apps/api` (it has none) and a test that `requireAdminResolver` refuses a user-role context. It executes real operations against the built schema with `DATABASE_URL` pointed at an unreachable port, so it needs no database and cannot write to one. `pnpm --filter api test:integration`.
- [x] Checks pass.

## Phase 5: ADR 0005. Web data modules over the GraphQL API

- [x] `apps/web/src/lib/data/<domain>.ts` modules: `import "server-only"`, a guard on the first line of every protected export, the Apollo client inside, DTOs whose types live in `lib/<domain>.ts`. Each module also owns its GraphQL documents, moved byte for byte so the generated client map still matches; four unused documents and the dead `GameList` component were dropped. Which columns are searchable now lives in the module, so `searchFields` left the table configs.
- [x] ESLint `no-restricted-imports`: `@/lib/apollo-client` is importable only from `src/lib/data/**` and `apollo-wrapper.tsx`.
- [x] Migrated: servers, tokens, users, games, players (admin, under `lib/data/`); servers, players, games, stats (public, under `lib/data/public/`, each opening with a comment that it is public).
- [x] Actions guard first, validate, call a data module, `revalidatePath`, and return `ActionResult` from `lib/actions.ts`: `{ ok: true, message, data? } | { ok: false, message, errors? }`. Forms and dialogs read `ok`; `ErrorDisplay` and the token form follow.
- [x] Checks pass.

## Phase 6: ADR 0008. Better Auth 1.7.10, then Steam

- [x] Commit A: upgrade `better-auth` to 1.7.10 in `@repo/auth` and `@repo/db`. Findings: the 1.7.0 `account.issuer` requirement was reverted in 1.7.3 and is absent from 1.7.10, so the Prisma schema is unchanged; the cookie cache still defaults to the compact strategy the proxy verifies; 1.7.10 declares `kysely ^0.28.17 || ^0.29.0`, so the 0.28.17 override stays valid and is kept. `zod` moved to 4.6.7 across the workspace so one copy serves both the apps and Better Auth (two copies produced TS2742 in `@repo/auth`). Type checks, lint, unit tests, the web build and the Playwright sign-in paths all pass.
- [x] Commit B: `better-auth-steam` 0.2.3, exact. Its callback was read in full from the published tarball: it posts every `openid.*` field back to Steam with `check_authentication` and accepts only `is_valid:true`; compares `return_to` for exact equality with the issued URL including the state; takes the Steam ID from `claimed_id`, requires `identity` to match, and returns it only after verification. It also rejects duplicate fields, bounds the nonce to ten minutes, reserves each nonce against replay, never follows redirects and never links by email. The plugin is always registered: OpenID needs no key, and the Web API key only fills in the display name and avatar.
- [x] `steamId String? @unique @map("steam_id")` on `User`; `pnpm db:generate`, `pnpm codegen` (against a temporary API on port 4000) and `pnpm check-types` run; `steamId` exposed on the custom `User` object. On the dev database `prisma db push` refuses because the live schema still has `server_tokens.rcon_address`, which the Prisma schema no longer declares; dropping it is the user's call, so the column was applied by hand (2026-10-18) with the additive statements `ALTER TABLE user ADD COLUMN steam_id VARCHAR(191) NULL;` and `CREATE UNIQUE INDEX user_steam_id_key ON user(steam_id);`.
- [x] `/steam/login` joins the rate-limit rules (10 per minute, matching the plugin's own rule for `/steam/*`); `STEAM_API_KEY` joins the env schema as optional, `turbo.json`, the web env example and the deployment doc.
- [x] Checks pass. Types, lint, format and unit tests pass; the Playwright suite passed against the dev stack after the column landed.

## Phase 7: ADR 0007. Steam, email and password, and Google

- [x] Steam is the first button on the login and register pages, Google follows when configured, and the email form sits under an "or with email" divider. `allowDifferentEmails: true`. The `(auth)` layout redirects on session presence. Every sign-in method now lands on `/accounts`, a server page that sends admins to `/admin` and everyone else to `/accounts/settings`; the old `/admin` target was a 404 for ordinary users. Steam and OAuth failures come back as `?error=CODE` and are shown through `features/auth/lib/auth-error-messages.ts`.
- [x] Settings gains a connected-accounts card (Steam, Google when configured, password) read through `lib/data/account.ts` from Better Auth's own account list; connect goes through `steam.link` and `linkSocial`, disconnect through `unlinkAccount` by row id, offered only while another method remains. The password card is hidden for users with no credential account. Change-email runs through the email OTP plugin's `requestEmailChange` and `changeEmail` (`verifyCurrentEmail: false`, since a Steam address cannot receive a code); the new address comes back verified. Unlink and change-email require a fresh session, which the daily extension never restores after day one, so `SESSION_NOT_FRESH` is shown as "sign in again" rather than handled globally. Unlinking Steam leaves `user.steamId` set, because no Better Auth endpoint clears a plugin field; Phase 8 should treat the `steam` account row, not `user.steamId`, as the proof of a live link.
- [x] Checks pass. Types, lint, format and unit tests pass; the Playwright suite (now nine scenarios, including Steam-first and the settings cards) passes against the dev stack. The Playwright API no longer binds the metrics port, so the suite coexists with `pnpm dev`.

## Phase 8: ADR 0009. Claim players by Steam identity

- [x] `UserPlayer` model mapped to `user_players`: `playerId` (primary key, so unique), `userId`, `game`, `claimedAt`; indexed by `userId`; cascades with the user. Deliberately no relation to `Player`: the daemon owns that model, and a relation would put a claim filter on the public player queries. The live database needs the table applied by hand, as with `steam_id`, because `db push` is blocked by the `server_tokens.rcon_address` drift. SQL from `prisma migrate diff`: `CREATE TABLE user_players (player_id INTEGER UNSIGNED NOT NULL, user_id VARCHAR(191) NOT NULL, game VARCHAR(32) NOT NULL, claimed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX user_players_user_id_idx (user_id), PRIMARY KEY (player_id)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;` then `ALTER TABLE user_players ADD CONSTRAINT user_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE ON UPDATE CASCADE;`.
- [x] `claimPlayersBySteamId(userId, steamId)` in `packages/auth/src/claims.ts` (export `@repo/auth/claims`) looks up `player_unique_ids` by SteamID64, creates missing claims and moves claims held by another user, since a fresh Steam proof outranks an old one. It runs from a `databaseHooks.account.create.after` hook for `steam` accounts (failures are logged, never fatal to the sign-in) and from the players page, which reads the Steam account row through `listUserAccounts` rather than the stale-prone `user.steamId`.
- [x] `UserPlayer` joins `CUSTOM_MODELS`. `modules/user-player/user-player.resolver.ts` adds `myPlayers` (`requireAuth`, returns the public `Player` object for the claimed ids) and `updateMyPlayer(playerId, data: UpdateMyPlayerInput)` (`requireAuth`, `player: ["update-own"]`, then the claim must belong to the caller), mapping the boolean inputs onto the legacy 0/1 columns. `update-own` is on both roles. The guard test covers both fields unauthenticated. The web gains `/accounts/players` (data module `lib/data/my-players.ts`, action `update-my-player.ts`, cards with the three preferences), a "My players" menu item, and `/accounts` now lands ordinary users there.
- [x] Codegen trio run (against the dev API). Types, lint, format, unit tests and the API guard tests pass; nine Playwright scenarios pass. The tenth, the players page, needs the `user_players` table on the dev database and is the one check still outstanding as of 2026-10-18.
