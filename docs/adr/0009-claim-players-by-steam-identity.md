# 0009. Claim players by Steam identity into a `user_players` table

- Status: Accepted
- Date: 2026-10-17

## Context

A player row is created by the daemon from game logs, keyed in `player_unique_ids` by SteamID64 and game; one person has one player per game they have played. The live table confirms every non-bot row is a 17-digit SteamID64. People want to see their own players, set the existing `hideRanking`, `displayEvents` and `blockAvatar` preferences, and eventually more. Nothing links a `User` to a `Player`. The `Player` table is written by the daemon and read by the public leaderboard, so changes to it are costly.

## Decision

A claim is proven only by a Steam sign-in or link ([0008](0008-steam-sign-in-through-better-auth-steam.md)); nobody claims by typing an ID. Claims live in a new `user_players` table: `userId`, `playerId`, `game`, `claimedAt`, unique on `playerId`, indexed by `userId`. A claim routine in `packages/auth` looks up `player_unique_ids` by the user's SteamID64 and upserts a row per match; it runs after a Steam account is created or linked, and again when the person opens their players page, so new games are picked up. The model is exposed only through custom resolvers: `myPlayers` behind `requireAuth`, and `updateMyPlayer` behind `requireAuth` plus an ownership check, with a new `player: ["update-own"]` right on the `user` role.

## Options considered

- **Join table, Steam proof, lazy re-claim.** The daemon's table is untouched, a person keeps one row per game, and the proof is the OpenID assertion.
- **A nullable `userId` column on `Player`.** Rejected. Touches the daemon-owned table, forces the API's custom `Player` object to hide the column, and leaves no room for `claimedAt` or a later source.
- **A claim form that takes a Steam ID.** Rejected. Anyone could claim anyone.
- **Matching `Player.email`.** Rejected ([0007](0007-steam-email-password-and-google-sign-in.md)).

## Consequences

- `UserPlayer` joins the exclusion lists in `apps/api/src/pothos-schema.ts`; no auto-generated queries or mutations for it.
- `updateMyPlayer` is the first non-admin write in the API, so its ownership check is a resolver-level guard, not a role check.
- Anonymizing or deleting a user removes their claims; the rows cascade with the user.
- A legacy import in `STEAM_0:X:Y` form would be normalized with the daemon's existing conversion before matching; the live data needs none.
- Later rights (merging players, clan management) extend the same table and statement rather than adding columns to `Player`.
