import type { PrismaClient } from "@repo/database/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PrometheusMetricsExporter } from "../prometheus/prometheus-metrics-exporter"
import type { ILogger } from "../types"
import { createPrismaWithMetrics } from "./prisma-metrics-extension"

describe("createPrismaWithMetrics", () => {
  let mockPrismaClient: PrismaClient
  let mockMetrics: PrometheusMetricsExporter
  let mockLogger: ILogger

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }

    mockMetrics = new PrometheusMetricsExporter(mockLogger)

    // Create a minimal mock of PrismaClient
    mockPrismaClient = {
      $extends: vi.fn().mockImplementation((extension) => {
        // Return a mock extended client that simulates the extension behavior
        return {
          ...mockPrismaClient,
          _extension: extension,
        }
      }),
    } as unknown as PrismaClient
  })

  it("should create extended client with metrics", () => {
    const extendedClient = createPrismaWithMetrics(mockPrismaClient, mockMetrics, mockLogger)

    expect(mockPrismaClient.$extends).toHaveBeenCalled()
    expect(extendedClient).toBeDefined()
  })

  it("should log extension registration", () => {
    createPrismaWithMetrics(mockPrismaClient, mockMetrics, mockLogger)

    expect(mockLogger.info).toHaveBeenCalledWith(
      "Prisma metrics extension registered",
      expect.objectContaining({
        logSlowQueries: false,
        slowQueryThresholdMs: 1000,
        logAllQueries: false,
      }),
    )
  })

  it("should accept custom options", () => {
    createPrismaWithMetrics(mockPrismaClient, mockMetrics, mockLogger, {
      logSlowQueries: true,
      slowQueryThresholdMs: 500,
      logAllQueries: true,
    })

    expect(mockLogger.info).toHaveBeenCalledWith(
      "Prisma metrics extension registered",
      expect.objectContaining({
        logSlowQueries: true,
        slowQueryThresholdMs: 500,
        logAllQueries: true,
      }),
    )
  })

  it("should pass extension with query handler to $extends", () => {
    createPrismaWithMetrics(mockPrismaClient, mockMetrics, mockLogger)

    const extendCall = vi.mocked(mockPrismaClient.$extends).mock.calls[0]
    const extensionArg = extendCall?.[0] as { name: string; query: Record<string, unknown> }

    expect(extensionArg.name).toBe("prisma-metrics")
    expect(extensionArg.query).toBeDefined()
    expect(extensionArg.query.$allOperations).toBeDefined()
  })

  describe("query handler behavior", () => {
    it("should record metrics for successful queries", async () => {
      // Get the extension and manually test the query handler
      createPrismaWithMetrics(mockPrismaClient, mockMetrics, mockLogger)

      const extendCall = vi.mocked(mockPrismaClient.$extends).mock.calls[0]
      const extensionArg = extendCall?.[0] as {
        query: { $allOperations: (params: unknown) => Promise<unknown> }
      }
      const queryHandler = extensionArg.query.$allOperations

      // Simulate a successful query
      const mockQuery = vi.fn().mockResolvedValue([{ id: 1 }])

      await queryHandler({
        operation: "findMany",
        model: "User",
        args: { where: { active: true } },
        query: mockQuery,
      })

      // Check that metrics were recorded
      const metricsOutput = mockMetrics.exportMetrics()

      expect(metricsOutput).toContain("prisma_queries_total")
      expect(metricsOutput).toContain('model="User"')
      expect(metricsOutput).toContain('action="findMany"')
      expect(metricsOutput).toContain('success="true"')
    })

    it("should record metrics for failed queries", async () => {
      createPrismaWithMetrics(mockPrismaClient, mockMetrics, mockLogger)

      const extendCall = vi.mocked(mockPrismaClient.$extends).mock.calls[0]
      const extensionArg = extendCall?.[0] as {
        query: { $allOperations: (params: unknown) => Promise<unknown> }
      }
      const queryHandler = extensionArg.query.$allOperations

      // Simulate a failed query
      const mockQuery = vi.fn().mockRejectedValue(new Error("Database error"))

      await expect(
        queryHandler({
          operation: "create",
          model: "Post",
          args: { data: { title: "Test" } },
          query: mockQuery,
        }),
      ).rejects.toThrow("Database error")

      // Check that metrics were recorded with success=false
      const metricsOutput = mockMetrics.exportMetrics()

      expect(metricsOutput).toContain('success="false"')
    })

    it("should log slow queries when enabled", async () => {
      createPrismaWithMetrics(mockPrismaClient, mockMetrics, mockLogger, {
        logSlowQueries: true,
        slowQueryThresholdMs: 10,
      })

      const extendCall = vi.mocked(mockPrismaClient.$extends).mock.calls[0]
      const extensionArg = extendCall?.[0] as {
        query: { $allOperations: (params: unknown) => Promise<unknown> }
      }
      const queryHandler = extensionArg.query.$allOperations

      // Simulate a slow query
      const mockQuery = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return []
      })

      await queryHandler({
        operation: "findMany",
        model: "SlowTable",
        args: {},
        query: mockQuery,
      })

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Slow database query detected",
        expect.objectContaining({
          model: "SlowTable",
          action: "findMany",
        }),
      )
    })

    it("should log all queries when enabled", async () => {
      createPrismaWithMetrics(mockPrismaClient, mockMetrics, mockLogger, {
        logAllQueries: true,
      })

      const extendCall = vi.mocked(mockPrismaClient.$extends).mock.calls[0]
      const extensionArg = extendCall?.[0] as {
        query: { $allOperations: (params: unknown) => Promise<unknown> }
      }
      const queryHandler = extensionArg.query.$allOperations

      const mockQuery = vi.fn().mockResolvedValue([])

      await queryHandler({
        operation: "findMany",
        model: "DebugTable",
        args: {},
        query: mockQuery,
      })

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Database query executed",
        expect.objectContaining({
          model: "DebugTable",
          action: "findMany",
          success: true,
        }),
      )
    })

    it("should handle unknown model gracefully", async () => {
      createPrismaWithMetrics(mockPrismaClient, mockMetrics, mockLogger)

      const extendCall = vi.mocked(mockPrismaClient.$extends).mock.calls[0]
      const extensionArg = extendCall?.[0] as {
        query: { $allOperations: (params: unknown) => Promise<unknown> }
      }
      const queryHandler = extensionArg.query.$allOperations

      const mockQuery = vi.fn().mockResolvedValue(null)

      await queryHandler({
        operation: "$queryRaw",
        model: undefined,
        args: {},
        query: mockQuery,
      })

      const metricsOutput = mockMetrics.exportMetrics()

      expect(metricsOutput).toContain('model="unknown"')
    })
  })
})
