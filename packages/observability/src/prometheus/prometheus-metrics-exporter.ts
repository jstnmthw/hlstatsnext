/**
 * Prometheus Metrics Exporter
 *
 * Exports application and database metrics in Prometheus format.
 * Integrates with the existing EventMetrics system.
 */

import type { ILogger, DatabaseQueryMetric } from "../types"

export class PrometheusMetricsExporter {
  private counters = new Map<string, number>()
  private gauges = new Map<string, number>()
  private histograms = new Map<string, number[]>()
  private databaseQueries: DatabaseQueryMetric[] = []
  private readonly maxQueryHistory = 10000 // Keep last 10k queries

  constructor(logger: ILogger) {
    // Logger could be used for debugging metrics issues if needed
    if (logger) {
      // Available for future use
    }
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const key = this.getMetricKey(name, labels)
    this.counters.set(key, (this.counters.get(key) || 0) + value)
  }

  /**
   * Set a gauge metric (current value)
   */
  setGauge(name: string, labels: Record<string, string> = {}, value: number): void {
    const key = this.getMetricKey(name, labels)
    this.gauges.set(key, value)
  }

  /**
   * Record a histogram observation (for durations, sizes, etc.)
   */
  recordHistogram(name: string, labels: Record<string, string> = {}, value: number): void {
    const key = this.getMetricKey(name, labels)
    const values = this.histograms.get(key) || []
    values.push(value)
    this.histograms.set(key, values)
  }

  /**
   * Record a database query metric
   */
  recordDatabaseQuery(metric: DatabaseQueryMetric): void {
    this.databaseQueries.push(metric)

    // Keep only recent queries
    if (this.databaseQueries.length > this.maxQueryHistory) {
      this.databaseQueries.shift()
    }

    // Update counter metrics
    this.incrementCounter("database_queries_total", {
      operation: metric.operation,
      table: metric.table,
      success: metric.success.toString(),
    })

    // Update duration histogram
    this.recordHistogram(
      "database_query_duration_seconds",
      {
        operation: metric.operation,
        table: metric.table,
      },
      metric.duration / 1000, // Convert ms to seconds
    )
  }

  /**
   * Export metrics in Prometheus text format
   */
  exportMetrics(): string {
    const lines: string[] = []

    // Export counters
    for (const [key, value] of this.counters.entries()) {
      const { name, labels } = this.parseMetricKey(key)
      const labelStr = this.formatLabels(labels)

      if (!lines.find((l) => l.startsWith(`# HELP ${name}`))) {
        lines.push(`# HELP ${name} Total count of ${name}`)
        lines.push(`# TYPE ${name} counter`)
      }

      lines.push(`${name}${labelStr} ${value}`)
    }

    // Export gauges
    for (const [key, value] of this.gauges.entries()) {
      const { name, labels } = this.parseMetricKey(key)
      const labelStr = this.formatLabels(labels)

      if (!lines.find((l) => l.startsWith(`# HELP ${name}`))) {
        lines.push(`# HELP ${name} Current value of ${name}`)
        lines.push(`# TYPE ${name} gauge`)
      }

      lines.push(`${name}${labelStr} ${value}`)
    }

    // Export histograms
    for (const [key, values] of this.histograms.entries()) {
      const { name, labels } = this.parseMetricKey(key)
      const labelStr = this.formatLabels(labels)

      if (!lines.find((l) => l.startsWith(`# HELP ${name}`))) {
        lines.push(`# HELP ${name} Histogram of ${name}`)
        lines.push(`# TYPE ${name} histogram`)
      }

      // Calculate histogram buckets
      const buckets = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
      const counts = this.calculateBuckets(values, buckets)

      for (let i = 0; i < buckets.length; i++) {
        const bucket = buckets[i]
        const count = counts[i]
        if (bucket !== undefined && count !== undefined) {
          const bucketLabels = { ...labels, le: bucket.toString() }
          const bucketLabelStr = this.formatLabels(bucketLabels)
          lines.push(`${name}_bucket${bucketLabelStr} ${count}`)
        }
      }

      // Add +Inf bucket
      const infLabels = { ...labels, le: "+Inf" }
      const infLabelStr = this.formatLabels(infLabels)
      lines.push(`${name}_bucket${infLabelStr} ${values.length}`)

      // Add sum and count
      lines.push(`${name}_sum${labelStr} ${values.reduce((a, b) => a + b, 0)}`)
      lines.push(`${name}_count${labelStr} ${values.length}`)
    }

    return lines.join("\n") + "\n"
  }

  /**
   * Get database query statistics
   */
  getDatabaseQueryStats(): {
    totalQueries: number
    queriesByOperation: Record<string, number>
    queriesByTable: Record<string, number>
    slowQueries: DatabaseQueryMetric[]
    failedQueries: DatabaseQueryMetric[]
    averageDuration: number
    p50Duration: number
    p95Duration: number
    p99Duration: number
  } {
    const queriesByOperation: Record<string, number> = {}
    const queriesByTable: Record<string, number> = {}
    const durations = this.databaseQueries.map((q) => q.duration).sort((a, b) => a - b)

    for (const query of this.databaseQueries) {
      queriesByOperation[query.operation] = (queriesByOperation[query.operation] || 0) + 1
      queriesByTable[query.table] = (queriesByTable[query.table] || 0) + 1
    }

    const slowQueries = this.databaseQueries
      .filter((q) => q.duration > 1000) // > 1 second
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)

    const failedQueries = this.databaseQueries.filter((q) => !q.success).slice(-10)

    return {
      totalQueries: this.databaseQueries.length,
      queriesByOperation,
      queriesByTable,
      slowQueries,
      failedQueries,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length || 0,
      p50Duration: this.percentile(durations, 0.5),
      p95Duration: this.percentile(durations, 0.95),
      p99Duration: this.percentile(durations, 0.99),
    }
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clear(): void {
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
    this.databaseQueries = []
  }

  /**
   * Get metric key with labels
   */
  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",")

    return labelStr ? `${name}{${labelStr}}` : name
  }

  /**
   * Parse metric key back to name and labels
   */
  private parseMetricKey(key: string): { name: string; labels: Record<string, string> } {
    const match = key.match(/^([^{]+)(?:\{([^}]+)\})?$/)
    if (!match) {
      return { name: key, labels: {} }
    }

    const [, name, labelStr] = match
    const labels: Record<string, string> = {}

    if (labelStr && name) {
      const labelPairs = labelStr.match(/(\w+)="([^"]*)"/g) || []
      for (const pair of labelPairs) {
        const [labelName, labelValue] = pair.split("=")
        if (labelName && labelValue !== undefined) {
          labels[labelName] = labelValue.replace(/"/g, "")
        }
      }
      return { name, labels }
    }

    return { name: name || key, labels }
  }

  /**
   * Format labels for Prometheus output
   */
  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b))
    if (entries.length === 0) return ""

    const formatted = entries.map(([k, v]) => `${k}="${v}"`).join(",")
    return `{${formatted}}`
  }

  /**
   * Calculate histogram bucket counts
   */
  private calculateBuckets(values: number[], buckets: number[]): number[] {
    const counts: number[] = []

    for (const bucket of buckets) {
      counts.push(values.filter((v) => v <= bucket).length)
    }

    return counts
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0

    const index = Math.ceil(sortedValues.length * p) - 1
    const value = sortedValues[Math.max(0, index)]
    return value !== undefined ? value : 0
  }
}
