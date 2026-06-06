# Review: Garnet vs. in-memory caching decision

**Date:** 2026-06-06
**Scope:** Caching-layer architecture decision for the daemon query-caching candidates in `docs/audits/daemon-query-caching-2026-06-06.md` (architectural finding, lines 123–131). Should the daemon use the wired-but-unused Garnet (Redis) distributed cache, or in-process Maps?
**Reviewer:** /review skill

## Summary

**Verdict: use in-process Maps. Garnet is not worth the extra software layer today — by a wide margin.** A distributed cache earns its keep only when it buys cross-process sharing, restart-survival, or memory relief. None of the three apply to this daemon, and for the _specific_ queries in question a network hop to Garnet would be no faster (often slower) than the DB lookups it replaces. Adopt the audit's **Option 2**: implement the two confirmed HIGH candidates as in-process Maps and delete the dead Garnet read path.

**Findings:** 1 decision (resolved → in-memory), 2 cleanup actions, 2 implementation follow-ups.

---

## The decision, grounded in the code

A distributed cache is justified by exactly three things. Checking each against verified facts:

### 1. Cross-process sharing — does NOT apply

The daemon is **architecturally single-instance**, and not by accident:

- **UDP ingress binds one socket to port 27500** (`udp-server.ts:134`). A second instance dies with `EADDRINUSE`. There is no UDP load balancer, no per-server affinity routing, and none is documented or on the roadmap.
- Multiple instances would corrupt **far more than caches**: `ServerStateManager` (`server-state-manager.ts:75`, round/map/team-win context), the per-server `parserCache` (`ingress.service.ts:21`), the RCON `ConcurrencyLimiter` (`concurrency-limiter.ts:9` — would double-fire schedules), and in-process session tracking all assume a single writer.
- `DEPLOYMENT.md:3` — "deploying … on a **single** Ubuntu server" — one `daemon` service, no `replicas:`, no k8s.

The implication is the crux: **even if you wanted multi-instance, sharing a cache for two immutable tables is the _easy_ 5% of that project.** You'd first need UDP affinity plus a distributed home for all the stateful managers above. So Garnet provides no value toward multi-instance until a much larger effort is funded — and when that day comes, adding the cache is trivial. Pre-wiring it now buys nothing and rots as dead code (which is exactly what happened).

### 2. Restart-survival — does NOT apply

The actual candidates are tiny and instantly repopulated:

- `getServerGame` — **3 entries** in production today (3 servers), immutable.
- `findActionByCode` — **754 rows**, static reference data.

Both refill from sub-millisecond `const`/PK lookups on first access after a restart. There is zero value in persisting them across process restarts.

### 3. Memory relief — does NOT apply

~757 total entries. An in-process Map is bounded, trivially small, and already the house pattern (see below). Garnet would _add_ memory (a 1 GB container) to avoid kilobytes in-process.

### The latency argument actively favors in-memory

This is the clincher. The benchmark shows these candidates are PK / unique-key `const` lookups at **0.27 ms (`getServerGame`)** and **0.46–0.51 ms (`findActionByCode`)** (audit P4/P6/P7). A round-trip to Garnet over TCP — connect, serialize, network, deserialize — lands in the **same 0.3–1 ms ballpark or worse**. So Garnet would replace a fast DB query with an equally-slow (or slower) network query, while an **in-process Map hit is ~nanoseconds**. Garnet's only theoretical edge (sharing) doesn't apply (§1), so on the one axis that's left — latency — it's a lateral move at best.

### Plus the costs Garnet imposes

A new failure mode (cache unreachable → degrade or stall), connection lifecycle management, serialization, the `CACHE_PASSWORD` secret to handle, and an extra container to run, secure, monitor, and patch — all to cache 757 immutable rows that the DB already serves in under a millisecond and that the existing in-process patterns handle for free.

### And the workload data says there's no fire to fight

At real load the DB is idle: **4.6 q/s, p50 2 ms, pool 2/12 busy, zero slow/failed queries** (audit workload section). These caches buy _scale headroom and lower per-event query volume_ (~12% of total queries), not a fix for a present bottleneck — which further undercuts paying for a distributed layer now.

### Why in-process is the natural fit

The daemon already has **seven** mature, sound in-process caches with the exact bounding/TTL/sweep discipline these candidates need — and a `ServerLifecycleCoordinator` that fans out per-server cache cleanup on `SERVER_SHUTDOWN` (`server-lifecycle.coordinator.ts:84–103`). The two new caches slot directly into established, tested patterns (`ServerService.configCache`, `RankingService.weaponModifierCache`). No new infrastructure, no new failure modes.

> Note: `ioredis` and the cache factory exist **only** in the daemon — no API/web consumer (`ioredis` is in `apps/daemon/package.json` alone). So this decision fully owns Garnet's fate; nothing else depends on it.

---

## Phase 1 — Decision (resolved)

- [x] **Use in-process Maps, not Garnet, for the daemon caching candidates.** Adopt **Option 2** from `daemon-query-caching-2026-06-06.md:131`. Rationale above: single-instance by design, immutable + tiny data, no latency win over the DB, and seven proven in-process patterns to mirror. Revisit Garnet _only_ if/when genuine multi-instance daemon work is funded — at which point the cache is the trivial part.

## Phase 2 — Cleanup (remove the misleading dead code/infra)

- [x] **`modules/player/repositories/cached-player.repository.ts`** — delete the file and its tests. It is never instantiated (`repository.orchestrator.ts:41` wires the plain `new PlayerRepository(...)`), and as written it caches the **volatile** player row with a 1 h TTL — the wrong target regardless of cache backend. Its presence implies test coverage and a caching strategy that don't exist.
      **Why:** dead code that misrepresents system behavior; the workload benchmark also retracted its premise (`Player.findUnique` is volatile and needs request-scoped memoization, not a TTL cache).
- [x] **Remove the unused Garnet read/write wiring** once the candidates are in-process Maps: `GarnetCacheService`/`cache.factory` instantiation in `infrastructure-config.factory.ts:51–53`, the `cache` field on `AppContext` (`context.ts:62`, `:203`), and the `cache.disconnect()` shutdown phase (`main.ts:426`). Drop the `ioredis` dependency from `apps/daemon/package.json`.
      **Why:** `.connect()` is never called and there are zero `.get/.set` callers; this is pure dead surface. **Verify first** there's no near-term plan to use it before deleting — if Garnet should stay parked for a funded multi-instance effort, leave the service file but at minimum fix the misleading config in the next item.
- [x] **Remove the `garnet` service from `docker-compose.yml:73–93` and `docker-compose.test.yml:53–67`, and stop setting `CACHE_ENABLED=true`** in `.env.example:27`, `apps/daemon/.env.example:51`, `apps/daemon/src/tests/e2e/setup.ts:25`, and `.github/workflows/main.yml:199`. Drop `CACHE_ENABLED`/`CACHE_HOST` from `turbo.json:36–37` if nothing else references them.
      **Why:** `CACHE_ENABLED=true` today is a no-op (the client uses `lazyConnect` and `.connect()` is never called) but it advertises an active cache that doesn't exist — actively misleading to operators. Tie this to whichever path you pick in the item above.

## Phase 3 — Implementation follow-ups (the actual wins, in-process)

- [x] **`modules/server/server.service.ts:31–39`** — cache `getServerGame` in-process. It currently bypasses the existing `configCache` and calls `repository.findById` directly on every event (~18.7% of reads, confirmed by workload benchmark).
      **Fix:** add a Map keyed by `serverId` (game is immutable; an unbounded-TTL map is safe — bounded by server count, ~3 today). Invalidate via the existing `ServerLifecycleCoordinator` `SERVER_SHUTDOWN` fan-out so it matches the house cleanup pattern.
- [x] **`modules/action/action.repository.ts:28,39`** — cache `findActionByCode` in-process, mirroring `RankingService.weaponModifierCache` (5-min TTL, full-clear refresh). Key on `game:code:team` and `game:code` for the fallback; **cache negative results** (unknown codes recur). ~6.2% of reads, two round-trips per action today.
- [ ] _(Do NOT pursue)_ the `uniqueId:game → playerId` cache — the workload benchmark retracted it (resolution runs through an `upsert` write path: 51 upserts / 0 `findUnique` in-window, audit line 206). And `Player.findUnique` (64% of reads) is volatile → that's a **request-scoped memoization / write-through** problem inside the handler, never a shared TTL cache. Neither is a Garnet candidate either — recording here so the decision isn't re-litigated.

## Looks good

- The seven existing in-process caches (GeoIP LRU, `ServerService.configCache`, `weaponModifierCache`, `OptionsService`, notification-config, `GameConfigService` startup singleton, token authenticator) are the correct templates — keep them and copy their bounding/TTL/sweep discipline.
- `ServerLifecycleCoordinator`'s per-server `SERVER_SHUTDOWN` cleanup fan-out is exactly the invalidation hook the new `getServerGame` cache should plug into.
- The audit's instinct to **not** cache volatile player rows / session counts (and to prefer composite indexes for the `events_frag` counts) is right and should survive this decision.
