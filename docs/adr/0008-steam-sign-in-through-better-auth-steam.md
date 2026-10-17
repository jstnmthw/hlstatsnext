# 0008. Steam sign-in through the better-auth-steam plugin on Better Auth 1.7

- Status: Accepted
- Date: 2026-10-17

## Context

Better Auth has no Steam provider. Its generic OAuth plugin handles OAuth 2.0 and OpenID Connect; Steam uses OpenID 2.0. A core provider is proposed in better-auth pull request 11510, open since 2026-10-01 with no maintainer response. The community package `better-auth-steam` (0.2.3) implements the flow as a plugin: `steamOpenID({ apiKey })` on the server, `steamOpenIDClient` in the browser, endpoints for login, link and callback, a `steam` account row with the SteamID64 as account id, and a nullable unique `steamId` on `user`. It needs Better Auth 1.6.21 or later; this repository is on 1.6.18, with `kysely` pinned to 0.28.17 because Better Auth's adapter broke on 0.29.

## Decision

Upgrade Better Auth to 1.7.10 in its own change, then add `better-auth-steam` pinned to an exact version. Before merging, read the plugin's callback: it must round-trip the assertion to Steam's `check_authentication`, match `return_to` exactly, and take the Steam ID from the verified `claimed_id`. `STEAM_API_KEY` is used only for the display name and avatar.

## Options considered

- **Depend on the package, on 1.7.10.** Smallest footprint. 1.7 is the current line, so its behavior is what the documentation describes. Pinning plus a read of the verification code bounds the risk of a small fork.
- **Vendor the plugin into `packages/auth`.** Deferred. The fallback if the review fails or the package stops tracking Better Auth.
- **Wait for the core provider.** Rejected. No date.
- **Upgrade only to 1.6.33.** Rejected. A maintenance line, and a second upgrade would follow within months.
- **An OpenID-to-OIDC proxy in front of Steam.** Rejected. One more deployable for one provider.

## Consequences

- The upgrade is verified against the `kysely` pin, the Prisma adapter and the e2e sign-in paths before the plugin lands.
- `pnpm db:generate`, `pnpm codegen` and `pnpm check-types` run after the `steamId` column; the custom `User` object in the API exposes `steamId` to admins.
- `/steam/login` joins the sign-in rate-limit rules.
- If a sessions list is exposed later, `freshAge` is set to `0` ([0002](0002-database-sessions-with-a-cookie-cache.md)).
- The `account` table may hold a `steam` row with no tokens; nothing reads `accessToken` for it.
