# Observability

Prometheus + Grafana for hlstatsnext.com. **Everything in this stack is opt-in** — no developer pays for telemetry they don't use, and the daemon/API can run with zero metrics overhead.

## TL;DR

```bash
pnpm docker:up                  # core stack: db, rabbitmq
pnpm docker:obs:up              # start Prometheus + Grafana (separate compose)
METRICS_ENABLED=true pnpm dev   # turn on app-side metrics scrape targets
# Grafana: http://localhost:3001 (admin / admin)
# Prometheus: http://localhost:9090
```

When `METRICS_ENABLED` is unset or false:

- Daemon does **not** bind port 9091 and does **not** run the 15-second gauge collection interval. In-process counters stay wired but effectively no-op (their cost is negligible).
- API does **not** bind port 9092 and does **not** register the `@envelop/prometheus` Yoga plugin (so GraphQL resolver paths take zero overhead).

This means you can run the observability containers continuously without forcing every dev session to pay for app-side scraping.

## What runs where

| Surface             | Source                                                                                   |  Port | Gated by `METRICS_ENABLED`                   |
| ------------------- | ---------------------------------------------------------------------------------------- | ----: | -------------------------------------------- |
| Prometheus          | `docker-compose.observability.yml` → `prom/prometheus`                                   |  9090 | No (compose is itself opt-in)                |
| Grafana             | `docker-compose.observability.yml` → `grafana/grafana`                                   |  3001 | No                                           |
| Daemon `/metrics`   | `apps/daemon` (via `@repo/observability` `MetricsServer`)                                |  9091 | **Yes**                                      |
| API `/metrics`      | `apps/api` (inline `node:http` listener; `@envelop/prometheus` + `prom-client` Registry) |  9092 | **Yes**                                      |
| RabbitMQ `/metrics` | `rabbitmq_prometheus` broker plugin                                                      | 15692 | No (broker plugin is always on once enabled) |

The compose layering is deliberate: the main `docker-compose.yml` boots only the data-plane services (db, rabbitmq) that the daemon and API need to function. The observability stack lives in `docker-compose.observability.yml` and attaches to the same `hlstatsnext-network` bridge so it can scrape `rabbitmq:15692` and reach host processes via `host.docker.internal`.

### Host-vs-container networking

Prometheus is in a container; the daemon and API typically run on the host during development. The `prometheus` service in `docker-compose.observability.yml` declares `extra_hosts: ["host.docker.internal:host-gateway"]` so Linux containers can resolve the host the same way macOS/Windows do out of the box. The scrape jobs in `docker/prometheus/prometheus.yml` use `host.docker.internal:9091` (daemon) and `host.docker.internal:9092` (api) for this reason. If you containerize the daemon or API later, swap those targets for the service hostnames.

## Env vars

| Var                      | Default | Effect                                                                                                                                                                                                                                                    |
| ------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `METRICS_ENABLED`        | `false` | Master switch for app-side metrics. Accepts `true`/`1`/`yes`/`on` (case-insensitive). When off, the daemon's `MetricsServer` and gauge interval are never constructed, and the API skips registering the Envelop plugin and binding its metrics listener. |
| `METRICS_PORT`           | `9091`  | Daemon metrics HTTP port. Only consulted when `METRICS_ENABLED=true`.                                                                                                                                                                                     |
| `API_METRICS_PORT`       | `9092`  | API metrics HTTP port. Only consulted when `METRICS_ENABLED=true`.                                                                                                                                                                                        |
| `GRAFANA_ADMIN_USER`     | `admin` | Grafana initial admin user.                                                                                                                                                                                                                               |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana initial admin password. Change in any shared environment.                                                                                                                                                                                         |

All four are declared in `turbo.json#globalEnv` so Turbo's cache invalidates correctly when they change.

## Production note

`METRICS_PORT` and `API_METRICS_PORT` must **not** be exposed publicly — the metrics endpoints carry operational telemetry. Lock them to a private network/ACL or bind them to localhost in deployment configs. The GraphQL endpoint stays on its normal public port; the metrics listener is a separate `node:http` server on its own port for exactly this reason.

## Metric provenance

A small table of "if I see series X, where did it come from?" — useful when a panel is empty.

| Series prefix / name                                                                            | Origin                                                      | Scrape target               |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------- |
| `process_*`, `nodejs_*`                                                                         | `prom-client` default metrics (API only)                    | `host.docker.internal:9092` |
| `process_resident_memory_bytes`, `process_heap_bytes`, `process_uptime_seconds`                 | Homegrown `PrometheusMetricsExporter` (daemon)              | `host.docker.internal:9091` |
| `graphql_envelop_*`                                                                             | `@envelop/prometheus` (API)                                 | `host.docker.internal:9092` |
| `events_processed_total`, `event_processing_duration_seconds`                                   | Daemon event handler completion (application-level)         | `host.docker.internal:9091` |
| `udp_packets_dropped_total`                                                                     | Daemon ingress                                              | `host.docker.internal:9091` |
| `active_players_count`, `active_bots_count`                                                     | Daemon gauge interval (15 s)                                | `host.docker.internal:9091` |
| `daemon_rabbitmq_events_lost_on_publish_blocked`                                                | Daemon publisher when broker is in flow control             | `host.docker.internal:9091` |
| `daemon_rabbitmq_dead_letter_messages_total`                                                    | Daemon DLX consumer                                         | `host.docker.internal:9091` |
| `database_queries_total`, `database_query_duration_seconds` (labelled by `operation` + `table`) | Daemon Prisma metrics extension (`createPrismaWithMetrics`) | `host.docker.internal:9091` |
| `rabbitmq_*` (incl. `rabbitmq_queue_messages_ready`, `rabbitmq_channel_*`)                      | `rabbitmq_prometheus` broker plugin                         | `rabbitmq:15692`            |

### Why two RabbitMQ sources?

RabbitMQ has **two** sources of metrics:

- `rabbitmq_*` series from the broker plugin — authoritative for queue depth, broker health, channel-level publish/consume rates from the broker's perspective.
- `daemon_rabbitmq_*` series from our own code — authoritative for what the daemon _believes_ happened (publishes it attempted, DLX-routed messages it saw on a dedicated DLX consumer).

Divergence between the two is itself a signal: it usually means the daemon thinks it did something the broker didn't accept, or vice versa. Alert on it. Example PromQL:

```promql
# Publishes the daemon attempted vs. what the broker reports accepting
rate(rabbitmq_channel_messages_published_total[5m])
  - rate(daemon_rabbitmq_events_lost_on_publish_blocked[5m])
```

(Exact broker series name depends on the `rabbitmq_prometheus` version — check `curl :15692/metrics | grep messages_published`.)

## Why the custom Prisma extension is still in use

Prisma 5+ briefly exposed `client.$metrics.prometheus()` natively. **Prisma 7 removed that API.** Until upstream restores it (or a community `@prisma/extension-metrics` lands), we keep the homegrown `createPrismaWithMetrics` extension in `packages/observability/`. It emits `database_queries_total` / `database_query_duration_seconds`, labelled by `operation` (SELECT/INSERT/UPDATE/DELETE) + `table`, and feeds the same data into the `/query-stats` endpoint (p50/p95/p99, slow + failed queries). Pool stats are not available from Prisma 7 at all — use a `mysqld_exporter` (`Threads_connected`/`Threads_running`) if you need connection-pool visibility.

> The extension previously also emitted a parallel `prisma_queries_total` / `prisma_query_duration_ms` family labelled by `model` + `action`. That was dropped — it duplicated `database_*` (model ≈ table) at higher cardinality, and no dashboard or alert consumed it. The `action`-level granularity (e.g. `findUnique` vs `count`) is no longer exported; reconstruct it from query logs if ever needed.

## Dashboards

Provisioned JSON lives at `docker/grafana/dashboards/`. The `hlstatsnext-overview.json` dashboard is loaded automatically by Grafana via `docker/grafana/provisioning/`. Edits made in the Grafana UI are not persisted to disk — export and replace the JSON in the dashboards directory to commit changes.

## Alertmanager

Not yet wired. The `alerting:` block in `docker/prometheus/prometheus.yml` is commented out as a future hook. Tracked separately from this opt-in work.
