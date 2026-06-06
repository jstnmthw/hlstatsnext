# Daemon Audit: Query Caching Candidates

**Date:** 2026-06-06
**Scope:** All Prisma **read** queries under `apps/daemon/src/` (modules + shared), benchmarked against the live local/Docker dev DB.
**DB benchmarked:** MySQL **8.4.9** (local Docker dev stack)
**Estimated caching maturity:** Medium — the hot reference-data paths that _are_ cached use sound in-process patterns, but two hot per-event lookups are uncached, and a fully-built Garnet cache layer is wired up yet completely unused.

## Summary

The daemon already caches its most dangerous read (GeoIP, benchmarked at **~600 ms uncached**) and its highest-volume reference lookups (weapon modifiers, server config flags, options, notification config, game metadata). The remaining opportunities are **volume-driven, not latency-driven**: a handful of per-event point lookups that each cost <0.5 ms on the dev DB but fire on essentially every game event, so at production event rates they translate into thousands of avoidable DB round-trips per second.

The single most surprising finding is architectural: a complete **Garnet (Redis) distributed-cache layer is instantiated, health-checked and disconnected on shutdown, but never read from or written to** — and its only intended consumer, `CachedPlayerRepository`, is never instantiated. All caching that actually runs is in-process `Map`s.

**Benchmark caveat (important):** the dev DB is tiny — `players` 57 rows, `actions` 754, `servers` 3, `events_frag` 710 — so every point lookup measures sub-millisecond regardless of caching. The one large table is `geo_lite_city_block` (**3.75 M rows / 350 MB**). Treat the dev-DB timings below as a _lower bound_; the value of caching is (a) eliminating per-event network round-trips at scale and (b) avoiding the two queries whose execution cost grows with table size.

**Findings:** 2 high-priority, 2 medium, 3 low/info caching candidates, plus 1 architectural item.

---

## Benchmark methodology & environment

- Timings captured server-side via MySQL `SET profiling = 1` + `SHOW PROFILES` (median of warm runs where noted), plus `EXPLAIN` / `EXPLAIN ANALYZE` for plan + rows-examined.
- Each candidate query was reproduced from the exact Prisma call (model, `where`, `select`, `LIMIT 1` for `findFirst`/`findUnique`).
- "Time (dev DB)" is real but on tiny tables; the "At production scale" column is the extrapolation that matters.

### Measured results

| #   | Query (representative)                               | Plan / index                 | Rows examined       | Time (dev DB)                      | Cost driver at scale                                         |
| --- | ---------------------------------------------------- | ---------------------------- | ------------------- | ---------------------------------- | ------------------------------------------------------------ |
| P1  | `geo_lite_city_block` containment, **high IP**       | `range` on PRIMARY           | **3,750,000 → 1**   | **597 ms** (cold) / ~425 ms (warm) | Already cached ✅                                            |
| P2  | `geo_lite_city_block` containment, IP 8.8.8.8        | `range` on PRIMARY           | ~mid                | 4.3 ms                             | Already cached ✅                                            |
| P3  | mid IP (2.0 B) / low IP (1.1.1.1)                    | `range` on PRIMARY           | varies              | 289 ms / 0.25 ms                   | Already cached ✅                                            |
| P4  | `servers` by `server_id` (`getServerGame`)           | `const` (PK)                 | 1                   | 0.27 ms                            | **× per-event volume**                                       |
| P5  | `player_unique_ids` by `(unique_id, game)`           | `const` (composite PK)       | 1                   | 0.17 ms                            | **× per-event volume**                                       |
| P6  | `actions` `(game, code, team='')`                    | `const` (unique key)         | 1                   | 0.46 ms                            | **× per-action volume**                                      |
| P7  | `actions` fallback `(game, code)`                    | `const` (unique key)         | 1                   | 0.51 ms                            | **× per-action volume**                                      |
| P8  | `players` `COUNT(skill > x)` (rank)                  | `range`/skip-scan on `skill` | grows w/ rank       | 0.23 ms                            | **scans skill index, grows w/ player count**                 |
| P9  | `players` `COUNT(*)` (total)                         | index                        | all                 | 0.13 ms                            | grows w/ player count                                        |
| P10 | `events_frag` `COUNT(killer_id=? AND event_time>=?)` | `ref` on `killer_id` only    | all frags by player | 0.99 ms                            | **no `(killer_id,event_time)` composite — grows w/ history** |
| P11 | `servers_config` `(server_id, parameter)`            | PK                           | 1                   | 0.47 ms                            | Already cached ✅ (30 s)                                     |

`EXPLAIN ANALYZE` for P1 (the headline): `Index range scan on geo_lite_city_block using PRIMARY over (start_ip_num <= 3700000000) (actual time=0.45..446 rows=3.75e6 loops=1)` → it physically walks **3.75 million index rows in 446 ms** to return a single row. This is the textbook range-containment anti-pattern and is exactly why the LRU cache in front of it is load-bearing.

---

## Findings

### [HIGH] Server `game` lookup hits the DB on every event (uncached)

- [ ] **File:** `apps/daemon/src/modules/server/server.service.ts:30-39` → `apps/daemon/src/modules/server/server.repository.ts:13`
      **Pattern:** uncached per-event point lookup
      **Query:** `server.findUnique({ where: { serverId } })` via `ServerService.getServerGame()`
      **Trigger & frequency:** per-event. Call sites: `ingress.service.ts:286`, `player.events.ts:107/151/225`, `player-session.service.ts:395`, `match.events.ts:77`. Game type is resolved for essentially every player/match event.
      **Data volatility:** effectively **immutable** — a server's `game` is set at registration and ~never changes.
      **Benchmark:** 0.27 ms (PK `const` lookup). Cheap per call; the cost is volume.
      **Scenario:** a busy 32-slot server at ~50–150 events/s issues one of these per event; across many servers that is thousands of round-trips/s that all return the same constant string.
      **Why it's a strong candidate:** `ServerService` _already_ has a 30 s `configCache` Map (used by `getServerConfigBoolean`), but `getServerGame` bypasses it and calls `repository.findById` directly.
      **Recommendation:** cache the server record (or just `game`) in `ServerService` with the existing TTL-Map pattern, keyed by `serverId`. Invalidate on `SERVER_SHUTDOWN`/server-removed (the daemon already sweeps per-server caches on shutdown). Bounded by server count, so even an unbounded-TTL map is safe.

### [HIGH] Action-definition lookups are reference data queried twice per action (uncached)

- [ ] **File:** `apps/daemon/src/modules/action/action.repository.ts:28` and `:39` (via `action-definition.validator.ts:66/93/120/147`)
      **Pattern:** uncached per-event reference-data lookup; double query
      **Query:** `action.findFirst({ where: { game, code, team } })` then, on miss, a fallback `action.findFirst({ where: { game, code } })`
      **Trigger & frequency:** per-action event (kill bonuses, bomb plant/defuse, objective, round/team win). Validator calls it for player, player-player, team and world actions.
      **Data volatility:** **static reference data** — 754 rows; changes only on admin edit.
      **Benchmark:** 0.46 ms + 0.51 ms (each `const` via the `(code, game, team)` unique key — already optimally indexed). So this is pure volume + an extra round-trip for the fallback.
      **Scenario:** objective-heavy modes (TF2, CS bomb maps) fire many action events per round; every one pays up to two DB round-trips to read rows that essentially never change.
      **Recommendation:** wrap `findActionByCode` in an in-process `Map` cache keyed by `game:code:team` (and `game:code` for the fallback), mirroring `RankingService.weaponModifierCache` (5-min TTL, full-clear refresh). Negative results should be cached too (unknown codes recur). Bounded by distinct action codes per game.

### [MEDIUM] Player identity resolution (uniqueId → playerId) is uncached on the event path

- [ ] **File:** `apps/daemon/src/modules/player/repositories/player.repository.ts:63-91` (via `simple-player-resolver.service.ts:36`, `player-status-enricher.ts:160`)
      **Pattern:** uncached per-event lookup of an immutable mapping
      **Query:** `playerUniqueId.findUnique({ where: { uniqueId_game }, include: { player: true } })`
      **Trigger & frequency:** per player-event — `getOrCreatePlayer` resolves Steam-ID → `playerId` for kills (killer + victim), connects, chat, etc.
      **Data volatility:** the `uniqueId+game → playerId` **mapping is immutable** once a player exists (the included `player` row is volatile, but the resolver only needs `playerId`).
      **Benchmark:** 0.17 ms (composite PK). Volume-driven.
      **Scenario:** for already-known players (the overwhelming majority of events), this is a constant lookup repeated every event.
      **Recommendation:** add a small in-process cache mapping `uniqueId:game → playerId` (the ID only — never the volatile row). Populate on resolve/create; entries never need invalidation because the mapping is stable. Avoids re-wiring `findByUniqueId` (which over-fetches the full player row). Note: the current `include: { player: true }` also pulls the whole player row when only the id is needed — consider `select` narrowing regardless of caching.

### [MEDIUM] Rank queries scan the `skill` index per chat command — fine now, scale-dependent `[at-scale]`

- [ ] **File:** `apps/daemon/src/modules/player/repositories/player-rank.repository.ts:34` (`COUNT(skill > x)`) and `:50` (`COUNT(*)`)
      **Pattern:** unbounded-aggregate on a growing table
      **Query:** `player.count({ where: { skill: { gt } } })` + `player.count()`, via `player-command.coordinator.ts:104/105/143/144`
      **Trigger & frequency:** **on-demand**, in response to player chat commands (`/rank`, `/stats`) — _not_ per kill. But chat commands are user-triggerable and can be spammed.
      **Data volatility:** mutable (skill changes constantly), but rank position tolerates seconds of staleness.
      **Benchmark:** 0.23 ms on 57 players (`range`/skip-scan on `isbot_skill`). On a 100 k-player table, `COUNT(skill > x)` scans up to ~100 k index entries → tens of ms, per command.
      **Scenario:** a populated server where several players type `/rank`/`/stats` each round; each command pays a growing index scan.
      **Recommendation:** two options, ideally both — (1) a short-TTL cache (30–60 s) on rank + total-count keyed by `playerId`/global; (2) note that `RankingService.getPlayerRankPosition` already implements an efficient `RANK() OVER (ORDER BY skill DESC)` window query — the coordinator could call that instead of the count-based approach, consolidating two queries into one and giving correct tie handling.

### [LOW] Session-stats counts lack a composite index — prefer an index fix over caching `[at-scale]`

- [ ] **File:** `apps/daemon/src/modules/player/repositories/player-rank.repository.ts:60/72/81`
      **Pattern:** range count without a covering composite index
      **Query:** `eventConnect.findFirst(... orderBy eventTime desc)` + two `eventFrag.count({ where: { killerId|victimId, eventTime: { gte } } })`, via `player-command.coordinator.ts:192`
      **Trigger & frequency:** on-demand (`/session` chat command).
      **Data volatility:** highly mutable (appended every kill) — a poor caching target.
      **Benchmark:** ~1 ms on 710 frags. `EXPLAIN` shows `ref` on `events_frag_killer_id_idx` **only** — it matches all of a player's frags, then filters `event_time` with no index help. At millions of frags this scales with a player's _lifetime_ frag count, not session size.
      **Recommendation:** this is better fixed with schema than cache — add composite indexes `(killer_id, event_time)` and `(victim_id, event_time)` on `events_frag` so the time-bounded count is an index range. (Caching volatile session counts risks showing stale kills/deaths to the requesting player.) If caching is still wanted, use a very short TTL (≤10 s).

### [LOW] Global reference defaults are re-fetched on every new-server seeding

- [ ] **File:** `apps/daemon/src/modules/server/seeders/seed-server-defaults.ts:20`, `seed-game-defaults.ts:21`, `token-server-authenticator.ts:366/372`, `server.repository.ts:65/245` (`serverConfigDefault.findUnique` fallback)
      **Pattern:** reference-data re-read
      **Query:** `serverConfigDefault.findMany()` / `gameDefault.findMany({ code })` / `serverConfig.count` on registration; `serverConfigDefault.findUnique(parameter)` as config fallback.
      **Trigger & frequency:** per **new** server registration (rare) + per missing-param config read (behind the 30 s `ServerService` cache, so largely covered).
      **Data volatility:** static (`servers_config_default` 32 rows, `games_defaults` 692 rows).
      **Benchmark:** sub-ms; not a hot path.
      **Recommendation:** low priority. If touched, load `serverConfigDefault` / `gameDefault` once into memory at startup (the `GameConfigService` singleton already does exactly this for `games`/`games_supported`) rather than re-querying per registration.

### [INFO] Weapon-modifier cache clears wholesale every 5 minutes

- [ ] **File:** `apps/daemon/src/modules/ranking/ranking.service.ts:155-159`
      **Pattern:** coarse cache invalidation (not a correctness bug)
      **Description:** `getWeaponMultiplier` caches `game:weapon → modifier` but `clear()`s the entire map every 5 min instead of expiring per entry, so the first kill after each window re-reads from DB for every distinct weapon at once.
      **Benchmark:** weapon lookup is `const`-cheap; impact is negligible at current scale.
      **Recommendation:** optional — switch to per-entry TTL, or simply lengthen the window (weapon modifiers are reference data). Leave as-is if not otherwise touching ranking.

---

## Architectural finding

### [HIGH-IMPACT / decision needed] The Garnet distributed cache is wired up but completely unused

- [ ] **Files:** `shared/application/factories/infrastructure-config.factory.ts:51-53` (creates it), `context.ts:203` (stores it), `main.ts:426` (disconnects it) — and `modules/player/repositories/cached-player.repository.ts` (the only intended consumer, **never instantiated**: `repository.orchestrator.ts:41` wires the plain `new PlayerRepository(...)`).
      **What's true today:** `GarnetCacheService` (a complete, tested Redis-compatible cache with `get/set/mget/mset/invalidatePattern`) is constructed, connected, health-checked, and `disconnect()`-ed on shutdown — but **no daemon read path ever calls `.get`/`.set` on it.** Every cache that actually runs (`geoip.service`, `options.service`, `ServerService`, `RankingService`, notification config, token authenticator) is a private in-process `Map`/LRU that happens to share the field name `cache`.
      **Implication:** there is a ready-made distributed cache available at zero additional infra cost, plus dead code (`CachedPlayerRepository` + its tests) implying coverage that doesn't exist.
      **Caveat on the dead consumer:** `CachedPlayerRepository` as written caches the **volatile** player row (skill, kills) with a 1 h TTL and invalidates on every `update()`. On the daemon's write-heavy path that would thrash (invalidate on every kill) and risk stale skill reads — so do **not** simply wire it in as-is.
      **Recommendation — pick one:** 1. **Repurpose** the Garnet layer for the _immutable_ candidates above (server `game`, action definitions, `uniqueId→playerId`). These are safe to share across processes and never need write-path invalidation. This is the high-value path if the daemon ever scales beyond one instance. 2. If multi-instance caching isn't on the roadmap, implement the HIGH/MEDIUM candidates as in-process Maps (matching existing patterns) and **delete** `CachedPlayerRepository` + the unused Garnet read path to remove misleading dead code. Keep Garnet only if something else needs it.

---

## Stable patterns found (templates — keep these)

These already cache correctly and are the right templates for the fixes above:

- **GeoIP LRU** (`modules/geoip/geoip.service.ts`) — bounded LRU (10 k), keyed by numeric IP, **caches negative results**. Benchmarks prove this is load-bearing: the underlying query is **~290–600 ms** for mid/high IPs (scans up to 3.75 M rows). Without it, a burst of connects from uncached IPs would each block ~0.5 s and could exhaust the Prisma pool. _Consider_ a longer-term schema fix (a range-optimized lookup) so cache misses aren't catastrophic, but the cache is correct and essential today.
- **Server config flags** (`ServerService.configCache`, 30 s TTL, keyed `serverId:parameter`, bounded by servers×params) — used for `IgnoreBots` on the bot hot path.
- **Options** (`OptionsService`, 60 s TTL per key) and **Notification config** (`notification-config.repository`, 5 min TTL + explicit `clearServerCache()` on upsert).
- **Game metadata** (`GameConfigService`) — loaded once at startup into a singleton (the model to copy for static reference data).
- **Token auth** (`TokenServerAuthenticator`) — token cache (~1 min) + debounced `lastUsedAt` writes; the per-beacon hot path is well defended.

---

## Recommendations (prioritized)

**Quick wins (in-process Map, mirrors existing patterns, low risk):**

1. Cache `getServerGame` in `ServerService` (immutable, per-event). _[HIGH]_
2. Cache `findActionByCode` (reference data, two queries/action). _[HIGH]_
3. Cache `uniqueId:game → playerId` (immutable mapping, id-only). _[MEDIUM]_

**Medium (schema + small cache):** 4. Add composite indexes `events_frag(killer_id, event_time)` and `(victim_id, event_time)`; consider routing `/rank`+`/stats` through the existing `RANK()` window query and/or a 30–60 s rank cache. _[MEDIUM/LOW]_ 5. Narrow `findByUniqueId`'s `include: { player: true }` to a `select` if the full row isn't needed by callers.

**Architectural (decision):** 6. Decide the fate of the Garnet layer — repurpose for the immutable candidates (multi-instance ready) **or** remove `CachedPlayerRepository` + the unused Garnet read path. _[HIGH-IMPACT]_ 7. Long-term: replace the GeoIP range-containment scan with a range-optimized lookup so cache misses stop costing ~0.5 s.

**Do NOT cache:** volatile player stat rows on the write path (skill/kills change every event — caching invites stale skill/points math; the existing `invalidatePlayerCaches` re-throw logic in `CachedPlayerRepository` shows the team already understands this hazard). Session kill/death counts (volatile; fix with an index instead).

---

## Provenance

Three `Explore` sub-agents mapped the query surface (50 read call sites across modules); their frequency/cache claims were then **verified against source and recalibrated** before inclusion. Notable corrections:

- **Demoted:** sub-agents reported player data/stats as "cached (1 h/30 min via Garnet)". Verified **false** — `CachedPlayerRepository` is never instantiated and the Garnet cache is unused on the read path. Re-classified as the architectural finding.
- **Demoted:** `findActiveServersWithRcon` was flagged "CRITICAL ~500 QPS / primary target." It runs per RCON schedule tick on **mutable** data (`lastEvent` gates active servers); caching risks the monitor skipping newly-active or polling dead servers. Not listed as a caching candidate (caching would harm correctness).
- **Demoted:** rank/session queries were reported as per-kill "N+1 hotspots." Verified they fire **on-demand from chat commands** (`player-command.coordinator`), not per kill → reclassified MEDIUM/LOW `[at-scale]`.
- **Demoted (dead code):** `match.repository.ts:22 getPlayerSkill` has no live caller (interface + impl only) — excluded.
- **Confirmed:** weapon multiplier is already cached (5 min Map); GeoIP/options/notification/token/game-config caches are real and sound.

---

## Workload benchmark — real traffic (2026-06-06)

The static benchmarks above measure per-query cost on tiny dev tables. This section measures **query composition and volume under real load**, which is what the caching case actually rests on. Captured from the running daemon's own Prometheus metrics (`/metrics`, `/query-stats` on `:9091`) over a **94-second window** while **3 live cstrike servers (~39 bots)** fed real UDP events through the full ingress → RabbitMQ → handler → Prisma pipeline. This replaces the synthetic-load / DB-seeding approach — real traffic gives the true event mix and query ratios for free.

### Window totals

| Metric                | Value                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Wall-clock window     | 94 s                                                                                     |
| Game events processed | 27 KILL, 9 ACTION_PLAYER, 2 ACTION_TEAM, 8 ROUND start/end, 2 TEAM_WIN (~48 significant) |
| Total Prisma queries  | **~429** (≈4.6 q/s): 209 reads / ~220 writes                                             |
| Query latency (live)  | avg **3.8 ms**, p50 **2 ms**, p95 13 ms, p99 20 ms                                       |
| Slow queries (>1 s)   | **0** &nbsp;·&nbsp; failed queries: **0**                                                |
| DB connection pool    | 12 open, **2 running** at peak (idle — not a bottleneck at this rate)                    |

### Read composition (209 reads in window)

| Query                                 | Count | % of reads | Per-event                | Cacheable?                                           |
| ------------------------------------- | ----- | ---------- | ------------------------ | ---------------------------------------------------- |
| `Player.findUnique`                   | 133   | **63.6 %** | ~2.8 / event (≥2 / kill) | **Volatile** — needs dedup/write-through, not TTL    |
| `Server.findUnique` (`getServerGame`) | 39    | **18.7 %** | ~1 / event               | ✅ immutable — **HIGH candidate confirmed**          |
| `ServerConfig.findUnique`             | 14    | 6.7 %      | —                        | already 30 s cached (refreshes)                      |
| `Action.findFirst`                    | 13    | 6.2 %      | ~1.2 / action            | ✅ reference data — **HIGH candidate confirmed**     |
| `ServerConfig.count`                  | 5     | 2.4 %      | —                        | low                                                  |
| `Weapon.findUnique`                   | 3     | 1.4 %      | ~0.11 / kill             | ✅ **cache working** (3 reads / 27 kills ≈ 89 % hit) |
| `ServerToken.findUnique`              | 2     | 1.0 %      | —                        | beacon re-auth (cached)                              |

### What real traffic changes vs. the static audit

- [ ] **`Server.findUnique` + `Action.findFirst` = ~25 % of all reads (~12 % of all queries)** and both are immutable/reference data → the two HIGH candidates are confirmed as the clean, safe wins. With only **3 servers**, the server-game cache is 3 entries.
- [ ] **`Player.findUnique` is the real dominant read (64 %)** — the static audit under-weighted this. It is **volatile** per-event data, so a TTL cache is unsafe. ~2.8 reads/event suggests the same player row is read multiple times within one event's handling → the right lever is **request-scoped memoization / write-through within the handler**, not a shared cache. _New follow-up worth a dedicated look._
- [ ] **The `uniqueId:game → playerId` read-cache candidate is invalidated by real data.** In-window: `PlayerUniqueId.upsert` = 51, `PlayerUniqueId.findUnique` = **0**. Identity resolution runs through an **upsert (write)** path (which also updates `lastName`/`lastEvent`), so a read cache cannot help it. Reducing it would require restructuring resolution to skip the upsert for already-known players (medium effort, correctness risk) — _not_ a simple cache. **Recommendation #3 in the list above is retracted on this evidence.**
- [ ] **At current load the DB is not a bottleneck** (4.6 q/s, p50 2 ms, pool 2/12 busy, zero slow/failed). The caching wins here buy **scale headroom and lower per-event query volume**, not a fix for a present problem. Writes (~220/window: `Player.update` 62, `PlayerName.upsert` 54, `PlayerUniqueId.upsert` 51, `EventFrag.create` 27) roughly equal reads and are not cache-addressable — so even perfect read-caching of the immutable candidates removes ~12 % of total query volume.

### Method note

Per-query attribution used the daemon's own per-`(model, action)` Prisma counters at audit time (clean, exact, isolated to the daemon process). MySQL `performance_schema` digests were not used for attribution — the daemon's parameterized statements did not isolate cleanly there and the digest table was contaminated by this audit's own manual benchmark queries. Connection-pool saturation was read from MySQL (`Threads_running`, `information_schema.PROCESSLIST`) — Prisma 7 exposes no internal pool gauges (the `$metrics` API was removed in Prisma 7).

> _Post-audit:_ the per-`(model, action)` counter family (`prisma_queries_total` / `prisma_query_duration_ms`) was consolidated into `database_queries_total{operation, table}` to cut redundant cardinality. Re-running this attribution would now use `operation`-level labels (SELECT/INSERT/UPDATE/DELETE) rather than raw Prisma actions.
