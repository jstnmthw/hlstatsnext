/**
 * Prisma Metrics Extension Factory
 *
 * Provides a factory function to create a properly-typed Prisma client
 * extension for metrics collection, avoiding unsafe type casts.
 *
 * This follows the recommended Prisma pattern for type-safe extensions.
 */

import type { PrismaClient } from "@repo/database/client"
import type { ILogger, PrismaQueryInfo } from "../types"
import type { PrometheusMetricsExporter } from "../prometheus/prometheus-metrics-exporter"

export interface PrismaMetricsOptions {
  logSlowQueries?: boolean
  slowQueryThresholdMs?: number
  logAllQueries?: boolean
}

/**
 * Create a Prisma client with metrics collection extension
 *
 * This factory function follows Prisma's recommended pattern for type-safe extensions.
 * It returns a properly-typed extended client without any unsafe casts.
 *
 * @example
 * ```typescript
 * const prismaWithMetrics = createPrismaWithMetrics(
 *   new PrismaClient(),
 *   metricsExporter,
 *   logger,
 *   { logSlowQueries: true }
 * )
 *
 * // Use the extended client with full type safety
 * await prismaWithMetrics.user.findMany()
 * ```
 */
export function createPrismaWithMetrics(
  prismaClient: PrismaClient,
  metrics: PrometheusMetricsExporter,
  logger: ILogger,
  options: PrismaMetricsOptions = {},
): ReturnType<PrismaClient["$extends"]> {
  const { logSlowQueries = false, slowQueryThresholdMs = 1000, logAllQueries = false } = options

  const extendedClient = prismaClient.$extends({
    name: "prisma-metrics",
    query: {
      async $allOperations({
        operation,
        model,
        args,
        query,
      }: {
        operation: string
        model?: string
        args: unknown
        query: (args: unknown) => Promise<unknown>
      }) {
        const startTime = Date.now()
        let success = true
        let error: string | undefined

        try {
          const result = await query(args)
          return result
        } catch (err) {
          success = false
          error = err instanceof Error ? err.message : String(err)
          throw err
        } finally {
          const duration = Date.now() - startTime
          const modelName = model || "unknown"

          // Record metrics
          recordQueryMetrics(
            {
              model: modelName,
              action: operation,
              duration,
              query: formatQuery({ model: modelName, action: operation, args }),
              success,
              error,
            },
            metrics,
          )

          // Log slow queries
          if (logSlowQueries && duration > slowQueryThresholdMs) {
            logger.warn("Slow database query detected", {
              model: modelName,
              action: operation,
              duration,
              query: formatQuery({ model: modelName, action: operation, args }),
              threshold: slowQueryThresholdMs,
            })
          }

          // Log all queries if enabled (debug mode)
          if (logAllQueries) {
            logger.debug("Database query executed", {
              model: modelName,
              action: operation,
              duration,
              success,
            })
          }
        }
      },
    },
  })

  logger.info("Prisma metrics extension registered", {
    logSlowQueries,
    slowQueryThresholdMs,
    logAllQueries,
  })

  return extendedClient
}

/**
 * Export the type of the extended Prisma client
 * This can be used in other parts of the application for type safety
 */
export type PrismaWithMetrics = ReturnType<typeof createPrismaWithMetrics>

/**
 * Record query metrics in Prometheus format
 */
function recordQueryMetrics(info: PrismaQueryInfo, metrics: PrometheusMetricsExporter): void {
  // Determine operation type (SELECT, INSERT, UPDATE, DELETE)
  const operation = getOperationType(info.action)

  // Record in Prometheus exporter
  metrics.recordDatabaseQuery({
    query: info.query,
    operation,
    table: info.model,
    duration: info.duration,
    timestamp: Date.now(),
    success: info.success,
    error: info.error,
  })

  // Also record standard metrics
  metrics.incrementCounter("prisma_queries_total", {
    model: info.model,
    action: info.action,
    success: info.success.toString(),
  })

  metrics.recordHistogram(
    "prisma_query_duration_ms",
    {
      model: info.model,
      action: info.action,
    },
    info.duration,
  )
}

/**
 * Map Prisma action to SQL operation
 */
function getOperationType(action: string): string {
  const actionLower = action.toLowerCase()

  if (actionLower.includes("find") || actionLower.includes("count")) {
    return "SELECT"
  }
  if (actionLower.includes("create")) {
    return "INSERT"
  }
  if (actionLower.includes("update") || actionLower.includes("upsert")) {
    return "UPDATE"
  }
  if (actionLower.includes("delete")) {
    return "DELETE"
  }

  return "OTHER"
}

/**
 * Format query parameters for logging
 */
function formatQuery(params: { model: string; action: string; args: unknown }): string {
  const { model, action, args } = params

  // Create a readable query representation
  const parts = [`${model}.${action}`]

  if (args && typeof args === "object" && args !== null) {
    const argsObj = args as Record<string, unknown>

    // Add where clause if present
    if (argsObj.where) {
      const whereStr = JSON.stringify(argsObj.where)
      parts.push(`WHERE ${whereStr}`)
    }

    // Add select/include if present
    if (argsObj.select && typeof argsObj.select === "object") {
      parts.push(`SELECT ${Object.keys(argsObj.select as object).join(", ")}`)
    } else if (argsObj.include && typeof argsObj.include === "object") {
      parts.push(`INCLUDE ${Object.keys(argsObj.include as object).join(", ")}`)
    }

    // Add data for updates/creates
    if (argsObj.data && typeof argsObj.data === "object") {
      const dataKeys = Object.keys(argsObj.data as object)
      parts.push(`DATA [${dataKeys.length} fields]`)
    }
  }

  return parts.join(" ")
}
