### HLStatsNext Daemon roadmap and refactor plan

This document updates and supersedes parts of `apps/daemon/docs/MIGRATION.md`, consolidating the current status, immediate next steps, and longer-term phases to reach a stable Release Candidate. It reflects recent modules and aligns with monorepo standards.

---

## Current status snapshot

- Ingress
  - UDP server for log ingest with rate limiting and parser factory.
  - Game detection service with normalization and caching.
  - Server authentication adapter (DB-backed) and development auto-create path.
- Parsing
  - Counter-Strike (CS/Source/CS2-style) parser with support for: connect, disconnect, chat, kill, teamkill, suicide, round start/end, team win, map change, and action events.
  - No-op parser fallback.
- Event processing
  - Event bus and module registry wiring.
  - Player, Weapon, Match, Action, Server handlers separated; `MatchHandler` maintains in-memory round/match state.
  - Coordinators for cross-module flows (e.g., kill → ranking adjustments).
- Persistence
  - Repository layer over Prisma with transactions, clean update helpers, and typed options (create/find/update).
  - Player, Action, Match, Weapon, Server repositories.
- Ranking
  - Weapon multiplier cache + repository-backed lookup.
  - Elo-like rating adjustments with bounds, victim loss ratio, suicide/TK penalties, per-weapon modifiers.
- Messaging (RabbitMQ module)
  - Pluggable client with publisher/consumer, topology setup, shadow consumer for migration validation.
  - Message schema (routing key, priority, correlation IDs), retry, and metrics.
- Observability
  - Structured logger with levels and service lifecycle helpers.
  - EventMetrics for per-type timing and module metrics.
  - Extensive unit tests across modules (handlers, queue, utils).

Gaps vs. legacy parity

- Awards/ribbons pipeline (cron-style) not yet implemented.
- Daily history snapshots and activity decay not yet implemented.
- GeoIP resolution on connect and server geo fields (lat/lng/city/country) not yet integrated.
- Some objective-specific events (bombs/hostage/flags/control points) stubbed in types, partial parsing in `CsParser`, not fully persisted.
- Options/Choices catalog and server configuration defaults not fully surfaced in the daemon.
- Admin events and ban/hideranking workflows not yet wired.

---

## Immediate next steps (0–2 weeks)

1. History and activity

- Implement `PlayerHistory` writer: a small service that periodically snapshots active players’ counters into `Players_History` (supports in-memory accumulation + batch write or per-event “dirty” tracking). Hook into `MatchService` finalize and a timer.
- Implement activity updates mirroring legacy DoInactive, but incremental: compute `Players.activity` from `lastEvent` without heavy full-table scans.

2. GeoIP resolution

- Add a `GeoIPService` (MaxMind reader) used by `IngressService` on connect to enrich `Player` and `Server` geo fields; consider a lightweight queue for reverse-DNS/hostgroup resolution similar to `hlstats-resolve.pl`.

3. Objective persistence

- Complete persistence handlers for `BOMB_PLANT`, `BOMB_DEFUSE`, `BOMB_EXPLODE`, `HOSTAGE_*`, `FLAG_*`, and control point events. Reuse `ActionService` where appropriate and extend `Actions` repository to resolve action IDs by `(code, game, team)`.

4. Server map and load tracking

- Persist server map transitions (`ServerRepository.resetMapStats`) on `MAP_CHANGE` events and fill per-map counters (rounds, wins, shots/hits) from `MatchService` state.
- Add optional `ServerLoad` sampling with a periodic job to store activePlayers/uptime/fps.

5. Options and server config

- Introduce `OptionsService` to read/write `Options` and `Options_Choices` and expose daemon feature flags (broadcast, thresholds, ranking parameters) via config.
- Ensure `ServerConfigDefault` and per-server `ServerConfig` are respected for parser/game behaviors.

---

## Short-term (2–6 weeks)

6. Awards and ribbons

- Implement an `AwardsService` running on a schedule. Port queries from legacy with Prisma equivalents and guard with integration tests. Persist winners into `Players_Awards` and recompute `Players_Ribbons` per game.

7. Admin actions and bans

- Add `AdminAction` ingestion and map to DB-side effects: `Users` linking, and `Players.hideranking` updates for ban/unban workflows.

8. Multi-game parser expansion

- Add parsers for GoldSource and additional Source titles (TFC, DoD, HLDM). Share a common base and per-game regex/action tables. Extend `GameConfigService` patterns and alias resolver.

9. Web/API integration contract

- Define GraphQL queries for live match stats, top players, and recent events. Ensure daemon writes are query-friendly (indexes, include fields like `map`, `team`, `weapon`).

10. Performance & backpressure

- Batch DB writes where safe (action logs, chat) using repository transaction helpers. Measure with `EventMetrics` and add slow-path logging. Tune queue consumer concurrency.

---

## Medium-term (6–12 weeks)

11. Caching

- Introduce Redis caching for hot lookups (weapon modifiers, actions, player ID resolution) with TTL and invalidation hooks.

12. Distributed processing

- Promote RabbitMQ path to default in production: ingress publishes, processors consume. Keep an in-process fallback for dev.

13. Observability and health

- Add Prometheus metrics exporters and basic health endpoints for liveness/readiness across modules and RabbitMQ client.

14. Data hygiene

- Add periodic pruning mirroring legacy (old `server_load`, old `Players_History` beyond retention). Ensure foreign key cascades are correct.

---

## Long-term (RC readiness)

- Parity checklist
  - Model coverage matches legacy tables documented in `docs/HLSTATSX_MODELS.md`.
  - Awards/ribbons reproducible vs. legacy for a sample dataset.
  - Multi-game parsing validated with fixtures.
  - Daemon operates queue-first with idempotent processing, retries, and DLQ.
- Quality gates
  - Lint/type/test green; 90%+ unit coverage handlers/services, 80% critical integration, smoke e2e.
  - Performance: target P95 event processing < 25ms per event in standard queue; sustained ingest rate sized to expected server counts.
  - Docs: Up-to-date README, architecture ADRs, module docs, and operational runbook.

---

## Suggested refactors

- Consolidate event types under a single `apps/daemon/src/shared/types/events.ts` (already present) and remove legacy duplication under `apps/daemon/src/types/events.ts` after migration.
- Extract skill calculation into a pure function library with unit-tested formulas (separate from PlayerService) to simplify audits and tuning.
- Normalize action lookups via `ActionService` so parsers emit semantic codes; avoid in-parser DB calls.
- Introduce a `Clock` and `Uuid` abstraction for determinism and better tests.
- Replace direct logger usage with contextual loggers carrying `correlationId`/`serverId`.

---

## Test plan additions

- Parser fixtures per game: golden log lines → expected events.
- Repository integration tests with SQLite memory for all write paths (Frags, Actions, Chat, Connects, Teamkills, Suicides, Map counts, History snapshots).
- Awards service integration with seeded events; verify winners and ribbons.
- Queue consumer end-to-end: publish → consume → persist → metrics.
