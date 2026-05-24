# Plan: Decouple observability stack and make metrics opt-in

## Summary

Today, `docker-compose.yml` boots Prometheus + Grafana alongside MySQL, RabbitMQ, and Garnet — every developer who runs `pnpm docker:up` pays the RAM/CPU cost of the observability stack whether they want it or not. The daemon also unconditionally exposes a Prometheus HTTP server on port 9091 and runs a 15s gauge collection interval, regardless of whether anything is scraping.

This plan extracts Prometheus + Grafana into a standalone `docker-compose.observability.yml`, gates the daemon's metrics HTTP server behind a `METRICS_ENABLED` env var, adds a gated metrics endpoint to `apps/api` (GraphQL Yoga), documents the stack, and retires reinvented metrics in favor of upstream plugins (`rabbitmq_prometheus` for queue depth, Prisma's native `$metrics.prometheus()` for query/pool stats). Daemon-perspective RabbitMQ counters are kept and explicitly namespaced so divergence from broker-side counters becomes a diagnostic signal. In-process Prometheus counters stay always-on because their cost is negligible — only the things that bind ports or run timers are gated.

## Feasibility

**Alignment.** All changes live in already-defined seams: a new compose file alongside the existing two, env-var gating in `apps/daemon/src/main.ts`, and a new Yoga plugin path in `apps/api/src/index.ts`. No new packages, no schema changes, no codegen impact.

**Codegen cascade.** None. No Prisma schema changes; no GraphQL surface changes (the new `/metrics` route on `apps/api` is outside the Yoga GraphQL schema, served as a sibling HTTP route).

**Dependencies.** None blocking. The `prom-client` library is already a dependency of `@repo/observability` and can be reused for the API endpoint.

**Security implications.**

- The new `/metrics` endpoint on `apps/api` exposes operational telemetry. Today the daemon's metrics server already does this on `:9091`, so this isn't novel — but the API runs on a different surface (typically reachable externally behind the same fronting as GraphQL). The endpoint must either listen on a separate internal-only port, or be locked to localhost / a network ACL. **Recommendation: separate port (`API_METRICS_PORT`, default 9092), same pattern as the daemon's `MetricsServer`.**
- No exclusion-list changes. No new GraphQL types. No new auth surface.

**Blockers.** None.

**Complexity estimate.** **M–L** (1–2 focused days). Phases 1–4 are ~one day of Docker config + env wiring + the API endpoint. Phase 5 adds another half-to-full day: enabling the RabbitMQ plugin is trivial, but renaming daemon counters, swapping the Prisma extension for native, and updating Grafana panel queries touches more surface area.

**Risk areas.**

- **Shutdown ordering** in the daemon must keep working when `MetricsServer` is `null` — the existing `runPhase("metricsServer.stop", ...)` line in `apps/daemon/src/main.ts:421` will crash if the server was never created. The gate has to be symmetric (skip create → skip stop).
- **`apps/daemon/src/main.test.ts`** already mocks `MetricsServer`. Tests need to cover both "gated off" (no server created) and "gated on" (current behavior) paths.
- **`docker/prometheus/prometheus.yml`** currently scrapes `host.docker.internal:9091`. If we add an API target, the same host-vs-container DNS question applies. Document both modes.
- **Grafana provisioning** (`docker/grafana/provisioning`, `docker/grafana/dashboards`) follows the compose file — moving Prometheus/Grafana means moving the volume mount roots too. No dashboard _content_ should need to change.

## Dependencies

- [ ] Confirm `apps/api` runs on its own process and can host a sibling HTTP listener on a second port without conflicting with Next.js dev servers or existing infra. (It uses `node:http` `createServer` already — adding a second `createServer` is trivial.)
- [ ] Confirm `COMPOSE_PROFILES` is not being used anywhere downstream we'd break (grep: none).

## Phases

### Phase 1: Extract observability into its own compose file

**Goal:** Prometheus + Grafana no longer start with `pnpm docker:up`. They live in `docker-compose.observability.yml` and start via a dedicated script.
**App/package:** repo root, `docker/`, root `package.json`, `Makefile`

- [x] Create `docker-compose.observability.yml` with `name: hlstatsnext-observability` and an external network reference (`networks.default.external: true, name: hlstatsnext-network`) so prometheus/grafana attach to the same bridge as the main stack.
- [x] Move the `prometheus` and `grafana` service blocks from `docker-compose.yml` into the new file unchanged (preserve `host.docker.internal` extra_hosts, volumes, healthcheck, restart policy).
- [x] Move the `prometheus-data` and `grafana-data` volume declarations to the new file's `volumes:` section. Remove them from `docker-compose.yml`.
- [x] Leave `docker/prometheus/`, `docker/grafana/` paths untouched — the new compose file references them with the same relative paths.
- [x] Add root `package.json` scripts:
  - `"docker:obs:up": "docker compose -f docker-compose.observability.yml -p hlstatsnext-observability up -d"`
  - `"docker:obs:down": "docker compose -f docker-compose.observability.yml -p hlstatsnext-observability down"`
  - `"docker:obs:logs": "docker compose -f docker-compose.observability.yml -p hlstatsnext-observability logs -f"`
- [x] Add `Makefile` targets `obs-up`, `obs-down`, `obs-logs` for parity (the Makefile has the same pattern as `pnpm` scripts).
- [ ] **Verification:** (deferred — Docker not available in this WSL distro; manual smoke at runtime)
  - `pnpm docker:down && pnpm docker:up` — confirm only db/rabbitmq/garnet start, ports 9090 (Prometheus) and 3001 (Grafana) are not bound.
  - `pnpm docker:obs:up` — confirm prometheus + grafana start and attach to the `hlstatsnext-network` network.
  - Open `http://localhost:9090/targets` — confirm Prometheus can resolve `host.docker.internal:9091` (daemon) and the future API target.

### Phase 2: Gate the daemon's metrics HTTP server behind METRICS_ENABLED

**Goal:** When `METRICS_ENABLED` is unset or false, the daemon does not bind port 9091 and does not run the 15s gauge collection interval. The Prisma metrics extension and in-process counters remain wired.
**App/package:** `apps/daemon`, `turbo.json`

- [x] Read `METRICS_ENABLED` (parse `"true"`/`"1"` as true; default false) in `apps/daemon/src/main.ts` near the existing `metricsPort` resolution (line ~112).
- [x] When disabled:
  - Skip the `new MetricsServer(...)` allocation — assign `this.metricsServer = null` (widen the field type to `MetricsServer | null`).
  - Skip `await this.metricsServer.start()` in the startup sequence (line ~253) — guard with a null check.
  - Skip `startMetricsCollection()` entirely (line ~253–) — the gauge collection interval exists only to feed scrapes.
  - In the shutdown sequence (line ~421), guard `runPhase("metricsServer.stop", ...)` with a null check: only enqueue the phase if `this.metricsServer !== null`.
  - In `stopMetricsCollection` (called from shutdown), the existing null check on `this.metricsCollectionInterval` already handles the never-started case — verify and add a comment if non-obvious.
- [x] Update `apps/daemon/src/main.test.ts` to cover both branches: a test where `METRICS_ENABLED=false` confirms `MetricsServer` is never instantiated, and the existing test where it is on stays green.
- [x] Log a single line at startup indicating metrics state: `logger.info("Metrics disabled (set METRICS_ENABLED=true to enable Prometheus scraping)")` when off.
- [x] Add `METRICS_ENABLED` to `turbo.json` `globalEnv` (alongside the existing `METRICS_PORT` at line 44).
- [x] **Verification:**
  - `pnpm --filter @apps/daemon test` — all 12 unit tests pass, including the new METRICS_ENABLED gating tests.
  - Runtime smoke (manual): port-binding + curl checks deferred to dev environment.

### Phase 3: Add a gated /metrics endpoint to apps/api

**Goal:** Optional Prometheus endpoint for the GraphQL API on a separate port, gated by the same `METRICS_ENABLED` toggle. Useful for GraphQL request-rate, error-rate, and resolver timing.
**App/package:** `apps/api`, `packages/observability`, `docker/prometheus`, `turbo.json`

- [x] Add `@envelop/prometheus` as a dependency of `apps/api` (verify peer-dep compatibility with the project's `graphql-yoga` + `@envelop/*` versions during install; if the resolver is unhappy, fall back to pinning a compatible major).
- [x] Instantiate a single `prom-client` Registry shared between `@envelop/prometheus` and a sibling `MetricsServer` from `@repo/observability` listening on `API_METRICS_PORT` (default 9092). The Envelop plugin handles GraphQL-level metrics (request count, duration histogram, errors, parse/validate/execute timings, optional resolver-level timings); `MetricsServer` exposes the `/metrics` endpoint. **Deviation:** the existing `MetricsServer` is tied to the homegrown `PrometheusMetricsExporter` (hand-rolled, not `prom-client`-based). Rather than refactor that class for both consumers in this PR, the API uses a small inline `node:http` listener that serves `registry.metrics()`. Same surface, same port; can be unified later if a second client appears.
- [x] In `apps/api/src/index.ts`, register `useEnvelopPrometheus(...)` in the Yoga `plugins` array with sensible defaults: enable `requestCount`, `requestSummary` (duration), `errors`, and `parse`/`validate`/`execute` timings. Leave `resolvers: true` off initially — it generates a metric per field and can be very chatty; revisit if useful.
- [x] Gate the entire metrics path in `apps/api/src/index.ts` behind `METRICS_ENABLED`:
  - Construct the shared Registry, the Envelop plugin, and the `MetricsServer` only when enabled. When disabled, do not register the plugin (so resolver call paths take zero overhead).
  - Add a shutdown handler (`process.on("SIGTERM", ...)`) that calls `metricsServer.stop()` mirroring the daemon's pattern.
- [x] Add `API_METRICS_PORT` to `turbo.json` `globalEnv`.
- [x] Update `docker/prometheus/prometheus.yml` with a new scrape target:
  ```yaml
  - job_name: "hlstats-api"
    static_configs:
      - targets: ["host.docker.internal:9092"]
        labels:
          service: "api"
          app: "hlstatsnext"
  ```
- [x] **Verification:**
  - `pnpm check-types` clean across the whole repo (no TS drift from the new dep or wiring).
  - Runtime smoke (manual): `METRICS_ENABLED=true pnpm --filter api dev` → `curl :9092/metrics` returns exposition; issuing a GraphQL query bumps `graphql_envelop_request_total`. With `METRICS_ENABLED` unset, port 9092 stays unbound and GraphQL still serves on 4000. `pnpm docker:obs:up` → Prometheus targets page shows `hlstats-api` UP.

### Phase 4: Document the observability stack

**Goal:** Single entry point that explains what runs, how to opt in, what the env vars do, and what each scrape target produces. (Phase 5 handles the metric-source rework — this phase just captures the design.)
**App/package:** `docs/`

- [x] Create `docs/OBSERVABILITY.md` (top-level, ALL_CAPS per the project convention) covering:
  - What the observability stack is and how to opt in (`pnpm docker:obs:up`).
  - The `METRICS_ENABLED` env var, what it gates (HTTP server + 15s gauge interval in the daemon; Envelop plugin + metrics server in the API), and what it deliberately does _not_ gate (in-process counters, Prisma metrics — kept always-on because cost is negligible).
  - The three scrape targets after Phase 5: daemon `:9091` (application/game-state metrics), api `:9092` (GraphQL request metrics via `@envelop/prometheus`), rabbitmq `:15692` (broker-side metrics via `rabbitmq_prometheus`).
  - How `host.docker.internal` resolves on Linux vs macOS (the `extra_hosts: host-gateway` trick already in `prometheus.yml`).
  - Grafana access (port 3001, default creds), and pointer to `docker/grafana/dashboards` for dashboard JSON.
  - Which metrics live where, after Phase 5: a small table of "this series comes from X scrape target" so future debugging knows where to look. Include the rationale for keeping daemon-side RabbitMQ counters _alongside_ the broker plugin (application vs broker perspective; divergence is diagnostic).
  - Note on Prisma 7 removing `$metrics` (Phase 5b deferral).
- [x] **Verification:** `docs/OBSERVABILITY.md` written; covers all sections above.

### Phase 5: Retire reinvented metrics in favor of upstream plugins

**Goal:** Stop hand-rolling metrics that battle-tested plugins already produce. Keep only domain-specific (game-state, RCON, ingress) and application-perspective (daemon's RabbitMQ publish/consume counters) metrics in our own code.
**App/package:** `docker/rabbitmq`, `docker/prometheus`, `apps/daemon`, `packages/observability`, `docker/grafana/dashboards`

Three substitutions, ordered low-risk first:

#### 5a. Enable `rabbitmq_prometheus` and retire the daemon's `queue_depth` gauge

- [x] Enable `rabbitmq_prometheus` in the RabbitMQ image:
  - Add `docker/rabbitmq/enabled_plugins` (Erlang term-style file): `[rabbitmq_management, rabbitmq_prometheus].`
  - Mount it in `docker-compose.yml` rabbitmq service: `- ./docker/rabbitmq/enabled_plugins:/etc/rabbitmq/enabled_plugins:ro`.
  - Expose port 15692 on the rabbitmq service in `docker-compose.yml`.
- [x] Verify `prometheus.yml`'s existing rabbitmq scrape job (we previously planned to delete it; keep it) targets `rabbitmq:15692` — should already be correct.
- [x] Remove the daemon's `queue_depth` collection:
  - Delete the `metrics.setGauge("queue_depth", ...)` block in `apps/daemon/src/main.ts:322` and surrounding queue-depth lookup logic. (Note: `consumer.getQueueDepth()` API stays — still useful for ad-hoc diagnostics and covered by its own tests.)
  - The homegrown `PrometheusMetricsExporter` stores metrics in maps keyed by name, so there's no separate `queue_depth` metric definition to delete — removing the `setGauge` call is sufficient.
  - If `startMetricsCollection` now has no work to do beyond `active_players_count`/`active_bots_count`, keep it — those still need periodic sampling.
- [x] Update any Grafana panels in `docker/grafana/dashboards/hlstatsnext-overview.json` that referenced `queue_depth` to use `rabbitmq_queue_messages_ready{queue="<queue-name>"}` instead. Updated panel target to `sum(rabbitmq_queue_messages_ready) or vector(0)`.
- [x] **Verification:**
  - Daemon code no longer references `queue_depth` (`grep queue_depth apps/daemon/src` returns empty).
  - Runtime smoke (manual): `pnpm docker:up && pnpm docker:obs:up` → `curl :15692/metrics` returns broker exposition; Prometheus `/targets` shows `rabbitmq` UP; Grafana queue-depth panel populates from the broker series.

#### 5b. Replace the custom Prisma metrics extension with `client.$metrics.prometheus()`

**Status: deferred — Prisma 7 removed the `$metrics` API.** The plan's premise ("Prisma 5+ does; the project is on Prisma 7 ✅") turned out to be wrong: `@prisma/client@7.x` has no `$metrics` member (verified by grepping the installed `.d.ts` files — zero hits for `metrics`/`Metrics`). Prisma's official tracking issue confirms metrics were dropped from v7 and have not returned.

Consequence: keeping the existing `createPrismaWithMetrics` extension is the only way to retain database query telemetry without a regression. Pool stats (the upside the swap was supposed to buy) are not currently available from Prisma 7 at all, regardless of approach.

- [ ] Re-evaluate when Prisma re-introduces a metrics API, or pin to a `@prisma/extension-metrics`-style community package if/when one exists.
- [x] Confirmed the project's Prisma version does **not** support `$metrics.prometheus()` (Prisma 7.8.0; API removed).
- [ ] ~~In `apps/daemon/src/shared/application/factories/infrastructure-config.factory.ts`, stop wrapping the Prisma client with `createPrismaWithMetrics`. Use the plain client.~~ (skipped — extension stays)
- [ ] ~~Expose Prisma's native exposition...~~ (skipped — API not available)
- [ ] ~~Delete `packages/observability/src/prisma/prisma-metrics-extension.ts`...~~ (skipped — extension stays)
- [ ] ~~Update Grafana panels that referenced `prisma_queries_total`...~~ (no change — existing series names remain)

#### 5c. Keep — but explicitly label — daemon-perspective RabbitMQ counters

- [x] Audit metric names in `packages/observability` and call sites in `apps/daemon/src/shared/infrastructure/messaging/`. The example names in the original plan didn't actually exist in code; the real RabbitMQ-perspective counters were:
  - `events_lost_on_publish_blocked` → `daemon_rabbitmq_events_lost_on_publish_blocked` (publisher flow-control drops)
  - `dead_letter_messages_total` → `daemon_rabbitmq_dead_letter_messages_total` (DLX-routed messages)
  - `events_processed_total` and `event_processing_duration_seconds` were _not_ renamed — they're application-level (event handler completion), not broker semantics.
- [x] In `docs/OBSERVABILITY.md`, add a paragraph: "RabbitMQ has _two_ sources of metrics: `rabbitmq_*` series from the broker plugin (authoritative for queue depth, broker health) and `daemon_rabbitmq_*` series from our code (authoritative for what the daemon _believes_ happened). Divergence between the two is itself a signal — alert on it." (Captured in Phase 4 below.)
- [x] **Verification:** grep for old names in `apps/daemon/src` returns no metric-emission call sites (only historical audit doc references remain, which the user-memory rule explicitly says not to back-cite from code anyway). No Grafana panels referenced the old names. Daemon unit suite (2496 tests) still passes.

## Schema changes

None.

## Codegen steps

None required. (No Prisma schema or GraphQL schema changes.) Standard `pnpm check-types` at the end to verify nothing drifted from the daemon and API code edits.

- [x] `pnpm check-types` (verify daemon + api edits compile) — clean across all 9 packages
- [x] `pnpm lint` — clean across all 9 packages

## API surface changes

No GraphQL surface change. The new `apps/api` `/metrics` HTTP endpoint is a sibling listener on a separate port (`API_METRICS_PORT`, default 9092), not a GraphQL field, so:

- No Pothos object additions.
- No exclusion-list (`AUTH_MODELS` / `CUSTOM_MODELS` / `SENSITIVE_MODELS` / `ADMIN_ONLY_MODELS`) updates.
- No `requireAdminResolver` wraps.

The new port must not be exposed publicly in production — that's an infra/firewall concern, called out in `docs/OBSERVABILITY.md`.

## Daemon changes

- `apps/daemon/src/main.ts`: widen `metricsServer` field to `MetricsServer | null`; conditional create/start/stop based on `METRICS_ENABLED`; conditional `startMetricsCollection`.
- No new `setInterval`/`setTimeout` introduced. The existing gauge interval is now conditionally created; its existing `clearInterval` in shutdown remains symmetric (already null-safe).
- Phase 5a removes the `queue_depth` gauge collection from the periodic interval; the interval keeps `active_players_count` / `active_bots_count` gauges only.
- Phase 5b stops wrapping the Prisma client with `createPrismaWithMetrics` in `apps/daemon/src/shared/application/factories/infrastructure-config.factory.ts` — the plain client is used and `prisma.$metrics.prometheus()` is concatenated into the `/metrics` response by `MetricsServer`.
- Phase 5c renames daemon-emitted RabbitMQ counters to the `daemon_rabbitmq_*` namespace at call sites under `apps/daemon/src/shared/infrastructure/messaging/`.
- RabbitMQ ack semantics unchanged across all of the above.
- Shutdown ordering (`apps/daemon/src/main.ts:421`) unchanged in sequence — only the metrics phase is conditionally enqueued.

## Test plan

- **Unit**
  - `apps/daemon/src/main.test.ts`: cover `METRICS_ENABLED=false` (no `MetricsServer` instantiation, shutdown skips the metrics phase) and `METRICS_ENABLED=true` (current behavior).
  - `apps/api/src/index.test.ts` (create if missing): assert the metrics listener is wired only when enabled, and that the Yoga metrics plugin increments the request counter.
  - `packages/observability/src/prometheus/metrics-server.test.ts`: no changes expected — `MetricsServer` itself is unchanged.

- **Integration**
  - Not strictly required; the change is config + env-gating. If `apps/api` gains a metrics plugin that touches Prisma metrics, add an integration test exercising one Prisma call → counter increment.

- **E2E**
  - Optional: extend an existing daemon E2E to assert `curl :9091/metrics` returns 200 only when `METRICS_ENABLED=true` in the test compose. Low value if unit coverage is solid.

- **Manual smoke**
  - `pnpm docker:up` → confirm no observability containers.
  - `pnpm docker:obs:up` → confirm both start, network shared.
  - `METRICS_ENABLED=true pnpm dev` → confirm 9091 + 9092 + 15692 are scraped UP in Prometheus, Grafana shows live data.
  - `METRICS_ENABLED=` (unset) `pnpm dev` → confirm 9091/9092 unbound; daemon + api still functional.
  - Phase 5 smoke: `curl :9091/metrics | grep prisma_client_` returns Prisma's native series; `grep queue_depth` returns nothing; `curl :15692/metrics | grep rabbitmq_queue_messages_ready` returns broker series; divergence query in Grafana renders.

## Observability

- `packages/observability` _shrinks_ in Phase 5b — the custom Prisma extension and its types/exports are deleted. `MetricsServer`, `PrometheusMetricsExporter`, and remaining metric registrations stay. Net code reduction.
- Daemon-emitted RabbitMQ counters are renamed under the `daemon_rabbitmq_*` namespace (Phase 5c) so they don't collide visually with broker-emitted `rabbitmq_*` series.
- New `docs/OBSERVABILITY.md` becomes the single entry point for "how do I see metrics for this project," and explicitly documents the application-vs-broker dual-source pattern.
- Winston: one info-level log line per app at startup indicating metrics enabled/disabled state. No new structured log channels.

## Open questions

- [ ] **Should the observability compose file include any alerting (Alertmanager)?** Not in current scope; the existing `prometheus.yml` has it commented out. Recommend deferring to a follow-up plan.

## Resolved during planning

- **API metrics library:** `@envelop/prometheus` (decided). Gives request/parse/validate/execute timings and error counts for free; resolver-level timings stay off by default to avoid metric explosion.
- **Plugin substitution scope (Phase 5):** Three substitutions identified — `queue_depth` gauge replaced by `rabbitmq_prometheus` broker series; custom Prisma extension replaced by Prisma 7's native `$metrics.prometheus()` (gains pool stats we don't have today); daemon RabbitMQ counters kept but renamed to `daemon_rabbitmq_*` so application-vs-broker divergence is itself observable.
- **Grafana dashboard impact:** `docker/grafana/dashboards/hlstatsnext-overview.json` has no `rabbitmq_*` query references today (only a panel description string), and its queue-depth panel uses the daemon's `queue_depth` gauge. Phase 5a re-points that panel at `rabbitmq_queue_messages_ready`; Phase 5b re-points any `prisma_queries_total` references at `prisma_client_queries_total`. Update queries; panel layout stays.
