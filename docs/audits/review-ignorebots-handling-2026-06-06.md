# Review: IgnoreBots handling — current state, prior art, and design recommendation

**Date:** 2026-06-06
**Scope:** Bot detection + `IgnoreBots` enforcement across the daemon event pipeline (`apps/daemon/src/modules/{player,server,ingress}`), the data model (`packages/db/prisma/schema.prisma`), and leaderboard exposure (`apps/web`). Includes a comparison against HLstatsX:CE behavior and a recommended design.
**Reviewer:** /review skill

## Summary

`IgnoreBots` today is a **per-server boolean** that only gates **lifecycle/presence** events (CONNECT, DISCONNECT, ENTRY) and operational visibility (session sync, status enrichers). It does **not** gate the scoring path. Kills, damage, and teamkills involving bots are processed unconditionally: bots get real `Player` rows via `getOrCreatePlayer`, bot frags update kills/deaths, and **a human killing a bot still gains/loses skill** — so a player can farm rank against bots even with `IgnoreBots=on`. This diverges from HLstatsX:CE, which discarded the _entire frag_ when either participant was a bot. The schema has **no `isBot` flag, no per-kill skill delta, and no weighting field**, so reduced-XP-for-bots is not supportable today without a migration. The leaderboard (`findManyPlayer`) applies **no bot filter** at any layer.

**Findings:** 1 critical, 3 warning, 4 suggestion

---

## Answers to the specific questions asked

**Q: When `IgnoreBots` is true, do we track players who kill bots?**
Yes — incorrectly. The kill path ignores `IgnoreBots` entirely. The human killer gets a kill, a skill change, an `EventFrag` row, and the bot itself is created as a `Player`. Only the bot's _connect/disconnect_ events are suppressed. See `apps/daemon/src/modules/player/events/player.events.ts:46-63` (lifecycle-only gate) and `apps/daemon/src/modules/player/handlers/kill-event.handler.ts:43-129` (no bot/IgnoreBots check anywhere).

**Q: What did HLstatsX do?**
`IgnoreBots` was **per-server** (per-game default `1`; L4D defaulted to `0`). When on, the frag handler set `$desc = "(IGNORED) BOT: "` whenever `killer->is_bot OR victim->is_bot` and **skipped the entire scoring block** — no kill, no death, no skill change for _either_ side, including the human. It was strictly all-or-nothing per event, never "credit the human but skip the bot." (`HLstats_EventHandlers.plib` ~L990-995; bot detection via `botidcheck` in `hlstats.pl` ~L1405-1414; option default in `install.sql`.)

**Q: Does our DB support reducing how much XP bot kills give vs real players?**
No. `Player.skill` is the only rating field, skill deltas are computed in-memory and applied to aggregates (never persisted per kill), and `EventFrag` stores no skill delta. There is no weighting multiplier and no `isBot` marker. HLstatsX didn't do weighted bot XP either — it was purely on/off.

**Q: Did HLstatsX have a "track but don't score / hide on frontend" mode?**
No. The single `IgnoreBots` switch collapsed persistence + scoring + display together. It also paired with `MinPlayers` (default 4) — frags were discarded when the count of _trackable_ (human) players was below the threshold, which is how bot-heavy servers were prevented from inflating ranks. **That anti-boosting threshold does not exist in our event pipeline** (the `minPlayers` field on `Server` is a live-occupancy stat written from RCON status — `apps/daemon/src/modules/rcon/repositories/rcon.repository.ts:81` — not a scoring gate).

---

## Phase 1 — Critical (correctness / stat integrity)

- [x] **`apps/daemon/src/modules/player/events/player.events.ts` + `apps/daemon/src/modules/weapon/weapon.events.ts`** — `IgnoreBots` is not enforced on the scoring path, so bots are persisted and bot frags mutate human skill even when `IgnoreBots=on`. **FIXED 2026-06-06.**
      **Why:** Players farm rank against bots; bot `Player` rows pollute the DB and (unfiltered) leaderboards. This is the exact case HLstatsX deliberately discarded. The lifecycle-only gate gave a false impression that "bots are ignored" while the rating system was still being corrupted.
      **Fix applied:** Added a shared `eventInvolvesBot()` helper (`apps/daemon/src/shared/utils/bot-event.util.ts`) and gated on it in both consumers of scoring events — `PlayerEventHandler.handleEvent` (covers `PLAYER_KILL`/`PLAYER_DAMAGE`/`PLAYER_TEAMKILL` + the existing presence events) and `WeaponEventHandler.handlePlayerKill` (the weapon module is the _second_ consumer of `PLAYER_KILL` via the registry fan-out, so gating only the player module would have left weapon stats counting bot kills). When `IgnoreBots` is true and either participant is a bot, the whole event is discarded before `getOrCreatePlayer`/skill calc/`EventFrag`/weapon-stat recording. `ServerService.getServerConfigBoolean` now caches reads (30s TTL) so the per-frag lookup doesn't hit the DB. Coordinators were verified harmless (the only one is chat-only). Unit tests added for human-kills-bot, bot damage/teamkill, and the all-human pass-through.

---

## Phase 2 — Warning (inconsistency / latent risk)

- [ ] **Inconsistent `IgnoreBots` defaults across call sites** — most readers default to `true` (`connect-event.handler.ts`, `player.events.ts:57`, `player-status-enricher.ts`) but `server-status-enricher.ts` defaults to `false`.
      **Fix:** Centralize the default in one place (e.g. a `ServerConfigDefault` row + a single typed accessor) so player-count enrichment and scoring can't disagree about whether bots count.

- [ ] **No `MinPlayers` anti-boosting gate in the pipeline** — HLstatsX discarded frags below a trackable-player threshold; we have no equivalent, so even human-vs-human kills on a near-empty (or bot-stuffed) server inflate ranks.
      **Fix:** Consider a `MinPlayers` server config checked at the top of the frag/action handlers, counting trackable (non-bot, when `IgnoreBots=on`) players. Complementary to the Phase 1 fix, not a replacement.

- [x] **Bots are created as first-class `Player` rows with synthetic IDs** (`simple-player-resolver.service.ts` → `BOT_<serverId>_<name>`) regardless of `IgnoreBots`. Once Phase 1 lands these rows stop being created while `IgnoreBots=on`. **FIXED 2026-06-06** (durable `isBot` marker).
      **Fix applied:** Added the `isBot` column (Phase 3) so bots are a queryable fact rather than a `BOT_`-prefix string match. New rows are flagged at creation. No backfill of pre-existing rows — this is a dev DB that gets reset, so a `db:push --force-reset` + reseed clears stale bot rows.

---

## Phase 3 — Suggestion (design for the "track-but-hide" direction)

These are the choices behind questions **A** and **B**. The key framing: **persistence, scoring, and display are three separate concerns** that HLstatsX fused into one switch. Hiding bots on the frontend does **not** fix skill-farming — if a bot kill changes a human's `skill`, the human's rank is already wrong whether or not the bot is visible. So decide scoring first, display second.

- [x] **Add `isBot Boolean @default(false)` to `Player`** (and set it on creation). **FIXED 2026-06-06.**
      **Fix applied:** Added `isBot Boolean @default(false) @map("is_bot")` to `Player` plus a `@@index([isBot, skill])` for the humans-only leaderboard. Both creation paths (`PlayerService` and `SimplePlayerResolverService`) already derive `isBot`; it's now threaded through `PlayerCreateData` into `upsertPlayer`'s `create` and `update` (self-healing) blocks. Exposed as `isBot` on the GraphQL `Player` object so admin UIs can label bots.

- [x] **Hide bots on the public leaderboard, default-on and toggleable.** **FIXED 2026-06-06** (frontend default filter, not API gating).
      **Decision:** Bot visibility isn't sensitive enough to warrant server-side session gating (the earlier `handleResolver` approach was reverted as over-engineering). Bots are hidden _by default_ via a query-layer `where: { isBot: { equals: false } }` passed from the web, with maximum flexibility to opt back in. This is purely cosmetic — Phase 1 already handles the integrity concern (when `IgnoreBots=on` nothing is tracked; when off, bots are tracked and _do_ move skill, which is intended).
      **Fix applied:** Exposed `isBot` on the GraphQL `Player` object. Added `withHumanFilter(where, showBots)` in `apps/web/.../players/graphql/player-queries.ts`. The public players page (`app/(public)/players/page.tsx`) applies it to the list + count queries, hiding bots unless `?showBots=true`. The homepage `TopPlayers` widget always hides bots. The filter rides the existing loose `WhereFilter` type, so the web typechecks without regen.
      **Tradeoff (accepted):** a direct API caller that omits the filter still sees bots — fine, since showing bots publicly "is not a big deal."
      **Manual step (live stack):** `pnpm -F @repo/db db:push` to add the `is_bot` column (required before the `where: { isBot }` filter resolves at runtime). Optional: `pnpm codegen` (API up) to surface `isBot` in `apps/web`'s strict generated types.

- [ ] **If you want bots tracked when `IgnoreBots=off` (option B's "track but don't show"):** keep scoring **human-only** by excluding bot-involved frags from the _skill exchange_ while still recording the bot's raw kill/death counts, OR score bots fully but hide them by `isBot`. Recommend the latter only for game modes where bot stats are meaningful (the L4D precedent). For competitive CS-style servers, prefer the strict HLstatsX behavior (Phase 1) and treat "track bots" as an explicit opt-in per server.

- [ ] **If you later want weighted bot XP (the "reduce, don't zero" option):** add a `BotSkillWeight` server config (default `0` = HLstatsX parity, `1.0` = full) and apply it as a multiplier in `skill-calculator.ts` for bot-involved frags. Optionally persist the per-kill delta on `EventFrag` (new nullable `skillDelta` column) so weighted/ignored kills are auditable. Defer unless there's product demand — it's strictly more complex than on/off.

---

## Recommendation (what I'd ship)

1. **Now (correctness):** Phase 1 — make `IgnoreBots` gate scoring exactly like HLstatsX (discard the whole frag when either side is a bot). This stops rank farming and stops bot `Player` rows from being created. Fastest path to "behaves like people expect."
2. **Next (hygiene):** Phase 3's `isBot` flag + a default-on bot filter on the public leaderboard. Shipped as a frontend default (`where: { isBot: false }`, toggleable via `?showBots=true`) rather than server-side gating — bot visibility isn't sensitive, so the simpler approach won.
3. **Later (optional product features):** `MinPlayers` anti-boost gate, weighted `BotSkillWeight`, and a per-server "track bots" opt-in for casual/co-op modes. Only build these if a use case appears; HLstatsX shipped fine without weighting.

**On "keep all and filter on frontend?"** — Yes, _now that Phase 1 exists_. The integrity problem (bot kills moving human skill) is settled separately: when `IgnoreBots=on` nothing is tracked, and when off, bots affecting skill is intended. That leaves display as a pure cosmetic choice, so a default-on frontend filter keyed on the real `isBot` column is the right tool — exactly what shipped. Filtering on the frontend would have been wrong _only_ if it were the sole defense against farming; it isn't.

---

## Looks good (don't change)

- Bot detection is already centralized and consistent: parsers set `isBot` (`cs.parser.ts`), `validation.ts:15-22` accepts the `BOT` / `BOT:` / `BOT_<id>_` forms, and the resolver derives synthetic ids. This is the right place to build on — Phase 1 reuses the existing `meta.killer.isBot`/`meta.victim.isBot` flags with no new parsing.
- The lifecycle gate in `player.events.ts:46-63` is structurally correct (right place, right config lookup) — it just needs to be extended to the scoring event types.
- `ServerConfig` / `ServerConfigDefault` is a clean per-server key/value home for `IgnoreBots` (and future `MinPlayers`, `BotSkillWeight`), matching HLstatsX's per-server scoping.
