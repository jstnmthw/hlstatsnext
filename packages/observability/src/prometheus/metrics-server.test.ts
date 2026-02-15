import http from "node:http"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ILogger } from "../types"
import { MetricsServer } from "./metrics-server"
import { PrometheusMetricsExporter } from "./prometheus-metrics-exporter"

describe("MetricsServer", () => {
  let server: MetricsServer
  let mockMetrics: PrometheusMetricsExporter
  let mockLogger: ILogger
  let testPort: number

  beforeEach(() => {
    // Use a random port for testing
    testPort = 9100 + Math.floor(Math.random() * 900)

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }

    mockMetrics = new PrometheusMetricsExporter(mockLogger)
  })

  afterEach(async () => {
    if (server) {
      await server.stop()
    }
  })

  describe("start and stop", () => {
    it("should start the server successfully", async () => {
      server = new MetricsServer(mockMetrics, mockLogger, undefined, {
        port: testPort,
      })

      await server.start()

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Metrics server started",
        expect.objectContaining({
          port: testPort,
          host: "0.0.0.0",
        }),
      )
    })

    it("should stop the server successfully", async () => {
      server = new MetricsServer(mockMetrics, mockLogger, undefined, {
        port: testPort,
      })

      await server.start()
      await server.stop()

      expect(mockLogger.info).toHaveBeenCalledWith("Metrics server stopped")
    })

    it("should handle stop when server is not started", async () => {
      server = new MetricsServer(mockMetrics, mockLogger, undefined, {
        port: testPort,
      })

      // Should not throw
      await server.stop()
    })

    it("should use custom host when provided", async () => {
      server = new MetricsServer(mockMetrics, mockLogger, undefined, {
        port: testPort,
        host: "127.0.0.1",
      })

      await server.start()

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Metrics server started",
        expect.objectContaining({
          host: "127.0.0.1",
        }),
      )
    })
  })

  describe("endpoints", () => {
    beforeEach(async () => {
      server = new MetricsServer(mockMetrics, mockLogger, undefined, {
        port: testPort,
        host: "127.0.0.1",
      })
      await server.start()
    })

    const makeRequest = (
      path: string,
    ): Promise<{ statusCode: number; body: string; headers: http.IncomingHttpHeaders }> => {
      return new Promise((resolve, reject) => {
        http
          .get(`http://127.0.0.1:${testPort}${path}`, (res) => {
            let body = ""
            res.on("data", (chunk) => (body += chunk))
            res.on("end", () =>
              resolve({
                statusCode: res.statusCode || 500,
                body,
                headers: res.headers,
              }),
            )
          })
          .on("error", reject)
      })
    }

    describe("/metrics", () => {
      it("should return metrics in Prometheus format", async () => {
        mockMetrics.incrementCounter("test_metric", { label: "value" })

        const response = await makeRequest("/metrics")

        expect(response.statusCode).toBe(200)
        expect(response.headers["content-type"]).toContain("text/plain")
        expect(response.body).toContain("test_metric")
      })

      it("should only contain process metrics when none recorded", async () => {
        const response = await makeRequest("/metrics")

        expect(response.statusCode).toBe(200)
        expect(response.body).toContain("process_resident_memory_bytes")
        expect(response.body).toContain("process_heap_bytes")
      })
    })

    describe("/health", () => {
      it("should return health status with default values", async () => {
        const response = await makeRequest("/health")

        expect(response.statusCode).toBe(200)
        expect(response.headers["content-type"]).toContain("application/json")

        const health = JSON.parse(response.body)

        expect(health.status).toBe("healthy")
        expect(health.database).toBe(true)
        expect(health.rabbitmq).toBe(true)
        expect(typeof health.uptime).toBe("number")
        expect(health.timestamp).toBeDefined()
        expect(health.nodeVersion).toBeDefined()
      })

      it("should use custom health check function", async () => {
        await server.stop()

        const customHealthCheck = vi.fn().mockResolvedValue({
          status: "degraded",
          database: true,
          rabbitmq: false,
          uptime: 100,
        })

        server = new MetricsServer(mockMetrics, mockLogger, customHealthCheck, {
          port: testPort,
          host: "127.0.0.1",
        })
        await server.start()

        const response = await makeRequest("/health")

        expect(response.statusCode).toBe(503)

        const health = JSON.parse(response.body)

        expect(health.status).toBe("degraded")
        expect(health.rabbitmq).toBe(false)
        expect(customHealthCheck).toHaveBeenCalled()
      })

      it("should return 404 when health check is disabled", async () => {
        await server.stop()

        server = new MetricsServer(mockMetrics, mockLogger, undefined, {
          port: testPort,
          host: "127.0.0.1",
          enableHealthCheck: false,
        })
        await server.start()

        const response = await makeRequest("/health")

        expect(response.statusCode).toBe(404)
      })
    })

    describe("/query-stats", () => {
      it("should return database query statistics", async () => {
        mockMetrics.recordDatabaseQuery({
          query: "SELECT * FROM users",
          operation: "SELECT",
          table: "users",
          duration: 50,
          timestamp: Date.now(),
          success: true,
        })

        const response = await makeRequest("/query-stats")

        expect(response.statusCode).toBe(200)
        expect(response.headers["content-type"]).toContain("application/json")

        const stats = JSON.parse(response.body)

        expect(stats.totalQueries).toBe(1)
        expect(stats.queriesByOperation.SELECT).toBe(1)
        expect(stats.queriesByTable.users).toBe(1)
      })

      it("should return 404 when query stats is disabled", async () => {
        await server.stop()

        server = new MetricsServer(mockMetrics, mockLogger, undefined, {
          port: testPort,
          host: "127.0.0.1",
          enableQueryStats: false,
        })
        await server.start()

        const response = await makeRequest("/query-stats")

        expect(response.statusCode).toBe(404)
      })
    })

    describe("/", () => {
      it("should return HTML documentation", async () => {
        const response = await makeRequest("/")

        expect(response.statusCode).toBe(200)
        expect(response.headers["content-type"]).toContain("text/html")
        expect(response.body).toContain("HLStatsNext Metrics Server")
        expect(response.body).toContain("/metrics")
        expect(response.body).toContain("/health")
        expect(response.body).toContain("/query-stats")
      })
    })

    describe("404 handling", () => {
      it("should return 404 for unknown paths", async () => {
        const response = await makeRequest("/unknown")

        expect(response.statusCode).toBe(404)
        expect(response.headers["content-type"]).toContain("application/json")

        const body = JSON.parse(response.body)

        expect(body.error).toBe("Not Found")
        expect(body.path).toBe("/unknown")
        expect(body.availableEndpoints).toContain("/metrics")
      })
    })
  })

  describe("error handling", () => {
    it("should handle port already in use", async () => {
      // Start first server
      const server1 = new MetricsServer(mockMetrics, mockLogger, undefined, {
        port: testPort,
        host: "127.0.0.1",
      })
      await server1.start()

      // Try to start second server on same port
      const server2 = new MetricsServer(mockMetrics, mockLogger, undefined, {
        port: testPort,
        host: "127.0.0.1",
      })

      await expect(server2.start()).rejects.toThrow()

      await server1.stop()
    })

    it("should handle health check errors", async () => {
      const failingHealthCheck = vi.fn().mockRejectedValue(new Error("Health check failed"))

      server = new MetricsServer(mockMetrics, mockLogger, failingHealthCheck, {
        port: testPort,
        host: "127.0.0.1",
      })
      await server.start()

      const response = await new Promise<{ statusCode: number; body: string }>(
        (resolve, reject) => {
          http
            .get(`http://127.0.0.1:${testPort}/health`, (res) => {
              let body = ""
              res.on("data", (chunk) => (body += chunk))
              res.on("end", () => resolve({ statusCode: res.statusCode || 500, body }))
            })
            .on("error", reject)
        },
      )

      expect(response.statusCode).toBe(500)

      const body = JSON.parse(response.body)

      expect(body.error).toBe("Internal Server Error")
    })
  })
})
