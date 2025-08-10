### Legacy HLstatsX data flow mapped to Prisma models

This document maps how legacy HLstatsX (Perl) populated and updated each table corresponding to our Prisma models in `packages/database/prisma/schema.prisma`. It focuses on where data comes from (logs, cron jobs, maintenance scripts), when inserts/updates occur, and notable constraints/derivations. Legacy table names are shown with the `hlstats_` prefix used by HLstatsX.

Notes

- “Daemon” refers to `legacy/hlstats.pl` together with `HLstats_*.pm` and `HLstats_*.plib` files handling real-time log processing.
- “Awards script” refers to `legacy/hlstats-awards.pl` which runs periodically (cron) for maintenance, history snapshots, awards and ribbons.
- Hostname/group resolution is performed by `legacy/hlstats-resolve.pl`.

---

#### GeoIP tables

- `GeoLiteCityBlock` ↔ `hlstats_GeoLiteCity_Blocks`
- `GeoLiteCityLocation` ↔ `hlstats_GeoLiteCity_Location`
  - Populated by maintenance (GeoIP import). Used to enrich connect IPs with city/country info.

---

#### Core: `Game` ↔ `hlstats_Games`

- Seeded/maintained outside the daemon (install SQL and admin UI). Used to filter visible games and determine defaults. `hidden` used to exclude from public rankings.

#### `Country` ↔ (static flags)

- Country/flag metadata used to render player flags. Legacy primarily stores `Players.flag` and looks up friendly names in static data.

#### `Clan`, `ClanTag`, `ClanTagPosition`

- Clan assignment is computed by awards/maintenance (see DoClans in `hlstats-awards.pl`).
  - Players’ names are scanned for tag patterns; if matched, players are linked to (or create) a clan and `Players.clan` is set.
  - Clan tags/patterns live in `hlstats_ClanTags`; position rules START/END/EITHER.

#### `Player` ↔ `hlstats_Players`

- Inserts
  - On first seen unique ID (SteamID) without an existing player, daemon creates `Players` row and `PlayerUniqueIds` row.
  - See player creation in `HLstats_Player.pm` (insert statements at ~L381, ~L409).
- Updates (examples)
  - Kills/deaths/suicides/teamkills/headshots incremented in real-time on events (see `HLstats_EventHandlers.plib`).
  - `skill` adjusted on kills/teamkills/suicides, bounded by configuration.
  - `last_event` (UNIX timestamp) refreshed on every handled event and during imports.
  - `hideranking` set to 2 for bans (from admin events or external ban imports: `ImportBans/*`).
  - Connection time accumulated during session handling and written to history daily.
  - Geo fields (`city`, `country`, `flag`, `lat`, `lng`) updated from GeoIP after connect resolution.
- Indices/constraints
  - Multiple indices used for leaderboards and queries: `skill`, `kills`, game-scoped filters, etc.

#### `PlayerUniqueId` ↔ `hlstats_PlayerUniqueIds`

- Inserts/Upserts
  - When a new SteamID is encountered, an entry is created mapping `(uniqueId, game) → playerId`.
  - Used to resolve returning players quickly (lookups in `hlstats.pl`, `HLstats_Player.pm`).
- Supports merge semantics via optional `merge` field in legacy.

#### `PlayerName` ↔ `hlstats_PlayerNames`

- Inserts
  - On player name change events, daemon inserts/updates name usage with counts, last use timestamp, and per-name accumulated stats.
- Purpose
  - Historical record of aliases and per-alias performance.

#### `PlayerHistory` ↔ `hlstats_Players_History`

- Inserts/Updates
  - Periodic snapshots by awards/maintenance scripts (`hlstats-awards.pl`) and some session rollups within `HLstats_Player.pm`.
  - Captures per-day aggregates: kills, deaths, suicides, skill, shots, hits, headshots, teamkills, streaks, connection time, etc.
- Used for daily/weekly awards and activity decay calculations.

#### `PlayerAward` ↔ `hlstats_Players_Awards`

- Inserts
  - Computed by awards script; when winners are selected per code/game/period, inserts `(awardTime, awardId, playerId, count, game)`.
- Inputs
  - Queries against `Events_Frags`, `Events_PlayerActions`, `Events_PlayerPlayerActions`, history tables, etc.

#### `PlayerRibbon` ↔ `hlstats_Players_Ribbons`

- Inserts
  - Computed by awards script based on cumulative awards meeting a ribbon’s criteria.
  - Script truncates and rebuilds ribbons per game on each run (`DoRibbons`).

#### `Award` ↔ `hlstats_Awards`

- Maintained by admin and used by awards script.
  - Awards script increments `hlstats_Awards.count` as it processes, and writes winners (`d_winner_id`, `g_winner_id`, etc.).

#### `Rank` ↔ `hlstats_Ranks`

- Static rank bands by kills per game; used by web layer and OSD messages.

#### `Role` ↔ `hlstats_Roles`

- Optional (game-dependent); incremented for pick counts and kill/death stats per role.

#### `Weapon` ↔ `hlstats_Weapons`

- Updates
  - Real-time increments for kills/headshots; legacy also had optional `Events_Statsme` for shots/hits/acc.
  - Modifiers are configured per weapon and used in skill calculations (legacy weighting).

#### Event tables (real-time inserts)

- `EventFrag` ↔ `hlstats_Events_Frags`
  - Inserted on player kill events (`recordEvent("Frags", ...)` in `HLstats.plib`). Stores killer/victim IDs, weapon, headshot, roles, and optional positions.
  - Drives `Maps_Counts` upserts and per-weapon tallies.
- `EventSuicide` ↔ `hlstats_Events_Suicides`
  - Inserted on suicides; applies suicide penalty, updates player/server counters.
- `EventTeamkill` ↔ `hlstats_Events_Teamkills`
  - Inserted on TK; penalty applied; team counts updated.
- `EventPlayerAction` ↔ `hlstats_Events_PlayerActions`
  - Generic per-player action occurrences; `hlstats_Actions.count` incremented.
- `EventPlayerPlayerAction` ↔ `hlstats_Events_PlayerPlayerActions`
  - Actor→victim actions; counts aggregated for awards/ribbons.
- `EventTeamBonus` ↔ `hlstats_Events_TeamBonuses`
  - Team objectives producing team-wide bonuses.
- `EventWorldAction` ↔ `hlstats_EventWorldAction`
  - World-triggered objectives; `hlstats_Actions.count` incremented.
- `EventChat` ↔ `hlstats_Events_Chat`
  - On chat messages, daemon inserts message text, mode (team/all/dead), playerId, serverId, timestamp; table is full-text indexed on `message`.
- `EventLatency` ↔ `hlstats_Events_Latency`
  - Periodic pings; used by awards for “low ping” or “high ping” stats.
- `EventAdmin` ↔ `hlstats_Events_Admin`
  - Admin actions logged for audit/awards.
- Change events
  - `EventChangeName`, `EventChangeTeam`, `EventChangeRole` mirror in-game changes; used to update current `Players` fields and write history rows.
- Connect lifecycle
  - `EventConnect` ↔ `hlstats_Events_Connects`: inserted on connect with `ipAddress`, `hostname` (possibly empty at first), and later enriched by `hlstats-resolve.pl` (sets `hostgroup`, resolves `hostname`).
  - `EventDisconnect` ↔ `hlstats_Events_Disconnects`.
  - `EventEntry` ↔ `hlstats_Events_Entries` (first spawn/entry markers; used for session/round participation reporting).

#### Server and configuration tables

- `Server` ↔ `hlstats_Servers`
  - Creation
    - If a server connects that’s not in DB and auto-create is enabled, daemon inserts (`hlstats.pl:addServer`) and seeds `Servers_Config` from `Mods_Defaults` and `Games_Defaults`.
  - Updates
    - Periodic flush of running counters: `kills`, `players`, `rounds`, `suicides`, `headshots`, `ctWins`, `tsWins`, map stats and per-team shots/hits; timestamps and `act_map` maintained in `HLstats_Server.pm`.
  - Location fields (`city`, `country`, `lat`, `lng`) set from GeoIP.
- `ServerConfig` ↔ `hlstats_Servers_Config`
  - Server-scoped feature toggles (e.g., broadcasting events), game engine, mod settings; seeded on server add.
- `ServerConfigDefault` ↔ `hlstats_Servers_Config_Default`
  - Default config catalog referenced by UI/seeders.
- `ServerLoad` ↔ `hlstats_server_load`
  - Periodic “stats output” snapshot: active players, map, uptime, fps; inserted via `HLstats_Server::track_server_load`.

#### Game/Mod catalogs and options

- `GameDefault` ↔ `hlstats_Games_Defaults`, `GameSupported` ↔ `hlstats_Games_Supported`
- `ModDefault` ↔ `hlstats_Mods_Defaults`, `ModSupported` ↔ `hlstats_Mods_Supported`
  - Used to seed per-server `Servers_Config` on creation.
- `Option` / `OptionChoice` ↔ `hlstats_Options` / `hlstats_Options_Choices`
  - Global settings and their choices. Awards/maintenance store working state here (e.g., last award run timestamp) and read configuration.

#### Map stats

- `MapCount` ↔ `hlstats_Maps_Counts`
  - Upserted on each frag to maintain `(game, map) → kills/headshots` aggregates (`HLstats_EventHandlers.plib` performs an INSERT … ON DUPLICATE KEY UPDATE).

#### Team

- `Team` ↔ `hlstats_Teams`
  - Catalog of team codes/names and style for UI; used by parsers and stats rollups.

#### Users

- `User` ↔ `hlstats_Users`
  - Web/admin users; may be linked to a `playerId` for “claim” features.

---

### Cross-cutting behaviors

- Skill calculation
  - Kill-based Elo-style adjustments with weapon modifiers and headshot bonuses; suicide/teamkill penalties. Implemented inline in player handling in legacy.
- Activity
  - Periodic decay computation sets `Players.activity` to [-1, 100] based on `last_event` vs. `g_minactivity` (see `hlstats-awards.pl` DoInactive).
- Bans
  - `hideranking=2` hides banned players; set by admin events or external ban import scripts.
- Name/role/team change propagation
  - Change events both record the raw event and update current `Players` record.

---

### File references (examples)

- Player create/lookup and history
  - `legacy/HLstats_Player.pm`: inserts into `hlstats_Players`, `hlstats_PlayerUniqueIds`, and `hlstats_Players_History`.
- Event handling and counters
  - `legacy/HLstats_EventHandlers.plib`: records frags, player actions, team/world actions, map counts, and applies per-event stat changes.
- Server tracking
  - `legacy/HLstats_Server.pm`: RCON/query, map detection, server counters, server_load inserts, and geo updates.
- Maintenance
  - `legacy/hlstats-awards.pl`: daily snapshots, awards/ribbons, activity updates, pruning, latency awards.
- Resolution
  - `legacy/hlstats-resolve.pl`: resolves `Events_Connects.hostname` and sets `hostgroup`.
