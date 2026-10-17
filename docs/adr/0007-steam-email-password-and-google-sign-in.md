# 0007. Steam, email and password, and Google as sign-in methods

- Status: Accepted
- Date: 2026-10-17

## Context

Every player in the database is identified by a Steam ID, written by the daemon as a SteamID64 per game. The site's main reason to sign in is to claim and manage one's own players ([0009](0009-claim-players-by-steam-identity.md)), which only a proof of Steam identity can grant. Today the web app offers email and password with OTP verification, and Google when configured. Steam provides no email address and speaks OpenID 2.0, not OAuth.

## Decision

Offer three ways in: Steam as the first button, email and password with the existing OTP verification, and Google when configured. Account linking stays explicit and session-bound: a signed-in person links Steam or Google from Settings; sign-in never links by email except for trusted providers with a verified address. `allowDifferentEmails` is on so a Steam account, which has no email, can be linked.

## Options considered

- **Steam plus email and password plus Google.** Steam for the claim, email for recovery and for admins without Steam, Google because it is already built.
- **Steam only.** Rejected. No recovery path, no way in for someone without Steam, and the first admin would need a Steam-only bootstrap.
- **Magic link instead of passwords.** Deferred. The password flow is built, verified and rate-limited; a magic link would add a mail round trip to every sign-in. It can be added beside the others without removing anything.
- **Email matching to claim players.** Rejected. The `Player.email` column is legacy, unverified and mostly empty; it proves nothing.

## Consequences

- A Steam-only user has a synthetic, unverified email. The `(auth)` layout redirects on session presence, not on `emailVerified`; the password form and the forgot-password link are hidden for users with no credential account; Settings offers to add a real email through Better Auth's change-email flow with verification, which is enabled for that purpose.
- Settings gains a connected-accounts section: Steam, Google, password.
- With email and password on, email verification must stay required before any linking, or a password account registered with someone else's address could capture that person's later Google sign-in.
- `ADMIN_EMAILS` ([0003](0003-roles-through-the-admin-plugin-with-one-access-statement.md)) bootstraps an admin only through email or Google; a Steam-only person is promoted by an existing admin.
