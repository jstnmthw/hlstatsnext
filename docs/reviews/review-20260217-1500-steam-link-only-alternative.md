# Next.js v16 Engineering Review — Steam Account Linking (No Better Auth Modification)

## Scope

This review presents an **alternative approach** to Steam integration that avoids modifying Better Auth entirely. Instead of adding Steam as a social login provider (as explored in `review-20260214-1800` and `review-20260217-1400`), this approach:

- **Keeps Better Auth untouched** — email+password login stays as-is, no plugin copy-paste, no internal API usage
- **Adds "Link Steam Account"** as a feature for already-authenticated users
- **Uses Steam OpenID 2.0** via two simple Next.js Route Handlers to verify Steam account ownership
- **Stores the SteamID64** on the User model for player reconciliation
- **Auto-links players** by converting SteamID64 to Steam2 format and matching `PlayerUniqueId` records

This approach is significantly simpler and lower-risk than the Better Auth plugin approaches.

## Repo/System Context

| Property             | Value                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| **Monorepo**         | Turborepo + pnpm workspaces                                              |
| **Frontend**         | Next.js v16.1.6, App Router, Turbopack                                   |
| **Auth library**     | Better Auth v1.4.18 — unchanged (email+password, admin plugin, emailOTP) |
| **Auth package**     | `packages/auth/` — exports server, client, session, permissions          |
| **Account settings** | `apps/web/src/app/(accounts)/accounts/settings/page.tsx` — exists        |
| **Accounts layout**  | `apps/web/src/app/(accounts)/layout.tsx` — protected, requires auth      |
| **Player model**     | `players` table, no `userId` FK (Players and Users are separate)         |
| **PlayerUniqueId**   | Composite PK `(uniqueId, game)` — stores SteamIDs as `STEAM_X:Y:Z`       |
| **Route handler**    | `app/api/auth/[...all]/route.ts` — Better Auth catch-all                 |

### Current Account Settings

```
apps/web/src/
  app/(accounts)/
    layout.tsx                 — Protected layout (requireAuth)
    accounts/settings/page.tsx — Profile form + password change form
  features/accounts/components/
    profile-form.tsx           — Update name (authClient.updateUser)
    password-form.tsx          — Change password (authClient.changePassword)
```

The account settings page currently has two cards: profile (name) and password change. A third card for "Linked Accounts" fits naturally here.

## Measurement Methodology (DevTools)

Runtime introspection unavailable (dev server not running). Static analysis only.

## Baseline Results

| Metric                       | Value                                             |
| ---------------------------- | ------------------------------------------------- |
| Better Auth modifications    | **None** — this approach leaves it untouched      |
| External dependencies needed | **None** — raw OpenID 2.0 via `fetch()`           |
| New route handlers           | 2 (`/api/steam/link` and `/api/steam/callback`)   |
| Schema changes               | 2 fields on User model (`steamId`, `steamAvatar`) |
| Player model changes         | 1 nullable FK (`userId`)                          |
| Auth flow changes            | **None** — login/register unchanged               |

---

## Findings

### F-001: Architecture — Steam Linking as a Separate Concern

**Summary**: By treating Steam as an "account link" rather than a login provider, we completely decouple it from Better Auth. The flow is:

1. User logs in with email+password (existing flow, unchanged)
2. User navigates to Account Settings
3. User clicks "Link Steam Account"
4. Browser redirects to Steam OpenID
5. Steam redirects back to our callback
6. Callback validates OpenID, extracts SteamID64, stores it on the User record
7. System converts SteamID64 → Steam2 and auto-links matching Player records

**Key advantage**: Zero risk of breaking existing auth. No Better Auth internal APIs, no plugin copy-paste, no version pinning concerns.

**Evidence**: The existing `(accounts)` route group with `requireAuth()` in the layout already provides the protected context needed.

**Next.js best-practice**: Route Handlers — https://nextjs.org/docs/app/api-reference/file-conventions/route — custom route handlers for the Steam OpenID flow sit alongside the Better Auth catch-all without conflicts.

**Risk/complexity**: Low — standard route handler pattern.

---

### F-002: Steam OpenID 2.0 Without External Dependencies

**Summary**: The Steam OpenID 2.0 flow is simple enough to implement with native `fetch()`. No need for `node-steam-openid` or any external library. The flow is:

1. **Redirect**: Build a URL to `https://steamcommunity.com/openid/login` with OpenID parameters
2. **Callback**: Steam redirects back with signed parameters
3. **Validate**: POST the parameters back to Steam with `openid.mode=check_authentication`
4. **Extract**: Parse `openid.claimed_id` to get SteamID64

**Evidence** — the validation is a single `fetch()` call (same pattern as Better Auth PR #4877):

```typescript
// Change mode to validation
params.set("openid.mode", "check_authentication")
const res = await fetch(`https://steamcommunity.com/openid/login?${params.toString()}`, {
  method: "POST",
})
const text = await res.text()
const isValid = text.includes("is_valid:true")
```

**Proposed route handler structure**:

```
apps/web/src/app/api/steam/
  link/route.ts       — GET: builds OpenID URL, redirects to Steam
  callback/route.ts   — GET: validates OpenID response, stores SteamID, redirects back
```

These routes do NOT conflict with `app/api/auth/[...all]/route.ts` because they're under `/api/steam/`, not `/api/auth/`.

**Next.js best-practice**: Route Handlers — https://nextjs.org/docs/app/getting-started/route-handlers — "Route Handlers can be nested anywhere inside the `app` directory." The `/api/steam/` prefix keeps them cleanly separated.

**Risk/complexity**: Low — no external dependencies, well-documented protocol.

---

### F-003: Schema Changes — User Model Extension

**Summary**: Add two fields to the User model to store Steam data. This is simpler than using the Better Auth `Account` table because we're not treating Steam as a login provider.

**Proposed change**:

```prisma
model User {
  // ... existing fields
  steamId     String?  @unique @map("steam_id") @db.VarChar(20)    // SteamID64
  steamName   String?  @map("steam_name") @db.VarChar(64)          // Steam persona name
  steamAvatar String?  @map("steam_avatar") @db.Text               // Avatar URL

  players Player[] // New relation
}
```

**Why not use the `Account` table?** The Account table is managed by Better Auth for OAuth providers. Putting Steam data there would require Better Auth to understand the `"steam"` provider, which defeats the purpose of this approach. Simple nullable columns on User are cleaner.

**Alternative considered**: A separate `SteamLink` table. Rejected — one-to-one relationship doesn't warrant a separate table when 3 nullable fields suffice.

**Risk/complexity**: Low — simple nullable columns, no existing data affected.

---

### F-004: Schema Changes — Player-User Linking

**Summary**: Add a nullable `userId` FK on the Player model to connect game players with website users. This is the same approach proposed in all previous reviews.

**Proposed change**:

```prisma
model Player {
  // ... existing fields
  userId   String? @map("user_id")
  userData User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

`onDelete: SetNull` ensures that if a User is deleted, the Player record survives (game stats are preserved).

**Auto-linking logic** (runs in the Steam callback handler):

```typescript
// Convert SteamID64 to Steam2 variants
const steam2_v0 = steamId64ToSteam2(steamId64, 0) // STEAM_0:Y:Z
const steam2_v1 = steamId64ToSteam2(steamId64, 1) // STEAM_1:Y:Z

// Find all matching player records across all games
const playerIds = await db.playerUniqueId.findMany({
  where: { uniqueId: { in: [steam2_v0, steam2_v1] } },
  select: { playerId: true },
})

// Link players to user
if (playerIds.length > 0) {
  await db.player.updateMany({
    where: { playerId: { in: playerIds.map((p) => p.playerId) } },
    data: { userId: user.id },
  })
}
```

**Risk/complexity**: Medium — schema migration required. Edge cases:

- A player could already be linked to a different user (query should skip those)
- One Steam account may have players across multiple games (intentional — link all)

---

### F-005: SteamID Conversion Utilities

**Summary**: Unchanged from previous reviews. A shared utility for converting between Steam ID formats.

**Proposed location**: `apps/web/src/lib/steam-id.ts` (only needed in the web app for now)

```typescript
const STEAM_BASE = 76561197960265728n

export function steamId64ToSteam2(id64: string, universe = 0): string {
  const n = BigInt(id64)
  const y = (n - STEAM_BASE) % 2n
  const z = (n - STEAM_BASE - y) / 2n
  return `STEAM_${universe}:${y}:${z}`
}

export function steamId2ToSteamId64(steam2: string): string {
  const match = steam2.match(/^STEAM_\d+:(\d+):(\d+)$/)
  if (!match) throw new Error(`Invalid Steam2 ID: ${steam2}`)
  const y = BigInt(match[1])
  const z = BigInt(match[2])
  return (STEAM_BASE + y + z * 2n).toString()
}
```

Uses `BigInt` for precise 64-bit integer math.

**Risk/complexity**: Low — deterministic, well-documented formulas.

---

### F-006: Steam Web API for Profile Data

**Summary**: After validating the OpenID response, fetch the user's Steam profile (display name, avatar) from the Steam Web API.

**API call**: `GET https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key={KEY}&steamids={ID64}`

**Returns**: `personaname`, `avatarfull`, `profileurl`

**Environment variable**: `STEAM_API_KEY` (server-only, no `NEXT_PUBLIC_` prefix)

**Next.js best-practice**: Environment Variables — https://nextjs.org/docs/app/guides/environment-variables — "Non-`NEXT_PUBLIC_` environment variables are only available in the Node.js environment." Route Handlers run in Node.js runtime by default.

**Risk/complexity**: Low — straightforward HTTP call. API key is free from https://steamcommunity.com/dev/apikey.

---

### F-007: Session Validation in Route Handlers

**Summary**: The Steam link/callback route handlers must verify that the user is authenticated before proceeding. Since these are standard Next.js route handlers (not Better Auth endpoints), we use our existing `requireAuth()` helper for the link initiation, and pass the user ID via a signed state parameter for the callback.

**Link route** (`/api/steam/link`):

```typescript
import { requireAuth } from "@repo/auth/session"
import { redirect } from "next/navigation"

export async function GET() {
  const session = await requireAuth() // Throws if not authenticated

  // Encode user ID + timestamp as state for CSRF protection
  const state = encodeState(session.user.id)

  // Build OpenID redirect URL with state in return_to
  const returnTo = `${baseUrl}/api/steam/callback?state=${state}`
  // ... build openid URL and redirect
}
```

**Callback route** (`/api/steam/callback`):

```typescript
export async function GET(request: NextRequest) {
  // Validate OpenID response
  // Decode and verify state parameter (user ID + timestamp)
  // Extract SteamID64
  // Fetch Steam profile
  // Update user record with steamId, steamName, steamAvatar
  // Auto-link players
  // Redirect to /accounts/settings?steam=linked
}
```

The state parameter serves as CSRF protection — it encodes the user's ID and a timestamp, signed with a secret. The callback verifies the signature before proceeding.

**Next.js best-practice**: Authentication — https://nextjs.org/docs/app/guides/authentication — "Treat Route Handlers with the same security considerations as public-facing API endpoints, and verify if the user is allowed to access the Route Handler."

**Risk/complexity**: Low — standard auth check pattern.

---

### F-008: UI — Account Settings Integration

**Summary**: Add a "Steam Account" card to the existing account settings page at `apps/web/src/app/(accounts)/accounts/settings/page.tsx`. The card shows:

- **Not linked**: "Link Steam Account" button that navigates to `/api/steam/link`
- **Linked**: Steam avatar, display name, SteamID64, "Unlink" button, and count of linked players

**Component structure**:

```
features/accounts/components/
  steam-link-card.tsx    — Client component for Steam link/unlink UI
```

The settings page (Server Component) fetches the user's Steam data and linked player count, then passes it as props to the Steam card (Client Component for the unlink button interactivity).

**Next.js best-practice**: Server and Client Components — https://nextjs.org/docs/app/getting-started/server-and-client-components — "Use Client Components when you need state and event handlers (e.g., onClick)."

**Risk/complexity**: Low — fits the existing settings page pattern.

---

### F-009: Unlinking Flow

**Summary**: Users should be able to unlink their Steam account. This is a simple Server Action or API call that:

1. Sets `user.steamId`, `user.steamName`, `user.steamAvatar` to `null`
2. Sets `player.userId` to `null` for all players previously linked to this user

**Proposed implementation**: A Server Action in the accounts feature:

```typescript
"use server"
export async function unlinkSteamAccount() {
  const session = await requireAuth()
  await db.$transaction([
    db.user.update({
      where: { id: session.user.id },
      data: { steamId: null, steamName: null, steamAvatar: null },
    }),
    db.player.updateMany({
      where: { userId: session.user.id },
      data: { userId: null },
    }),
  ])
}
```

**Risk/complexity**: Low — clean transactional operation.

---

### F-010: Google OAuth Removal (Orthogonal)

**Summary**: Removing Google OAuth is independent of this Steam linking feature. It can proceed as described in the original review (F-007 of `review-20260214-1800`). The Steam linking feature works whether Google is present or not.

**Risk/complexity**: Low — separate concern.

---

### F-011: Comparison with Better Auth Plugin Approaches

**Summary**: Side-by-side comparison of the three approaches reviewed.

| Aspect                         | BA PR #4877 Plugin     | BA Custom Plugin Copy  | Steam Link-Only (this)  |
| ------------------------------ | ---------------------- | ---------------------- | ----------------------- |
| **Better Auth changes**        | None (official)        | Copy-paste plugin      | **None**                |
| **Login with Steam**           | Yes                    | Yes                    | **No**                  |
| **External dependencies**      | None (BA internal)     | None (BA internal)     | **None**                |
| **Route handlers**             | 0 (plugin handles)     | 0 (plugin handles)     | **2 (simple)**          |
| **Session creation**           | Plugin handles         | Plugin handles         | **Not needed**          |
| **BA internal API risk**       | Official (stable)      | High (may break)       | **None**                |
| **Email collection UX**        | Required (complex)     | Required (complex)     | **Not needed**          |
| **Account linking**            | Plugin handles         | Plugin handles         | **Custom (simple)**     |
| **Player reconciliation**      | Needs custom code      | Needs custom code      | **Built into flow**     |
| **Schema changes**             | Medium (Account table) | Medium (Account table) | **Simple (3 fields)**   |
| **Complexity**                 | Medium                 | High                   | **Low**                 |
| **Can add Steam login later?** | N/A (already has it)   | N/A (already has it)   | **Yes** (P #4877 merge) |

**Recommendation**: The Steam Link-Only approach is the **lowest-risk, lowest-effort** path to achieving the core goal: reconciling website users with in-game player stats. Steam login can be added later when PR #4877 officially ships.

---

## Phased To-Do Plan

### P0: Foundation

- [ ] **P0-1**: Add Steam-related fields to User model
  - `steamId String? @unique @map("steam_id") @db.VarChar(20)`
  - `steamName String? @map("steam_name") @db.VarChar(64)`
  - `steamAvatar String? @map("steam_avatar") @db.Text`
  - Run Prisma migration
  - _Ref: F-003_

- [ ] **P0-2**: Add `userId` FK to Player model
  - `userId String? @map("user_id")`
  - `userData User? @relation(fields: [userId], references: [id], onDelete: SetNull)`
  - Add `players Player[]` to User model
  - Run Prisma migration
  - _Ref: F-004_

- [ ] **P0-3**: Create SteamID conversion utilities
  - Create `apps/web/src/lib/steam-id.ts`
  - Functions: `steamId64ToSteam2()`, `steamId2ToSteamId64()`, validators
  - Handle both `STEAM_0:Y:Z` and `STEAM_1:Y:Z` variants
  - _Ref: F-005_

- [ ] **P0-4**: Add `STEAM_API_KEY` environment variable
  - Add to `.env.example`
  - Validate in route handler (return error if missing)
  - _Ref: F-006_
  - _Next.js docs: https://nextjs.org/docs/app/guides/environment-variables_

### P1: Steam OpenID Route Handlers

- [ ] **P1-1**: Create `/api/steam/link/route.ts` — initiate Steam link
  - Verify user session via `requireAuth()`
  - Build OpenID redirect URL with signed state parameter
  - Redirect to `steamcommunity.com/openid/login`
  - _Ref: F-002, F-007_
  - _Next.js docs: https://nextjs.org/docs/app/api-reference/file-conventions/route_

- [ ] **P1-2**: Create `/api/steam/callback/route.ts` — handle Steam return
  - Validate OpenID response (POST back to Steam with `check_authentication`)
  - Verify state parameter (CSRF protection)
  - Extract SteamID64 from `openid.claimed_id`
  - Fetch Steam profile from Web API
  - Check SteamID not already linked to another user
  - Update User record with `steamId`, `steamName`, `steamAvatar`
  - Auto-link players via SteamID conversion + PlayerUniqueId lookup
  - Redirect to `/accounts/settings?steam=linked`
  - _Ref: F-002, F-004, F-005, F-006, F-007_
  - _Next.js docs: https://nextjs.org/docs/app/api-reference/file-conventions/route_
  - _Next.js docs: https://nextjs.org/docs/app/guides/authentication_

- [ ] **P1-3**: Typecheck
  - Run `pnpm --filter web run check-types`
  - _Ref: F-002_

### P2: UI — Account Settings

- [ ] **P2-1**: Create `steam-link-card.tsx` component
  - Show link/unlink state with Steam avatar and name
  - "Link Steam Account" button → navigates to `/api/steam/link`
  - "Unlink" button → calls server action
  - Display count of auto-linked players
  - _Ref: F-008_
  - _Next.js docs: https://nextjs.org/docs/app/getting-started/server-and-client-components_

- [ ] **P2-2**: Update account settings page
  - Fetch user Steam data + linked player count (server-side)
  - Add Steam card below existing profile/password cards
  - Handle `?steam=linked` query param for success toast
  - _Ref: F-008_

- [ ] **P2-3**: Create `unlinkSteamAccount` server action
  - Clear `steamId`, `steamName`, `steamAvatar` on user
  - Clear `userId` on all linked players
  - Wrap in transaction
  - _Ref: F-009_

### P3: Polish & Edge Cases

- [ ] **P3-1**: Handle "SteamID already linked to another user"
  - In callback, check `db.user.findUnique({ where: { steamId } })`
  - If found and not the current user, redirect with error
  - _Ref: F-007_

- [ ] **P3-2**: Handle "Player already linked to another user"
  - When auto-linking, skip players where `userId` is already set to a different user
  - Log a warning for admin review
  - _Ref: F-004_

- [ ] **P3-3**: Display linked players in account settings
  - Show a list of auto-linked player names and games
  - Link to public player stat pages
  - _Ref: F-004, F-008_

- [ ] **P3-4**: Admin UI — show Steam link on user detail page
  - Display SteamID, avatar, linked player count in admin user management
  - Allow admin to unlink Steam manually
  - _Ref: F-008_

- [ ] **P3-5**: Re-link / refresh Steam profile data
  - Allow users to re-link to refresh their Steam name/avatar
  - Re-run player auto-linking on re-link
  - _Ref: F-006_

- [ ] **P3-6**: Remove Google OAuth (optional, orthogonal)
  - Can be done independently per original review
  - _Ref: F-010_

---

## Open Questions / Follow-ups

1. **State parameter signing**: For CSRF protection in the callback, we need a signing secret. Options:
   - Use `BETTER_AUTH_SECRET` (if exposed) or `process.env.AUTH_SECRET`
   - Use a dedicated `STEAM_LINK_SECRET` env var
   - Use HMAC-SHA256 with the user's session token
     Decision needed before P1-1.

2. **Re-linking behavior**: If a user unlinks and re-links, should previously linked players be automatically re-linked? Current proposal: yes (the auto-link logic runs on every successful link).

3. **Public player pages**: Should public player pages (`/players/[id]`) show the linked website user's name/avatar? This is a UX decision — it could be a privacy concern for some users.

4. **Future Steam login**: If/when Better Auth PR #4877 officially ships, we can add Steam as a login provider in addition to the linking feature. The `steamId` field on User would serve as the bridge — the Better Auth Account record would reference the same SteamID64. No conflict.

5. **Daemon integration**: The daemon currently creates Player + PlayerUniqueId records as players connect. Should the daemon also auto-link new players to existing Users with matching SteamIDs? This would handle the case where a user links their Steam before playing on a server. Low priority — can be a follow-up.
