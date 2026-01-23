# Metrics and Observability Setup

This document explains how to use the metrics and observability features in HLStatsNext daemon.

## Overview

The HLStatsNext daemon includes a comprehensive metrics system built on:

- **Prometheus** - Time-series metrics collection and storage
- **Grafana** - Metrics visualization and dashboards
- **Prisma Middleware** - Automatic database query monitoring
- **HTTP Metrics Server** - Exposes metrics endpoints for scraping

## Quick Start

### 1. Start the Stack

The metrics infrastructure is included in the Docker Compose setup:

```bash
docker-compose up -d prometheus grafana
```

### 2. Start the Daemon

The daemon automatically exposes metrics on port 9091 (configurable via `METRICS_PORT` environment variable):

```bash
cd apps/daemon
pnpm dev
```

### 3. Access the Dashboards

- **Grafana**: http://localhost:3001
  - Default credentials: `admin` / `admin` (change on first login)
  - Pre-configured Prometheus datasource
  - Pre-built HLStatsNext Overview dashboard
  - _Note: Using port 3001 to avoid conflict with web app on port 3000_

- **Prometheus**: http://localhost:9090
  - Query interface for raw metrics
  - Useful for custom queries and debugging

- **Daemon Metrics**: http://localhost:9091
  - `/metrics` - Prometheus scrape endpoint (text format)
  - `/health` - Health check endpoint (JSON)
  - `/query-stats` - Database query statistics (JSON)
  - `/` - Documentation page with available endpoints

## Available Metrics

### Database Query Metrics

Automatically collected via Prisma middleware:

- **`database_queries_total`** (counter)
  - Labels: `operation`, `table`, `success`
  - Total number of database queries executed

- **`database_query_duration_seconds`** (histogram)
  - Labels: `operation`, `table`
  - Query execution duration with percentile buckets (p50, p95, p99)

- **`prisma_queries_total`** (counter)
  - Labels: `model`, `action`, `success`
  - Prisma-specific query counts

- **`prisma_query_duration_ms`** (histogram)
  - Labels: `model`, `action`
  - Query duration in milliseconds

### Event Processing Metrics

Track game event processing:

- **`events_processed_total`** (counter)
  - Labels: `event_type`, `module`
  - Number of events processed by type

- **`event_processing_duration_seconds`** (histogram)
  - Labels: `event_type`, `module`
  - Event processing latency

### Application Metrics

General daemon health and performance:

- **`active_players_count`** (gauge)
  - Current number of active players across all servers

- **`queue_depth`** (gauge)
  - Current depth of the RabbitMQ event queue

- **`process_resident_memory_bytes`** (gauge)
  - Process memory usage (RSS)

- **`process_heap_bytes`** (gauge)
  - Node.js heap memory usage

## Pre-built Grafana Dashboard

The included **HLStatsNext - Overview** dashboard provides:

1. **Events Processed per Second** - Real-time event processing rate
2. **Database Query Rate** - Queries per second by operation and table
3. **Database Query Duration (p95)** - 95th percentile query latency
4. **Database Query Duration (p99)** - 99th percentile query latency
5. **Slow Queries (> 1s)** - Count of queries exceeding 1 second
6. **Failed Queries** - Database query failure rate
7. **Queue Depth** - Event queue backlog
8. **Active Players** - Current player count
9. **Queries by Table** - Distribution of queries across tables (pie chart)
10. **Queries by Operation** - Distribution by SELECT/INSERT/UPDATE/DELETE (pie chart)
11. **Event Processing Duration (p95)** - Event handler performance
12. **Memory Usage** - Process and heap memory over time

## Configuration

### Environment Variables

Configure metrics behavior in your `.env` file:

```bash
# Metrics server port (default: 9091)
METRICS_PORT=9091

# Slow query threshold in milliseconds (default: 1000)
SLOW_QUERY_THRESHOLD_MS=1000

# Log all queries (useful for debugging, default: false)
LOG_ALL_QUERIES=false

# Prometheus retention period (default: 15d)
# Configured in docker/prometheus/prometheus.yml
```

### Prometheus Configuration

Located in `docker/prometheus/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: "hlstats-daemon"
    scrape_interval: 15s
    static_configs:
      - targets: ["host.docker.internal:9091"]
        labels:
          service: "daemon"
          app: "hlstatsnext"
```

### Grafana Provisioning

Dashboards and datasources are automatically provisioned on startup:

- **Datasources**: `docker/grafana/provisioning/datasources/prometheus.yml`
- **Dashboards**: `docker/grafana/provisioning/dashboards/default.yml`
- **Dashboard JSON**: `docker/grafana/dashboards/hlstatsnext-overview.json`

## Custom Queries

### Prometheus Query Examples

**Average query duration by table:**

```promql
rate(database_query_duration_seconds_sum[5m])
/
rate(database_query_duration_seconds_count[5m])
```

**Top 5 slowest queries:**

```promql
topk(5, histogram_quantile(0.99,
  rate(database_query_duration_seconds_bucket[5m])
))
```

**Query error rate:**

```promql
sum(rate(database_queries_total{success="false"}[5m]))
/
sum(rate(database_queries_total[5m]))
```

**Events per minute by type:**

```promql
rate(events_processed_total[1m]) * 60
```

## Monitoring Best Practices

### 1. Database Performance

Monitor these key indicators:

- **p95/p99 query duration** - Should stay below 100ms for most queries
- **Slow queries** - Investigate any queries exceeding 1 second
- **Failed queries** - Should be near zero under normal operation
- **Query distribution** - Identify hot tables and optimize indexes

### 2. Event Processing

Watch for:

- **Event processing rate** - Should match incoming game server traffic
- **Queue depth** - Persistent backlog indicates processing bottleneck
- **Processing duration** - Identify slow event handlers

### 3. System Resources

Keep an eye on:

- **Memory usage** - Watch for memory leaks (continuously growing RSS)
- **Active players** - Correlate with query load
- **Queue depth** - Should be near zero most of the time

### 4. Alerting

Consider setting up Prometheus alerts for:

- Query failure rate > 1%
- p99 query duration > 1 second
- Queue depth > 1000 messages for > 5 minutes
- Memory usage > 90% of available

## Troubleshooting

### Metrics Not Showing Up

1. **Check daemon is running and exposing metrics:**

   ```bash
   curl http://localhost:9091/metrics
   ```

2. **Verify Prometheus is scraping:**
   - Open http://localhost:9090/targets
   - Check that `hlstats-daemon` target is "UP"

3. **Check Prometheus logs:**
   ```bash
   docker-compose logs prometheus
   ```

### Slow Query Alerts

If you see slow query warnings in logs:

1. **Identify the query:**
   - Check logs for "Slow database query detected" messages
   - Look at `/query-stats` endpoint for detailed breakdown

2. **Analyze the query:**
   - Review the model, action, and where clauses
   - Check if proper indexes exist

3. **Optimize:**
   - Add database indexes
   - Reduce the data fetched (use `select` instead of fetching all fields)
   - Consider caching for frequently accessed data

### Grafana Dashboard Not Loading

1. **Check Grafana logs:**

   ```bash
   docker-compose logs grafana
   ```

2. **Verify provisioning:**
   - Dashboards should auto-load on first startup
   - Check `docker/grafana/provisioning/` directory exists and is mounted

3. **Manual import:**
   - Navigate to Grafana → Dashboards → Import
   - Upload `docker/grafana/dashboards/hlstatsnext-overview.json`

## Architecture

### Metrics Collection Flow

```
┌─────────────────┐
│  Daemon Process │
└────────┬────────┘
         │
         ├─────────────────────┐
         │                     │
         v                     v
┌──────────────┐    ┌────────────────────┐
│ Prisma Query │    │  Manual Metrics    │
│  Middleware  │    │ (Events, Players)  │
└──────┬───────┘    └────────┬───────────┘
       │                     │
       └─────────┬───────────┘
                 v
       ┌──────────────────────┐
       │ PrometheusMetrics    │
       │    Exporter          │
       └──────────┬───────────┘
                  │
                  v
       ┌──────────────────────┐
       │   Metrics Server     │
       │   (Port 9091)        │
       └──────────┬───────────┘
                  │ HTTP scrape every 15s
                  v
       ┌──────────────────────┐
       │    Prometheus        │
       │   (Port 9090)        │
       └──────────┬───────────┘
                  │ Query/Visualize
                  v
       ┌──────────────────────┐
       │     Grafana          │
       │   (Port 3000)        │
       └──────────────────────┘
```

### Key Components

1. **PrismaMetricsMiddleware** (`apps/daemon/src/database/prisma-metrics.middleware.ts`)
   - Intercepts all Prisma queries
   - Measures duration and tracks success/failure
   - Logs slow queries

2. **PrometheusMetricsExporter** (`apps/daemon/src/shared/infrastructure/observability/prometheus-metrics.ts`)
   - Stores metrics in memory
   - Formats metrics in Prometheus text format
   - Provides query statistics API

3. **MetricsServer** (`apps/daemon/src/shared/infrastructure/http/metrics-server.ts`)
   - HTTP server exposing metrics endpoints
   - Health check integration
   - Query statistics JSON API

4. **Infrastructure Factory** (`apps/daemon/src/shared/application/factories/infrastructure-config.factory.ts`)
   - Creates and wires up all metrics components
   - Registers Prisma middleware
   - Configures metrics exporter

## Adding Custom Metrics

To add your own application metrics:

```typescript
import type { PrometheusMetricsExporter } from "@/shared/infrastructure/observability/prometheus-metrics"

// Inject metrics from context
const metrics = context.metrics

// Record a counter
metrics.incrementCounter("my_custom_event_total", {
  event_type: "my_event",
  status: "success",
})

// Record a gauge (current value)
metrics.setGauge("my_queue_size", { queue: "my_queue" }, 42)

// Record a histogram (for latency/duration)
metrics.recordHistogram(
  "my_operation_duration_seconds",
  { operation: "my_op" },
  duration / 1000, // convert to seconds
)
```

## Performance Considerations

### Metrics Overhead

- **Prisma middleware**: ~1-2ms overhead per query (negligible)
- **Metrics storage**: In-memory, ~10KB per 1000 data points
- **HTTP scraping**: 15-second interval, minimal impact
- **Prometheus storage**: ~1-2 bytes per data point on disk

### Scaling

For high-traffic deployments:

1. **Increase Prometheus retention**: Edit `docker/prometheus/prometheus.yml`

   ```yaml
   command:
     - "--storage.tsdb.retention.time=30d" # Keep 30 days of data
   ```

2. **Adjust scrape interval**: Balance between resolution and overhead

   ```yaml
   scrape_interval: 30s # Reduce scraping frequency
   ```

3. **Use remote storage**: For long-term retention, consider Prometheus remote write to services like Grafana Cloud, Thanos, or Cortex

## Next Steps

- Explore the Grafana dashboard and customize panels
- Set up alerting rules in Prometheus
- Create custom dashboards for specific game modes or servers
- Integrate with existing monitoring infrastructure (Datadog, New Relic, etc.) via Prometheus remote write

## Support

For questions or issues with metrics setup:

- Review logs: `docker-compose logs daemon prometheus grafana`
- Check health endpoint: `curl http://localhost:9091/health`
- Verify Prometheus targets: http://localhost:9090/targets
