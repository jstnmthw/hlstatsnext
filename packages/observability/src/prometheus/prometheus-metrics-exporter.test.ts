import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ILogger } from "../types"
import { PrometheusMetricsExporter } from "./prometheus-metrics-exporter"

describe("PrometheusMetricsExporter", () => {
  let exporter: PrometheusMetricsExporter
  let mockLogger: ILogger

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }
    exporter = new PrometheusMetricsExporter(mockLogger)
  })

  describe("counters", () => {
    it("should increment counter without labels", () => {
      exporter.incrementCounter("test_counter")
      exporter.incrementCounter("test_counter")

      const metrics = exporter.exportMetrics()

      expect(metrics).toContain("# TYPE test_counter counter")
      expect(metrics).toContain("test_counter 2")
    })

    it("should increment counter with labels", () => {
      exporter.incrementCounter("http_requests", { method: "GET", status: "200" })
      exporter.incrementCounter("http_requests", { method: "GET", status: "200" })
      exporter.incrementCounter("http_requests", { method: "POST", status: "201" })

      const metrics = exporter.exportMetrics()

      expect(metrics).toContain('http_requests{method="GET",status="200"} 2')
      expect(metrics).toContain('http_requests{method="POST",status="201"} 1')
    })

    it("should increment counter by specified value", () => {
      exporter.incrementCounter("bytes_processed", {}, 1024)
      exporter.incrementCounter("bytes_processed", {}, 2048)

      const metrics = exporter.exportMetrics()

      expect(metrics).toContain("bytes_processed 3072")
    })
  })

  describe("gauges", () => {
    it("should set gauge value", () => {
      exporter.setGauge("active_connections", {}, 42)

      const metrics = exporter.exportMetrics()

      expect(metrics).toContain("# TYPE active_connections gauge")
      expect(metrics).toContain("active_connections 42")
    })

    it("should set gauge with labels", () => {
      exporter.setGauge("memory_usage", { type: "heap" }, 1024)
      exporter.setGauge("memory_usage", { type: "rss" }, 2048)

      const metrics = exporter.exportMetrics()

      expect(metrics).toContain('memory_usage{type="heap"} 1024')
      expect(metrics).toContain('memory_usage{type="rss"} 2048')
    })

    it("should overwrite gauge value", () => {
      exporter.setGauge("temperature", {}, 20)
      exporter.setGauge("temperature", {}, 25)

      const metrics = exporter.exportMetrics()

      expect(metrics).toContain("temperature 25")
      expect(metrics).not.toContain("temperature 20")
    })
  })

  describe("histograms", () => {
    it("should record histogram values", () => {
      exporter.recordHistogram("request_duration", {}, 0.001)
      exporter.recordHistogram("request_duration", {}, 0.05)
      exporter.recordHistogram("request_duration", {}, 0.5)

      const metrics = exporter.exportMetrics()

      expect(metrics).toContain("# TYPE request_duration histogram")
      expect(metrics).toContain("request_duration_count 3")
      expect(metrics).toContain("request_duration_sum")
      expect(metrics).toContain("request_duration_bucket")
    })

    it("should calculate histogram buckets correctly", () => {
      // Add values that span different buckets
      exporter.recordHistogram("latency", {}, 0.001) // <= 0.001
      exporter.recordHistogram("latency", {}, 0.002) // <= 0.005
      exporter.recordHistogram("latency", {}, 0.1) // <= 0.1
      exporter.recordHistogram("latency", {}, 1) // <= 1

      const metrics = exporter.exportMetrics()

      // Check bucket counts are cumulative
      expect(metrics).toContain('latency_bucket{le="0.001"} 1')
      expect(metrics).toContain('latency_bucket{le="0.005"} 2')
      expect(metrics).toContain('latency_bucket{le="0.1"} 3')
      expect(metrics).toContain('latency_bucket{le="1.0"} 4')
      expect(metrics).toContain('latency_bucket{le="+Inf"} 4')
    })

    it("should record histogram with labels", () => {
      exporter.recordHistogram("query_time", { database: "postgres" }, 0.01)
      exporter.recordHistogram("query_time", { database: "postgres" }, 0.02)

      const metrics = exporter.exportMetrics()

      expect(metrics).toContain('query_time_bucket{database="postgres",le="0.025"} 2')
      expect(metrics).toContain('query_time_count{database="postgres"} 2')
    })
  })

  describe("database queries", () => {
    it("should record database query metrics", () => {
      exporter.recordDatabaseQuery({
        query: "SELECT * FROM users",
        operation: "SELECT",
        table: "users",
        duration: 50,
        timestamp: Date.now(),
        success: true,
      })

      const metrics = exporter.exportMetrics()

      expect(metrics).toContain(
        'database_queries_total{operation="SELECT",success="true",table="users"}',
      )
      expect(metrics).toContain("database_query_duration_seconds")
    })

    it("should record failed queries", () => {
      exporter.recordDatabaseQuery({
        query: "INSERT INTO users",
        operation: "INSERT",
        table: "users",
        duration: 100,
        timestamp: Date.now(),
        success: false,
        error: "Constraint violation",
      })

      const metrics = exporter.exportMetrics()

      expect(metrics).toContain(
        'database_queries_total{operation="INSERT",success="false",table="users"}',
      )
    })

    it("should limit query history", () => {
      // Record more queries than the max history
      for (let i = 0; i < 10005; i++) {
        exporter.recordDatabaseQuery({
          query: `SELECT ${i}`,
          operation: "SELECT",
          table: "test",
          duration: 10,
          timestamp: Date.now(),
          success: true,
        })
      }

      const stats = exporter.getDatabaseQueryStats()

      expect(stats.totalQueries).toBeLessThanOrEqual(10000)
    })
  })

  describe("getDatabaseQueryStats", () => {
    beforeEach(() => {
      // Add varied test data
      exporter.recordDatabaseQuery({
        query: "SELECT * FROM users",
        operation: "SELECT",
        table: "users",
        duration: 50,
        timestamp: Date.now(),
        success: true,
      })
      exporter.recordDatabaseQuery({
        query: "SELECT * FROM posts",
        operation: "SELECT",
        table: "posts",
        duration: 100,
        timestamp: Date.now(),
        success: true,
      })
      exporter.recordDatabaseQuery({
        query: "INSERT INTO users",
        operation: "INSERT",
        table: "users",
        duration: 200,
        timestamp: Date.now(),
        success: true,
      })
      exporter.recordDatabaseQuery({
        query: "UPDATE users SET name",
        operation: "UPDATE",
        table: "users",
        duration: 1500, // Slow query
        timestamp: Date.now(),
        success: true,
      })
      exporter.recordDatabaseQuery({
        query: "DELETE FROM posts",
        operation: "DELETE",
        table: "posts",
        duration: 30,
        timestamp: Date.now(),
        success: false,
        error: "Foreign key constraint",
      })
    })

    it("should calculate total queries", () => {
      const stats = exporter.getDatabaseQueryStats()
      expect(stats.totalQueries).toBe(5)
    })

    it("should count queries by operation", () => {
      const stats = exporter.getDatabaseQueryStats()

      expect(stats.queriesByOperation.SELECT).toBe(2)
      expect(stats.queriesByOperation.INSERT).toBe(1)
      expect(stats.queriesByOperation.UPDATE).toBe(1)
      expect(stats.queriesByOperation.DELETE).toBe(1)
    })

    it("should count queries by table", () => {
      const stats = exporter.getDatabaseQueryStats()

      expect(stats.queriesByTable.users).toBe(3)
      expect(stats.queriesByTable.posts).toBe(2)
    })

    it("should identify slow queries", () => {
      const stats = exporter.getDatabaseQueryStats()

      expect(stats.slowQueries.length).toBe(1)
      expect(stats.slowQueries[0]?.duration).toBe(1500)
    })

    it("should identify failed queries", () => {
      const stats = exporter.getDatabaseQueryStats()

      expect(stats.failedQueries.length).toBe(1)
      expect(stats.failedQueries[0]?.error).toBe("Foreign key constraint")
    })

    it("should calculate percentiles", () => {
      const stats = exporter.getDatabaseQueryStats()

      expect(stats.averageDuration).toBeGreaterThan(0)
      expect(stats.p50Duration).toBeGreaterThanOrEqual(0)
      expect(stats.p95Duration).toBeGreaterThanOrEqual(stats.p50Duration)
      expect(stats.p99Duration).toBeGreaterThanOrEqual(stats.p95Duration)
    })

    it("should handle empty metrics", () => {
      const emptyExporter = new PrometheusMetricsExporter(mockLogger)
      const stats = emptyExporter.getDatabaseQueryStats()

      expect(stats.totalQueries).toBe(0)
      expect(stats.averageDuration).toBe(0)
      expect(stats.p50Duration).toBe(0)
      expect(stats.p95Duration).toBe(0)
      expect(stats.p99Duration).toBe(0)
      expect(stats.slowQueries).toEqual([])
      expect(stats.failedQueries).toEqual([])
    })
  })

  describe("clear", () => {
    it("should clear all metrics", () => {
      exporter.incrementCounter("test_counter")
      exporter.setGauge("test_gauge", {}, 42)
      exporter.recordHistogram("test_histogram", {}, 0.1)
      exporter.recordDatabaseQuery({
        query: "SELECT 1",
        operation: "SELECT",
        table: "test",
        duration: 10,
        timestamp: Date.now(),
        success: true,
      })

      exporter.clear()

      const metrics = exporter.exportMetrics()
      const stats = exporter.getDatabaseQueryStats()

      expect(metrics).not.toContain("database_query_duration_seconds")
      expect(stats.totalQueries).toBe(0)
    })
  })

  describe("exportMetrics", () => {
    it("should only contain process metrics when no user metrics added", () => {
      const metrics = exporter.exportMetrics()
      expect(metrics).toContain("process_resident_memory_bytes")
      expect(metrics).toContain("process_heap_bytes")
      expect(metrics).not.toContain("my_counter")
    })

    it("should include HELP and TYPE comments", () => {
      exporter.incrementCounter("my_counter")
      exporter.setGauge("my_gauge", {}, 1)

      const metrics = exporter.exportMetrics()

      expect(metrics).toContain("# HELP my_counter")
      expect(metrics).toContain("# TYPE my_counter counter")
      expect(metrics).toContain("# HELP my_gauge")
      expect(metrics).toContain("# TYPE my_gauge gauge")
    })

    it("should end with newline", () => {
      exporter.incrementCounter("test")

      const metrics = exporter.exportMetrics()

      expect(metrics.endsWith("\n")).toBe(true)
    })

    it("should sort labels alphabetically", () => {
      exporter.incrementCounter("test", { zebra: "1", alpha: "2" })

      const metrics = exporter.exportMetrics()

      expect(metrics).toContain('test{alpha="2",zebra="1"}')
    })
  })
})
