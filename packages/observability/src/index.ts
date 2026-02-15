/**
 * @repo/observability - Shared observability utilities
 *
 * Provides Prometheus metrics collection, HTTP metrics server,
 * and Prisma database query monitoring for HLStatsNext applications.
 */

// Types
export type { DatabaseQueryMetric, ILogger, PrismaQueryInfo, PrometheusMetric } from "./types"

// Prometheus metrics
export { MetricsServer, type MetricsServerOptions } from "./prometheus/metrics-server"
export { PrometheusMetricsExporter } from "./prometheus/prometheus-metrics-exporter"

// Prisma extensions
export {
  createPrismaWithMetrics,
  type PrismaMetricsOptions,
  type PrismaWithMetrics,
} from "./prisma/prisma-metrics-extension"
