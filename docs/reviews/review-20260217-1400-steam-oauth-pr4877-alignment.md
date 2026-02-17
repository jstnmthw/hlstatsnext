# Next.js v16 Engineering Review — Steam Auth via Better Auth PR #4877

## Scope

This review **supersedes** `review-20260214-1800-steam-oauth-integration.md` by aligning the Steam authentication strategy with **Better Auth PR #4877** (`feat/oauth/steam-v2`). The PR adds a native Steam plugin to Better Auth using OpenID 2.0. The PR is currently in **Draft/Blocked** status (pending infrastructure work to extract plugins), but the maintainers recommend copy-pasting the implementation into your codebase.

Key changes from the original review:

- **Drop `node-steam-openid`** — PR #4877 handles OpenID 2.0 directly via `betterFetch`
- **Drop custom Next.js route handlers** — the plugin integrates with Better Auth's existing `[...all]` catch-all
- **Session creation is handled natively** — uses `ctx.context.internalAdapter` + `setSessionCookie`
- **Email must be collected client-side** — Steam does not return email addresses; the plugin requires email in the `POST /sign-in/steam` body
- **Account linking is built-in** — `POST /link-social/steam` endpoint when `accountLinking: true`

## Repo/System Context

| Property                | Value                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| **Monorepo**            | Turborepo + pnpm workspaces                                             |
| **Frontend**            | Next.js v16.1.6, App Router, Turbopack                                  |
| **Auth library**        | Better Auth v1.4.18 with Prisma adapter (MySQL) + admin plugin (RBAC)   |
| **Auth package**        | `packages/auth/` — exports server, client, session, permissions         |
| **Auth client**         | `better-auth/react` with `adminClient` + `emailOTPClient` plugins       |
| **Existing OAuth**      | Google (conditional — only when env vars present)                       |
| **Player model**        | `players` table with `playerId` (PK), linked to `PlayerUniqueId`        |
| **PlayerUniqueId**      | Composite PK `(uniqueId, game)` — stores Steam IDs as `STEAM_X:Y:Z`     |
| **Better Auth Account** | `account` table with `accountId`, `providerId`, `userId` (FK to `user`) |
| **Route handler**       | `app/api/auth/[...all]/route.ts` → `toNextJsHandler(auth)`              |

### Current Auth Files

```
packages/auth/src/
  server.ts           — Better Auth server config (email + conditional Google)
  client.ts           — Better Auth React client ("use client")
  session.ts          — getSession() and requireAuth() helpers
  permissions.ts      — RBAC (admin/user roles)
  mail.ts             — OTP email sending (console or Resend)
  cookies.ts          — Re-exports getSessionCookie

apps/web/src/
  app/api/auth/[...all]/route.ts    — Better Auth catch-all handler
  app/(auth)/login/page.tsx         — Server component, checks googleEnabled env
  app/(auth)/register/page.tsx      — Server component, checks googleEnabled env
  features/auth/components/
    login-form.tsx                  — Email/password + conditional Google
    register-form.tsx               — Email/password + conditional Google
    google-button.tsx               — signIn.social({ provider: "google" })
```

## Measurement Methodology (DevTools)

Not measured (architectural review for a new feature — runtime diagnostics not applicable).

## Baseline Results

| Metric                        | Value                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| Current social providers      | Google (conditional)                                               |
| Better Auth version           | `^1.4.18`                                                          |
| Players with SteamIDs in DB   | Stored as `STEAM_X:Y:Z` in `player_unique_ids`                     |
| Better Auth `account` records | `providerId: "credential"` or `"google"`                           |
| Auth route handler            | Single catch-all at `/api/auth/[...all]`                           |
| PR #4877 status               | Draft, blocked on plugin extraction infra. Copy-paste recommended. |
| Steam API key required        | Yes — for `ISteamUser/GetPlayerSummaries/v0002` (avatar, username) |

---

## Findings

### F-001: PR #4877 Eliminates `node-steam-openid` Dependency

**Summary**: The original review (F-001, F-010) proposed `node-steam-openid` as the OpenID 2.0 handler. PR #4877 implements OpenID 2.0 directly using `betterFetch` from `@better-fetch/fetch` (already a Better Auth dependency), making the external package unnecessary.

**Evidence** — PR code (`steam/index.ts`):

```typescript
// Validation: changes openid.mode to "check_authentication" and POSTs to Steam
params["openid.mode"] = "check_authentication"
const verifyRes = await betterFetch<string>(
  `https://steamcommunity.com/openid/login?${new URLSearchParams(params).toString()}`,
  { method: "POST" },
)
if (!verifyRes.data.includes("is_valid:true")) {
  throw ctx.redirect(`${errorURL}?error=steam_openid_validation_failed`)
}
// Extract SteamID64 from claimed_id
const steamId = params["openid.claimed_id"]?.split("/").pop()
```

**Impact on original review**: Findings F-001, F-010 are **obsolete**. No need to install or assess `node-steam-openid`.

**Risk/complexity**: Low — fewer dependencies, proven approach inside Better Auth's own codebase.

---

### F-002: Plugin Architecture Replaces Custom Route Handlers

**Summary**: The original review (F-002) proposed two custom Next.js route handlers (`/api/auth/steam/route.ts` and `/api/auth/steam/callback/route.ts`). PR #4877 uses Better Auth's `createAuthEndpoint` plugin system, meaning the endpoints are served by the existing `[...all]` catch-all.

**Evidence** — PR endpoints:

| Endpoint             | Method | Purpose                                |
| -------------------- | ------ | -------------------------------------- |
| `/sign-in/steam`     | POST   | Builds OpenID redirect URL             |
| `/steam/callback`    | GET    | Validates OpenID, creates user+session |
| `/link-social/steam` | POST   | Links Steam to existing user account   |

These resolve to `/api/auth/sign-in/steam`, `/api/auth/steam/callback`, `/api/auth/link-social/steam` under the existing catch-all.

**Next.js best-practice**: Route Handlers — https://nextjs.org/docs/app/getting-started/route-handlers

The catch-all `[...all]` pattern correctly handles all sub-paths. No additional route files needed.

**Impact on original review**: F-002 is **obsolete**. No custom route handlers to create.

**Risk/complexity**: Low — standard Better Auth plugin pattern.

---

### F-003: Session Creation Fully Handled by Plugin

**Summary**: The original review (F-003) debated between using `auth.api` internal methods vs. direct Prisma. PR #4877 resolves this by using `ctx.context.internalAdapter` for all CRUD and `setSessionCookie` for cookie management.

**Evidence** — PR callback handler:

```typescript
// Create user via internal adapter
user = await ctx.context.internalAdapter.createUser({
  name: userDetails?.name || profile.realname || "Unknown",
  email: userDetails?.email || email,
  emailVerified: userDetails?.emailVerified || false,
  image: userDetails?.image || profile.avatarfull || "",
})
// Create account record
account = await ctx.context.internalAdapter.createAccount({
  accountId: steamId,
  providerId: "steam",
  userId: user.id,
})
// Create session and set cookie
const session = await ctx.context.internalAdapter.createSession(user.id)
await setSessionCookie(ctx, { session, user })
```

**Impact on original review**: F-003 is **resolved**. No manual session/cookie work needed.

**Risk/complexity**: Low — uses Better Auth's own internal adapter, guaranteeing consistency.

---

### F-004: Email Requirement — Steam Does Not Return Email

**Summary**: This is a **new finding** not covered in the original review. Steam OpenID returns only the SteamID64. PR #4877 requires `email` in the `POST /sign-in/steam` body for new user creation. This means the client UI must collect the user's email before initiating the Steam flow.

**Evidence** — PR sign-in endpoint body schema:

```typescript
body: z.object({
  email: z.string().meta({ description: "The email to use for the user" }),
  callbackURL: z.string().optional(),
  // ...
})
```

And in the callback:

```typescript
if (!email) {
  throw ctx.redirect(`${errorURL}?error=email_required`)
}
```

**UX implications for HLStatsNext**:

1. **New Steam users**: Must provide email before Steam redirect. Options:
   - Show an email input field alongside the "Sign in with Steam" button
   - Use a two-step flow: click Steam → prompt for email → redirect to Steam
2. **Returning Steam users**: The plugin looks up the existing account by SteamID — email is only needed for first sign-up. However, the current PR code always requires email in the POST body, even for returning users (it just won't use it if the account already exists).
3. **HLStatsNext advantage**: Many users already have email+password accounts. Account linking (`/link-social/steam`) doesn't require email since the user is already authenticated.

**Proposed change**: Create a `SteamSignInForm` component that collects email, then calls `signIn.steam({ email, callbackURL: "/admin" })`. For users who already have accounts, promote the account linking flow instead.

**Risk/complexity**: Medium — UX design decision. The email requirement adds friction to the Steam login flow compared to a typical "click and go" OAuth button.

---

### F-005: Copy-Paste Strategy for the Plugin

**Summary**: Since PR #4877 is blocked on Better Auth infrastructure changes, the recommended approach is to copy the plugin code into our codebase. This requires adapting the imports.

**Evidence** — PR discussion confirms copy-paste is acceptable. The plugin has two files:

1. `steam/index.ts` (~350 lines) — server plugin with 3 endpoints
2. `steam/client.ts` (~12 lines) — client plugin type inference

**Proposed change**: Create the plugin in `packages/auth/src/plugins/steam/`:

```
packages/auth/src/plugins/steam/
  index.ts    — Server plugin (adapted imports)
  client.ts   — Client plugin
```

**Import adaptations needed**:

| PR Import                     | Our Adaptation                              |
| ----------------------------- | ------------------------------------------- |
| `from "../../api"`            | `from "better-auth/api"` or inline types    |
| `from "../../cookies"`        | `from "better-auth/cookies"`                |
| `from "../../types"`          | `from "better-auth/types"`                  |
| `from "../../utils/wildcard"` | Copy `wildcardMatch` utility or use our own |
| `from "../../client/types"`   | `from "better-auth/client/types"`           |
| `@better-fetch/fetch`         | Already a Better Auth dependency            |

**Critical**: We need to verify which of these paths are actually exported from the `better-auth` package. If internal paths like `better-auth/api` or `better-auth/cookies` are not public exports, we'll need to either:

- Import from `better-auth` root and find the re-exports
- Copy the necessary utility functions (like `wildcardMatch`, `createAuthEndpoint`, `setSessionCookie`)

**Risk/complexity**: Medium — the main risk is that Better Auth's internal APIs (`createAuthEndpoint`, `setSessionCookie`, `internalAdapter`) may not be stable public exports. If they change in a minor version, our copy breaks. Pin the Better Auth version until the official plugin lands.

---

### F-006: SteamID Format Conversion Still Needed for Player Reconciliation

**Summary**: The PR plugin handles authentication but does **not** handle player-to-user linking. The original review's F-004 (SteamID conversion) and F-005 (User-Player linking) remain valid and necessary.

**Evidence**: The PR stores `accountId: steamId` where `steamId` is the SteamID64 extracted from `openid.claimed_id`. The `PlayerUniqueId` table stores Steam2 format (`STEAM_X:Y:Z`). Conversion is still needed.

**SteamID conversion formulas** (unchanged from original review):

```
Steam2 → SteamID64: 76561197960265728 + (Y * 2) + Z  (where STEAM_X:Y:Z)
SteamID64 → Steam2: Y = (id64 - 76561197960265728) % 2, Z = (id64 - 76561197960265728 - Y) / 2
```

**Proposed change**: Create `packages/auth/src/lib/steam-id.ts` (or `packages/crypto/`) with conversion utilities. Use in the `mapProfileToUser` callback or as a post-login hook.

**Next.js best-practice**: Environment Variables — https://nextjs.org/docs/app/guides/environment-variables — `STEAM_API_KEY` must remain server-only (no `NEXT_PUBLIC_` prefix).

**Risk/complexity**: Low — deterministic math, well-documented.

---

### F-007: Account Linking Flow for Existing Email Users

**Summary**: Many HLStatsNext users will have email+password accounts created before Steam auth exists. PR #4877 includes a dedicated `/link-social/steam` endpoint that requires an active session and `accountLinking: true` in the plugin config.

**Evidence** — PR link endpoint:

```typescript
linkAccountWithSteam: createAuthEndpoint(
  "/link-social/steam",
  {
    method: "POST",
    use: [sessionMiddleware], // Requires active session
    body: z.object({
      callbackURL: z.string().optional(),
      errorCallbackURL: z.string().optional(),
      disableRedirect: z.boolean().optional(),
    }),
  },
  async (ctx) => {
    if (config.accountLinking !== true) {
      throw new APIError("BAD_REQUEST", { message: "Account linking is disabled" })
    }
    // ... builds OpenID redirect with linkAccount=true flag
  },
)
```

The callback handler detects `linkAccount === "true"` and:

1. Gets the current session
2. Checks for existing account with that SteamID
3. Creates an `Account` record linking Steam to the current user
4. Optionally updates user name/image if `accountLinking.updateUserInfoOnLink` is enabled

**Proposed change**: Add a "Link Steam Account" button in the account settings page (or admin user profile). This is the cleanest path for existing users.

**Next.js best-practice**: Authentication — https://nextjs.org/docs/app/guides/authentication — Better Auth handles session cookies; the catch-all route handler serves all endpoints.

**Risk/complexity**: Low — built into the plugin.

---

### F-008: Google OAuth Removal

**Summary**: Unchanged from original review F-007. Google OAuth removal is straightforward and can proceed as planned.

**Files to modify**:

1. `packages/auth/src/server.ts` — remove Google conditional spread (lines 34-63)
2. `packages/auth/src/client.ts` — no changes (client doesn't reference Google directly)
3. `apps/web/src/features/auth/components/google-button.tsx` — delete
4. `apps/web/src/features/auth/components/login-form.tsx` — remove `googleEnabled` prop + `GoogleButton` import
5. `apps/web/src/features/auth/components/register-form.tsx` — remove `googleEnabled` prop + `GoogleButton` import
6. `apps/web/src/app/(auth)/login/page.tsx` — remove `googleEnabled` env check
7. `apps/web/src/app/(auth)/register/page.tsx` — remove `googleEnabled` env check (if similar)

**Risk/complexity**: Low — isolated removal.

---

### F-009: Trusted Origins Configuration Required

**Summary**: PR #4877's callback handler validates redirect URLs against `trustedOrigins` from the Better Auth config. If `trustedOrigins` is not configured, all callback/error redirect URLs will be rejected.

**Evidence** — PR callback handler:

```typescript
const trustedOrigins: string[] =
  typeof ctx.context.options.trustedOrigins === "function"
    ? await ctx.context.options.trustedOrigins(ctx.request)
    : ctx.context.options.trustedOrigins || []

const isMatch = wildcardMatch(trustedOrigins)

if (!isMatch(new URL(callbackURL).origin)) {
  throw ctx.redirect(`${errorURL}?error=callback_url_not_trusted`)
}
```

**Proposed change**: Add `trustedOrigins` to the Better Auth config in `packages/auth/src/server.ts`:

```typescript
export const auth = betterAuth({
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
  // ... rest of config
})
```

**Next.js best-practice**: Environment Variables — https://nextjs.org/docs/app/guides/environment-variables — use `NEXT_PUBLIC_APP_URL` for the origin (or a server-only `APP_URL`).

**Risk/complexity**: Low — but missing this config will cause all Steam redirects to fail silently.

---

### F-010: Plugin Client Integration

**Summary**: The PR provides a minimal client plugin (`steamClient`) that types the `/sign-in/steam` endpoint as POST. This integrates with Better Auth's client to provide `signIn.steam()` and `linkSocial.steam()` methods.

**Evidence** — PR client plugin:

```typescript
import type { BetterAuthClientPlugin } from "better-auth/client/types"
import type { steam } from "./index"

export const steamClient = () => {
  return {
    id: "steam-client",
    $InferServerPlugin: {} as ReturnType<typeof steam>,
    pathMethods: {
      "/sign-in/steam": "POST",
    },
  } satisfies BetterAuthClientPlugin
}
```

**Proposed change**: Add `steamClient()` to `packages/auth/src/client.ts`:

```typescript
import { steamClient } from "./plugins/steam/client"

export const authClient = createAuthClient({
  plugins: [
    adminClient({ ... }),
    emailOTPClient(),
    steamClient(),
  ],
})
```

This enables `signIn.steam({ email, callbackURL })` on the client.

**Risk/complexity**: Low — standard Better Auth client plugin pattern.

---

### F-011: Security Review of PR #4877 Implementation

**Summary**: Security assessment of the PR's OpenID 2.0 implementation.

**Strengths**:

1. **Server-side OpenID validation**: Changes `openid.mode` to `check_authentication` and POSTs back to Steam for signature verification
2. **Origin validation**: Checks callback URLs against `trustedOrigins`
3. **Session management**: Uses Better Auth's `setSessionCookie` (HttpOnly, Secure, SameSite)
4. **Zod validation**: All query params and body fields are validated via Zod schemas

**Concerns flagged in PR review** (from GitHub discussion):

1. **Unverified email**: The plugin sets `emailVerified: false` for new users. Since Steam doesn't provide email, the email passed by the client is unverified. In our case, this is acceptable because email verification is handled separately via emailOTP.
2. **Email as attack vector**: A malicious user could sign in with Steam and claim someone else's email. However, since `emailVerified: false`, this shouldn't grant access to the other user's account. Our `requireEmailVerification: true` config mitigates this.

**Next.js best-practice**: Authentication — https://nextjs.org/docs/app/guides/authentication — "treat Route Handlers with the same security considerations as public-facing API endpoints."

**Risk/complexity**: Low — the PR's approach is sound. The email concern is mitigated by our existing email verification flow.

---

## Phased To-Do Plan

### P0: Plugin Infrastructure

- [ ] **P0-1**: Verify Better Auth internal exports availability
  - Check if `createAuthEndpoint`, `setSessionCookie`, `getSessionFromCtx`, `sessionMiddleware`, `APIError`, `wildcardMatch` are importable from `better-auth` public paths
  - If not, identify which utilities need to be copied alongside the plugin
  - _Ref: F-005_

- [ ] **P0-2**: Copy PR #4877 plugin into `packages/auth/src/plugins/steam/`
  - Create `packages/auth/src/plugins/steam/index.ts` (adapted from PR)
  - Create `packages/auth/src/plugins/steam/client.ts` (adapted from PR)
  - Adapt imports from Better Auth internals to public exports
  - _Ref: F-001, F-002, F-003, F-005_

- [ ] **P0-3**: Add `STEAM_API_KEY` environment variable
  - Add to `.env.example` and documentation
  - Server-only — no `NEXT_PUBLIC_` prefix
  - _Ref: F-006_
  - _Next.js docs: https://nextjs.org/docs/app/guides/environment-variables_

- [ ] **P0-4**: Create SteamID conversion utilities
  - Create `packages/auth/src/lib/steam-id.ts` with `steamId2ToSteamId64()`, `steamId64ToSteamId2()`, validators
  - Handle both `STEAM_0:Y:Z` and `STEAM_1:Y:Z` universe variants
  - _Ref: F-006_

- [ ] **P0-5**: Add `trustedOrigins` to Better Auth server config
  - Configure in `packages/auth/src/server.ts`
  - _Ref: F-009_
  - _Next.js docs: https://nextjs.org/docs/app/guides/environment-variables_

### P1: Auth Flow Integration

- [ ] **P1-1**: Register Steam plugin in Better Auth server config
  - Add `steam({ steamApiKey, accountLinking: true, mapProfileToUser })` to plugins array in `packages/auth/src/server.ts`
  - Remove Google OAuth conditional spread
  - Update `account.accountLinking.trustedProviders` to include `"steam"`
  - _Ref: F-005, F-008_

- [ ] **P1-2**: Register Steam client plugin
  - Add `steamClient()` to `packages/auth/src/client.ts` plugins array
  - Export any needed types
  - _Ref: F-010_

- [ ] **P1-3**: Typecheck and validate
  - Run `pnpm --filter auth run check-types`
  - Run `pnpm --filter web run check-types`
  - Verify no regression in existing auth flows (email+password, emailOTP)
  - _Ref: F-005_

### P2: UI — Steam Sign-In Experience

- [ ] **P2-1**: Create `steam-button.tsx` component
  - Collect email (show input or use stored email), then call `signIn.steam({ email, callbackURL: "/admin" })`
  - Include Steam logo SVG
  - Handle the email requirement UX (see F-004)
  - _Ref: F-004_
  - _Next.js docs: https://nextjs.org/docs/app/guides/authentication_

- [ ] **P2-2**: Update `login-form.tsx` — replace Google with Steam
  - Remove `googleEnabled` prop and `GoogleButton` import
  - Add Steam sign-in section (always visible)
  - Keep email+password as secondary option
  - _Ref: F-004, F-008_

- [ ] **P2-3**: Update `register-form.tsx` — replace Google with Steam
  - Remove `googleEnabled` prop and `GoogleButton` import
  - Add Steam sign-in option
  - _Ref: F-004, F-008_

- [ ] **P2-4**: Update login/register pages — remove Google plumbing
  - Remove `googleEnabled` env var checks from `login/page.tsx` and `register/page.tsx`
  - _Ref: F-008_

- [ ] **P2-5**: Delete `google-button.tsx`
  - _Ref: F-008_

- [ ] **P2-6**: Account linking UI
  - Add "Link Steam Account" button in account settings (calls `linkSocial.steam()`)
  - Show linked Steam profile info (avatar, name) when linked
  - _Ref: F-007_

### P3: Player Reconciliation

- [ ] **P3-1**: Add `userId` column to `Player` model
  - Add nullable `userId String?` FK to `User` in Prisma schema
  - Add `User.players Player[]` relation
  - Run Prisma migration
  - _Ref: Original review F-005_

- [ ] **P3-2**: Auto-link players on Steam login via `mapProfileToUser`
  - In the `mapProfileToUser` callback (or as a post-login hook):
    - Extract SteamID64 from profile
    - Convert to Steam2 format (both `STEAM_0:Y:Z` and `STEAM_1:Y:Z`)
    - Query `PlayerUniqueId` for matches across all games
    - Set `player.userId` for all matched players
  - _Ref: F-006_

- [ ] **P3-3**: Admin UI — show linked players on user detail page
  - Display player stats for linked accounts
  - Show which games the player has stats in
  - _Ref: Original review F-005_

### P4: Cleanup & Polish

- [ ] **P4-1**: Remove Google OAuth environment variables from all configs
  - Remove from `.env.example`, `docker-compose.yml`, deployment configs
  - Update `INSTALLATION.md` with Steam API key instructions
  - _Ref: F-008_

- [ ] **P4-2**: Steam avatar/name refresh on login
  - In `mapProfileToUser`, use `profile.avatarfull` for `image` and `profile.personaname` for `name`
  - These update on each login automatically via the plugin
  - _Ref: Original review F-006_

- [ ] **P4-3**: Pin Better Auth version
  - Pin to exact version (e.g., `1.4.18`) until official Steam plugin lands
  - Prevents internal API breakage from minor updates
  - _Ref: F-005_

- [ ] **P4-4**: Monitor PR #4877 for merge
  - When the PR merges and releases, replace our copy-pasted plugin with the official `better-auth/plugins` import
  - Remove copied utility functions
  - _Ref: F-005_

---

## Open Questions / Follow-ups

1. **Better Auth internal export availability**: Can we import `createAuthEndpoint`, `setSessionCookie`, `getSessionFromCtx`, `sessionMiddleware`, `APIError` from public `better-auth` paths? This is the **P0 blocker** — if not, we need to assess how much code to copy. The PR imports these from relative paths (`../../api`, `../../cookies`), which won't work as a consumer.

2. **Email UX for Steam sign-in**: The PR requires email in the POST body. Two approaches:
   - **Option A**: Show email field + Steam button together (simpler, but adds friction)
   - **Option B**: Two-step: click Steam → modal asks for email → redirect (smoother, but more complex)
   - **Option C**: For returning users with existing accounts, skip email entirely by using account linking flow
   - Decision needed before P2-1.

3. **`mapProfileToUser` for player linking**: The plugin's `mapProfileToUser` runs during user creation only (not on subsequent logins). Player auto-linking on every login would need a separate hook or be done in the callback handler adaptation. Decide whether to link once (on first login) or re-check on every login.

4. **Email verification for Steam users**: The PR sets `emailVerified: false`. Our config has `requireEmailVerification: true`. This means Steam-only users might need to verify email via OTP before accessing protected features. Decide if this is desired or if Steam users should bypass email verification.

5. **`wildcardMatch` utility**: The PR imports this from Better Auth internals. If not publicly exported, we need a replacement. It's a simple glob-style origin matcher — could use a 5-line implementation or an npm package like `picomatch`.
