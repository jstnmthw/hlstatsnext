/**
 * @repo/observability - Shared observability utilities
 *
 * Provides Prometheus metrics collection, HTTP metrics server,
 * and Prisma database query monitoring for HLStatsNext applications.
 */

// Types
export type { ILogger, DatabaseQueryMetric, PrometheusMetric, PrismaQueryInfo } from "./types"

// Prometheus metrics
export { PrometheusMetricsExporter } from "./prometheus/prometheus-metrics-exporter"
export { MetricsServer, type MetricsServerOptions } from "./prometheus/metrics-server"

// Prisma extensions
export {
  createPrismaWithMetrics,
  type PrismaWithMetrics,
  type PrismaMetricsOptions,
} from "./prisma/prisma-metrics-extension"
