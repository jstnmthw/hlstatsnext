# Objective Events Rewrite Plan (HLStatsNext Daemon)

This plan removes hardcoded objective mappings and aligns the daemon with legacy HLstatsX by using canonical action codes from the logs/DB. We will track work here with checkboxes and keep this file up-to-date as we execute.

## Why

- Legacy persists objective triggers using canonical action codes from logs (e.g., `Planted_The_Bomb`, `Defused_The_Bomb`, `Target_Bombed`, `CTs_Win`).
- Our code introduced semantic enums (e.g., `BOMB_PLANT`) and a hardcoded mapping (`mapObjectiveToAction`) which drifts from the database and multiplies code paths.
- Fix: emit and persist ACTION events directly using the canonical DB codes; compute match/objective scoring based on those codes. Keep structural events like `ROUND_START`, `ROUND_END`, `TEAM_WIN`, `MAP_CHANGE` for lifecycle.

## Goals

- Eliminate objective enums and hardcoded mappings.
- Parsers emit `ACTION_*` with canonical `actionCode` strings from logs.
- Repository resolves actions from DB (with alias fallback for variants like CS:GO SFUI notices).
- Match scoring derives from `ACTION_*`, not invented enums.

---

## Work Items

### 1) Remove objective enums from `events.ts`

- [x] Delete the following from `apps/daemon/src/shared/types/events.ts`:
  - `BOMB_PLANT`, `BOMB_DEFUSE`, `BOMB_EXPLODE`
  - `HOSTAGE_RESCUE`, `HOSTAGE_TOUCH`
  - `FLAG_CAPTURE`, `FLAG_DEFEND`, `FLAG_PICKUP`, `FLAG_DROP`
  - `CONTROL_POINT_CAPTURE`, `CONTROL_POINT_DEFEND`
- [x] Update imports/usages across daemon to compile without these enums.

Impacted references:

- [x] `apps/daemon/src/context.ts`: remove objective enums from `match` handler `handledEvents`.
- [x] Tests referencing the removed enums.

### 2) Parsers emit ACTION\_\* using canonical DB codes

- [x] Ensure `apps/daemon/src/modules/ingress/parsers/cs.parser.ts`:
  - Player-trigger lines (e.g., `"X" triggered "Planted_The_Bomb"`) → emit `ACTION_PLAYER` with `actionCode` set to the trigger string.
  - Team-trigger lines that are not wins (e.g., `Team "TERRORIST" triggered "Target_Bombed"`) → emit `ACTION_TEAM` with `actionCode`.
  - Team wins remain `TEAM_WIN` (match lifecycle path remains authoritative for wins/scores).
- [x] Keep `ROUND_START`, `ROUND_END`, `MAP_CHANGE` as separate events.
- [x] Update/extend tests in `cs.parser.test.ts` to assert emission of `ACTION_*` with exact codes found in logs.

### 3) DB-first resolution and alias support

- [x] Extend `ActionRepository.findActionByCode(game, code, team?)` to support alias fallback:
  - First try canonical `code`.
  - If not found, lookup an alias mapping (DB-driven) and resolve to canonical code.
- [x] Seed common variants (csgo/cs2 in-code alias handling for `SFUI_Notice_*`).
- [x] Add unit tests for alias resolution.

### 4) Match objective scoring from action codes

- [x] Remove objective-event-specific handling in `MatchService` (`handleObjectiveEvent`, points map keyed by enums).
- [x] Add a small `objectivePointsByActionCode: Record<string, number>` (or inject a config service) keyed by canonical codes:
  - Examples: `Planted_The_Bomb`, `Defused_The_Bomb`, `All_Hostages_Rescued`, TF/DoD flag/control codes.
- [x] Add `matchService.handleObjectiveAction(actionCode: string, actorPlayerId?: number, team?: string)`:
  - Updates per-player `objectiveScore` when `actorPlayerId` exists.
  - Updates per-map/team counters when appropriate (e.g., `Target_Bombed`).
- [x] In `ActionEventHandler`, call into `matchService.handleObjectiveAction` for `ACTION_PLAYER` / `ACTION_TEAM` after persistence.
- [ ] Keep `TEAM_WIN`/`ROUND_*` responsibility in `MatchService` for lifecycle and server counters.

### 5) Remove hardcoded mapping in `ActionService`

- [x] Delete `mapObjectiveToAction` from `apps/daemon/src/modules/action/action.service.ts` and its usage.
- [x] Ensure persistence uses the `actionCode` that arrives from parsers.

### 6) Update tests

- [x] Parser tests: assert canonical `actionCode` emission for objective triggers (cstrike/css/csgo/cs2).
- [x] Match tests: assert scoring via `handleObjectiveAction` for canonical codes.
- [x] Action service tests: assert no code mapping; repository is called with provided `actionCode`.
- [x] Alias tests: alias resolves to canonical action and persists.

### 7) Documentation & lifecycle

- [x] Update `apps/daemon/docs/EVENT_LIFECYCLE.md` to show objective flow:
  - Ingress → Parser → `ACTION_*` (canonical code) → Persistence → Match scoring via action code.
- [x] Update `apps/daemon/docs/MIGRATION.md` to record the rewrite and rationale (DB-first, no semantic enums for objectives).

### 8) Multi-game readiness

- [ ] Confirm log-to-action flow for other HL engines (tfc, dod, dods, tf2, hl2ctf, etc.).
- [ ] Add parser stubs/variants that forward triggers as `ACTION_*` (no mapping).
- [ ] Populate aliases as needed for per-game differences.

### 9) Acceptance

- [x] `pnpm lint`
- [x] `pnpm check-types`
- [x] `pnpm test`
- [ ] Manual validation against real cstrike logs:
  - `Planted_The_Bomb` (ACTION_PLAYER)
  - `Defused_The_Bomb` (ACTION_PLAYER)
  - `Target_Bombed` (ACTION_TEAM)
  - `CTs_Win` (TEAM_WIN)

---

## Notes

- The database remains the single source of truth for action semantics and rewards. Parsers forward trigger strings; services persist and compute with DB-driven data.
- Alias resolution prevents code drift and allows per-game variations without hardcoding.
- Structural events (rounds/team wins/map change) remain separate for lifecycle and server counters.

## References

- `packages/db/src/seeders/default/Actions.sql`
- `apps/daemon/src/modules/ingress/parsers/cs.parser.ts`
- `apps/daemon/src/modules/action/action.service.ts`
- `apps/daemon/src/modules/match/match.service.ts`
- `apps/daemon/src/shared/types/events.ts`
- `apps/daemon/docs/HLSTATSX_MODELS.md`
- `apps/daemon/docs/EVENT_LIFECYCLE.md`
