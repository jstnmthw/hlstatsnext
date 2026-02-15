# Next.js v16 Engineering Review — Steam OAuth Integration

## Scope

This review covers **replacing Google OAuth with Steam authentication** in HLStatsNext.com, including:

- Removing Google OAuth provider from Better Auth configuration
- Implementing Steam OpenID 2.0 authentication (Steam does NOT support OAuth2)
- Creating a Better Auth session from Steam's OpenID response
- Converting between Steam ID formats (`STEAM_X:Y:Z` ↔ SteamID64)
- Reconciling authenticated website users with in-game player records via `PlayerUniqueId`
- UI changes (Steam sign-in button, player profile linking)

## Repo/System Context

| Property                | Value                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| **Monorepo**            | Turborepo + pnpm workspaces                                             |
| **Frontend**            | Next.js v16.1.6, App Router, Turbopack                                  |
| **Auth library**        | Better Auth with Prisma adapter (MySQL) + admin plugin (RBAC)           |
| **Auth client**         | `better-auth/react` with `adminClient` plugin                           |
| **Existing OAuth**      | Google (conditional — only when env vars present)                       |
| **Player model**        | `players` table with `playerId` (PK), linked to `PlayerUniqueId`        |
| **PlayerUniqueId**      | Composite PK `(uniqueId, game)` — stores Steam IDs as `STEAM_X:Y:Z`     |
| **Better Auth Account** | `account` table with `accountId`, `providerId`, `userId` (FK to `user`) |
| **Route handler**       | `app/api/auth/[...all]/route.ts` → `toNextJsHandler(auth)`              |
| **Auth pages**          | `(auth)/login/page.tsx`, `(auth)/register/page.tsx`                     |

### Current Auth Files

```
apps/web/src/
  lib/auth.ts                    — Better Auth server config (email + conditional Google)
  lib/auth-client.ts             — Better Auth React client (signIn, signUp, signOut, useSession)
  lib/auth-permissions.ts        — RBAC (admin/user roles, server/game/player/dashboard statements)
  app/api/auth/[...all]/route.ts — Better Auth catch-all route handler
  features/auth/components/
    login-form.tsx               — Email/password login + conditional Google button
    register-form.tsx            — Email/password registration + conditional Google button
    google-button.tsx            — Google OAuth sign-in button (to be replaced)
  app/(auth)/layout.tsx          — Server-side session check, redirects if already logged in
  app/(admin)/layout.tsx         — Server-side admin guard (role check)
```

### SteamID Format Reference

| Format        | Example             | Used In                                     |
| ------------- | ------------------- | ------------------------------------------- |
| **Steam2**    | `STEAM_0:1:12345`   | Game server logs, `PlayerUniqueId.uniqueId` |
| **SteamID64** | `76561198000000001` | Steam Web API, OpenID `claimed_id` response |
| **SteamID3**  | `[U:1:24691]`       | Some newer Source engine games              |

Conversion formulas:

- Steam2 → SteamID64: `76561197960265728 + (Y * 2) + Z` where `STEAM_X:Y:Z`
- SteamID64 → Steam2: `Y = (id64 - 76561197960265728) % 2`, `Z = (id64 - 76561197960265728 - Y) / 2`

## Measurement Methodology (DevTools)

Not measured (runtime diagnostics not applicable — this is an architectural review for a new feature).

## Baseline Results

| Metric                        | Value                                              |
| ----------------------------- | -------------------------------------------------- |
| Current social providers      | Google (conditional)                               |
| Players with SteamIDs in DB   | Stored as `STEAM_X:Y:Z` in `player_unique_ids`     |
| Better Auth `account` records | `providerId: "credential"` or `"google"`           |
| Auth route handler            | Single catch-all at `/api/auth/[...all]`           |
| Steam API key required        | Yes — for fetching profile data (avatar, username) |

---

## Findings

### F-001: Steam Does Not Support OAuth2

**Summary**: Steam authentication uses **OpenID 2.0** (legacy protocol), not OAuth2 or OIDC. Better Auth's `socialProviders` and `genericOAuth` plugin are OAuth2/OIDC-based and **cannot** handle Steam's OpenID 2.0 flow natively.

**Evidence**:

- Steam Web API documentation confirms OpenID 2.0: https://steamcommunity.com/dev
- Better Auth GitHub issue [#1754](https://github.com/better-auth/better-auth/issues/1754): "Steam Provider" — no built-in support, community confirms OpenID 2.0 incompatibility
- Better Auth `genericOAuth` plugin requires `authorizationUrl`, `tokenUrl`, `userInfoUrl` — Steam has none of these in the standard OAuth2 sense

**Proposed approach**: Use a manual OpenID 2.0 flow via the [`node-steam-openid`](https://www.npmjs.com/package/node-steam-openid) npm package, then programmatically create Better Auth sessions using the internal API.

**Risk/complexity**: Medium — requires custom route handlers outside Better Auth's plugin system, but the OpenID flow itself is straightforward (redirect → validate → extract SteamID64).

---

### F-002: Manual Route Handler Architecture Required

**Summary**: Since Better Auth can't handle Steam OpenID natively, we need two custom Next.js route handlers:

1. **`/api/auth/steam`** — Initiates the Steam OpenID redirect
2. **`/api/auth/steam/callback`** — Receives Steam's OpenID response, validates it, creates/links account, establishes Better Auth session

**Evidence**: The existing auth catch-all (`/api/auth/[...all]/route.ts`) routes all Better Auth-managed flows. Custom Steam routes must sit **alongside** this handler, not inside it.

**Next.js best-practice**: Route Handlers — https://nextjs.org/docs/app/building-your-application/routing/route-handlers

**Proposed change**:

```
app/api/auth/
  [...all]/route.ts          — Existing Better Auth handler (email, sessions, admin)
  steam/route.ts             — GET: redirect to Steam OpenID
  steam/callback/route.ts    — GET: handle Steam's OpenID return
```

**Risk/complexity**: Low — standard Next.js route handler pattern. The `[...all]` catch-all won't conflict because `steam/` and `steam/callback/` are more specific routes.

---

### F-003: Session Creation Strategy

**Summary**: After validating Steam's OpenID response, we must create a Better Auth session programmatically. There are two approaches:

**Option A — Use Better Auth's internal API** (`auth.api`):

- Look up or create a `User` by SteamID64
- Create an `Account` record with `providerId: "steam"`, `accountId: <steamId64>`
- Create a `Session` and set the session cookie

**Option B — Direct Prisma + manual cookie**:

- Bypass Better Auth entirely for session creation
- Higher risk of desync with Better Auth's session management

**Proposed change**: Option A is strongly preferred. Better Auth's `auth.api` provides methods for user lookup and session management that keep everything consistent.

Key `auth.api` methods to use:

- Use Prisma to find/create user + account records
- Use `auth.api.signInWithCredential` or internal session creation
- Set the Better Auth session cookie on the response

**Risk/complexity**: Medium — Better Auth's internal API for programmatic session creation is not extensively documented for custom providers. We may need to interact with the `Session` and `Account` tables directly via Prisma, then set the cookie manually using Better Auth's cookie utilities.

---

### F-004: SteamID Format Conversion for Player Reconciliation

**Summary**: The core value proposition — matching website users to in-game players — requires converting between Steam ID formats. Steam OpenID returns **SteamID64** (e.g., `76561198000000001`), while `PlayerUniqueId.uniqueId` stores **Steam2** format (e.g., `STEAM_0:1:12345`).

**Evidence**:

- `PlayerUniqueId` schema (`schema.prisma:191-202`): composite PK `(uniqueId, game)`, `uniqueId` stored as `STEAM_X:Y:Z`
- Daemon test fixtures confirm Steam2 format: `"STEAM_0:1:12345"`, `"STEAM_1:0:12345"`

**Proposed change**: Create a `packages/crypto/src/steam-id.ts` utility (or similar shared location) with:

```typescript
function steamId2ToSteamId64(steam2: string): string
function steamId64ToSteamId2(steamId64: string): string
function isValidSteamId2(steam2: string): boolean
function isValidSteamId64(steamId64: string): boolean
```

This utility will be used by:

- The Steam callback route (to find matching `PlayerUniqueId` records)
- The admin UI (to display linked player stats for a user)
- Potentially the daemon (if we add real-time linking)

**Risk/complexity**: Low — math is deterministic and well-documented. The `X` value in `STEAM_X:Y:Z` is the "universe" and is typically `0` or `1` (both map to public universe). When converting SteamID64 → Steam2, use `X=0` (legacy) or `X=1` (modern). Query should match **both** variants.

---

### F-005: User-Player Linking Model

**Summary**: We need a way to associate a `User` (Better Auth) with one or more `Player` records (game stats). This can happen:

1. **Automatically at login** — When a user signs in via Steam, look up `PlayerUniqueId` records matching their SteamID and link them
2. **Explicitly via admin UI** — Allow admins to manually link/unlink players to users

**Proposed change**: Add a nullable `userId` column to the `Player` model (or create a junction table `UserPlayer`). The simpler approach is a direct FK:

```prisma
model Player {
  // ... existing fields
  userId   String? @map("user_id")
  userData User?   @relation(fields: [userId], references: [id])
}

model User {
  // ... existing fields
  players Player[]
}
```

On Steam login, query:

```sql
SELECT p.* FROM players p
JOIN player_unique_ids pui ON p.player_id = pui.player_id
WHERE pui.unique_id IN ('STEAM_0:Y:Z', 'STEAM_1:Y:Z')
```

Then set `player.userId = user.id` for all matching players (across all games).

**Risk/complexity**: Medium — Schema migration needed. Must handle edge cases:

- One Steam account may have players across multiple games (CS2, TF2, etc.)
- A player record could theoretically already be linked to another user (admin override needed)
- Players may exist before the user ever logs into the website

---

### F-006: Steam Web API for Profile Data

**Summary**: Steam OpenID only returns the user's SteamID64. To get profile data (display name, avatar), we need a separate call to the Steam Web API using an API key.

**API endpoint**: `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=<KEY>&steamids=<ID64>`

**Response includes**:

- `personaname` — Display name
- `avatarfull` — Full-size avatar URL
- `profileurl` — Steam profile URL

**Proposed change**:

- Require `STEAM_API_KEY` environment variable
- After OpenID validation, fetch profile data from Steam Web API
- Store `personaname` as `user.name`, `avatarfull` as `user.image`
- Optionally refresh on each login

**Risk/complexity**: Low — straightforward HTTP call. Steam API key is free and obtained from https://steamcommunity.com/dev/apikey. Rate limits are generous (100,000 calls/day).

---

### F-007: Removing Google OAuth

**Summary**: Google OAuth is currently conditional (only enabled when env vars are set). Removing it cleanly involves:

1. Delete `google-button.tsx`
2. Remove Google-related code from `auth.ts` (the spread operator conditional)
3. Remove `googleEnabled` prop from login/register pages and forms
4. Remove `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from env configs
5. Clean up any Google-related dependencies (none — Better Auth includes Google support built-in)

**Risk/complexity**: Low — isolated removal with no dependencies.

---

### F-008: Email+Password Registration Without Steam

**Summary**: Not all users need Steam accounts. Admins may want to create accounts with email+password only. The current email+password flow should be preserved alongside Steam auth.

**Proposed change**: Keep `emailAndPassword: { enabled: true }` in Better Auth config. Login page shows both options:

- "Sign in with Steam" button (primary — most users are gamers)
- "Sign in with email" section (secondary — for admins or non-Steam users)

Registration page can be simplified to Steam-only since creating email accounts can be done via the admin panel or seed script.

**Risk/complexity**: Low — existing code already works.

---

### F-009: Security Considerations

**Summary**: Key security aspects for the Steam OpenID integration:

1. **OpenID validation**: Always validate Steam's OpenID response server-side using the `node-steam-openid` library (it handles signature verification). Never trust client-side redirects.

2. **CSRF protection**: The OpenID flow uses a return URL. Validate that the return URL matches your domain. `node-steam-openid` handles this.

3. **Account enumeration**: Steam login reveals whether a SteamID has an account. This is acceptable for a gaming stats site (Steam profiles are already public).

4. **Session fixation**: Better Auth handles session token rotation on login. No additional work needed.

5. **Steam API key exposure**: Keep `STEAM_API_KEY` server-side only. Never expose in client bundles (it's only used in route handlers, which are server-side by definition in Next.js).

**Next.js best-practice**: Environment Variables — https://nextjs.org/docs/app/building-your-application/configuring/environment-variables (only `NEXT_PUBLIC_` prefixed vars are exposed to client)

**Risk/complexity**: Low — standard security practices, mostly handled by the libraries.

---

### F-010: `node-steam-openid` Package Assessment

**Summary**: The recommended npm package for Steam OpenID 2.0 authentication.

| Metric             | Value                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Package            | [`node-steam-openid`](https://www.npmjs.com/package/node-steam-openid) |
| Weekly downloads   | ~2,000                                                                 |
| License            | MIT                                                                    |
| Dependencies       | Minimal (uses `openid` package internally)                             |
| API surface        | 2 methods: `getRedirectUrl()`, `authenticate()`                        |
| TypeScript support | Has `@types/node-steam-openid` or bundled types                        |

**Usage pattern**:

```typescript
import SteamAuth from "node-steam-openid"

const steam = new SteamAuth({
  realm: "https://yourdomain.com",
  returnUrl: "https://yourdomain.com/api/auth/steam/callback",
  apiKey: process.env.STEAM_API_KEY!,
})

// Route 1: Redirect to Steam
const redirectUrl = await steam.getRedirectUrl()

// Route 2: Handle callback
const user = await steam.authenticate(req)
// user.steamid = "76561198000000001"
// user.username = "PlayerName"
// user.avatar.large = "https://..."
```

**Alternative packages**: `passport-steam` (Express-only, heavier), `steam-login` (unmaintained).

**Risk/complexity**: Low — well-understood, focused library.

---

## Phased To-Do Plan

### P0: Foundation — Steam OpenID Infrastructure

- [ ] **P0-1**: Install `node-steam-openid` and types in `apps/web`
  - `pnpm --filter web add node-steam-openid`
  - Check for TypeScript types availability
  - _Ref: F-010_

- [ ] **P0-2**: Create SteamID conversion utilities
  - Create `apps/web/src/lib/steam-id.ts` with `steamId2ToSteamId64()`, `steamId64ToSteamId2()`, validators
  - Include handling for both `STEAM_0:Y:Z` and `STEAM_1:Y:Z` universe variants
  - _Ref: F-004_

- [ ] **P0-3**: Add `STEAM_API_KEY` environment variable
  - Add to `.env.example` / documentation
  - Validate presence at startup in auth config
  - _Ref: F-006, F-009_

### P1: Auth Flow — Steam Login Routes

- [ ] **P1-1**: Create `/api/auth/steam/route.ts` — redirect handler
  - Instantiate `SteamAuth` with realm/returnUrl/apiKey
  - GET handler generates redirect URL and returns `NextResponse.redirect()`
  - _Ref: F-002, F-010_
  - _Next.js docs: https://nextjs.org/docs/app/building-your-application/routing/route-handlers_

- [ ] **P1-2**: Create `/api/auth/steam/callback/route.ts` — callback handler
  - Validate OpenID response via `steam.authenticate()`
  - Extract SteamID64, fetch profile data from Steam Web API
  - Find or create `User` record (use SteamID64 as account identifier)
  - Find or create `Account` record (`providerId: "steam"`, `accountId: steamId64`)
  - Create Better Auth session and set session cookie
  - Redirect to `/admin` (or `/` for non-admin users)
  - _Ref: F-002, F-003, F-006_
  - _Next.js docs: https://nextjs.org/docs/app/building-your-application/routing/route-handlers_

- [ ] **P1-3**: Update `auth.ts` — remove Google provider, keep email+password
  - Remove the Google conditional spread
  - Remove `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` references
  - _Ref: F-007_

- [ ] **P1-4**: Typecheck and validate
  - Run `pnpm --filter web run check-types`
  - Verify no regression in existing auth flows

### P2: UI — Steam Sign-In Experience

- [ ] **P2-1**: Create `steam-button.tsx` — replace `google-button.tsx`
  - Simple link/button that navigates to `/api/auth/steam`
  - Include Steam logo SVG
  - _Ref: F-007_

- [ ] **P2-2**: Update `login-form.tsx` — replace Google with Steam
  - Remove `googleEnabled` prop
  - Add Steam sign-in button (always visible — Steam is the primary social provider)
  - Keep email+password as secondary option
  - _Ref: F-008_

- [ ] **P2-3**: Update `register-form.tsx` — simplify for Steam
  - Consider: Steam login auto-creates accounts, so explicit registration may only be needed for email+password
  - Keep registration form but add Steam option
  - _Ref: F-008_

- [ ] **P2-4**: Update login/register pages — remove `googleEnabled` plumbing
  - Remove env var checks from `login/page.tsx` and `register/page.tsx`
  - Remove `googleEnabled` prop passing
  - _Ref: F-007_

- [ ] **P2-5**: Delete `google-button.tsx`
  - _Ref: F-007_

### P3: Player Reconciliation — Link Users to In-Game Players

- [ ] **P3-1**: Add `userId` column to `Player` model
  - Add nullable `userId String?` FK to `User`
  - Add `User.players` relation
  - Run Prisma migration
  - _Ref: F-005_

- [ ] **P3-2**: Auto-link players on Steam login
  - In the Steam callback handler, after creating the user session:
  - Convert SteamID64 to Steam2 format (both `STEAM_0:Y:Z` and `STEAM_1:Y:Z`)
  - Query `PlayerUniqueId` for matches across all games
  - Set `player.userId` for all matched players
  - _Ref: F-004, F-005_

- [ ] **P3-3**: Admin UI — show linked players on user detail page
  - Display player stats for linked accounts in admin user management
  - Show which games the player has stats in
  - _Ref: F-005_

- [ ] **P3-4**: Admin UI — manual link/unlink player-user
  - Allow admins to manually associate or disassociate players from users
  - Useful for edge cases or corrections
  - _Ref: F-005_

### P4: Cleanup & Polish

- [ ] **P4-1**: Remove Google OAuth environment variables from all configs
  - Remove from `.env.example`, `docker-compose.yml`, deployment configs
  - Update `INSTALLATION.md` with Steam API key instructions
  - _Ref: F-007_

- [ ] **P4-2**: Handle edge case — user with both email+password and Steam
  - Support account linking: existing email user can connect Steam account
  - Better Auth's `Account` model supports multiple providers per user
  - _Ref: F-003, F-008_

- [ ] **P4-3**: Steam avatar refresh on login
  - On each Steam login, update `user.image` with latest avatar URL
  - Update `user.name` with current Steam persona name (or keep original — configurable)
  - _Ref: F-006_

- [ ] **P4-4**: Public player profile — show Steam link
  - On public player pages (`/servers/[id]` player stats), if the player is linked to a user with Steam, show the Steam profile link
  - _Ref: F-005, F-006_

---

## Open Questions / Follow-ups

1. **Steam API Key availability**: Does the deployment environment already have a Steam Web API key? One is required and can be obtained free at https://steamcommunity.com/dev/apikey. This blocks P0-3.

2. **`node-steam-openid` and Next.js Edge Runtime**: The `node-steam-openid` package uses Node.js built-ins. Route handlers default to Node.js runtime in Next.js, so this is fine — but do **not** add `export const runtime = "edge"` to the Steam route handlers.

3. **Better Auth programmatic session creation**: The exact internal API for creating a session outside of Better Auth's plugin flow may require reading Better Auth source code. The `auth.api` surface should be investigated during P1-2 implementation. If direct session creation isn't exposed, we can create `Account` + `Session` records via Prisma directly and set the cookie using Better Auth's cookie configuration.

4. **Multiple games per SteamID**: A single Steam account may have `PlayerUniqueId` entries across CS2, TF2, etc. P3-2 should link **all** matching players, not just the first one found. The `Player.userId` approach supports this (one user → many players).

5. **Universe bit in Steam2 ID**: Some databases store `STEAM_0:Y:Z` while others use `STEAM_1:Y:Z`. Both refer to the same account. The lookup query in P3-2 must check for both variants.
