/**
 * Common types for observability package
 */

/**
 * Logger interface compatible with common logging libraries
 */
export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

export interface DatabaseQueryMetric {
  query: string
  operation: string // SELECT, INSERT, UPDATE, DELETE
  table: string
  duration: number
  timestamp: number
  success: boolean
  error?: string
}

export interface PrometheusMetric {
  name: string
  type: "counter" | "gauge" | "histogram" | "summary"
  help: string
  value: number | Record<string, number>
  labels?: Record<string, string>
}

export interface PrismaQueryInfo {
  model: string
  action: string
  duration: number
  query: string
  success: boolean
  error?: string
}
