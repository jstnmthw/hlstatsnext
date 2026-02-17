/**
 * RetryBackoffCalculatorService Tests
 *
 * Comprehensive tests covering exponential backoff calculation,
 * retry decisions, failure state management, and statistics.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RconConfig, ServerFailureState } from "../types/rcon.types"
import { ServerRetryStatus } from "../types/rcon.types"
import { RetryBackoffCalculatorService } from "./retry-backoff-calculator.service"

describe("RetryBackoffCalculatorService", () => {
  let service: RetryBackoffCalculatorService
  let mockLogger: ILogger
  let config: RconConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = createMockLogger()

    config = {
      enabled: true,
      statusInterval: 30000,
      timeout: 5000,
      maxRetries: 3,
      maxConnectionsPerServer: 1,
      maxConsecutiveFailures: 5,
      backoffMultiplier: 2,
      maxBackoffMinutes: 30,
      dormantRetryMinutes: 60,
    }

    service = new RetryBackoffCalculatorService(mockLogger, config)
  })

  describe("constructor", () => {
    it("should initialize with provided config values", () => {
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Retry backoff calculator initialized",
        expect.objectContaining({
          maxConsecutiveFailures: 5,
          backoffMultiplier: 2,
          maxBackoffMinutes: 30,
          dormantRetryMinutes: 60,
        }),
      )
    })

    it("should use default values when optional config fields are undefined", () => {
      const minimalConfig: RconConfig = {
        enabled: true,
        statusInterval: 30000,
        timeout: 5000,
        maxRetries: 3,
        maxConnectionsPerServer: 1,
        // No optional fields
      }

      const svc = new RetryBackoffCalculatorService(mockLogger, minimalConfig)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Retry backoff calculator initialized",
        expect.objectContaining({
          maxConsecutiveFailures: 10,
          backoffMultiplier: 2,
          maxBackoffMinutes: 30,
          dormantRetryMinutes: 60,
        }),
      )

      // Verify defaults work by testing behavior
      const state = svc.getFailureState(1)
      expect(state.status).toBe(ServerRetryStatus.HEALTHY)
    })
  })

  describe("calculateNextRetry", () => {
    it("should return dormant retry time when failure count >= maxConsecutiveFailures", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"))

      const result = service.calculateNextRetry(5) // >= maxConsecutiveFailures (5)

      // dormantRetryMinutes = 60, so 60 * 60 * 1000 = 3600000ms
      const expected = new Date(Date.now() + 60 * 60 * 1000)
      expect(result.getTime()).toBe(expected.getTime())

      vi.useRealTimers()
    })

    it("should return dormant retry time when failure count > maxConsecutiveFailures", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"))

      const result = service.calculateNextRetry(100)

      const expected = new Date(Date.now() + 60 * 60 * 1000)
      expect(result.getTime()).toBe(expected.getTime())

      vi.useRealTimers()
    })

    it("should calculate exponential backoff for first failure (30 seconds)", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"))

      const result = service.calculateNextRetry(1)

      // baseDelay=30, multiplier=2, failureCount=1: 30 * 2^0 = 30 seconds
      const expected = new Date(Date.now() + 30 * 1000)
      expect(result.getTime()).toBe(expected.getTime())

      vi.useRealTimers()
    })

    it("should calculate exponential backoff for second failure (60 seconds)", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"))

      const result = service.calculateNextRetry(2)

      // baseDelay=30, multiplier=2, failureCount=2: 30 * 2^1 = 60 seconds
      const expected = new Date(Date.now() + 60 * 1000)
      expect(result.getTime()).toBe(expected.getTime())

      vi.useRealTimers()
    })

    it("should calculate exponential backoff for third failure (120 seconds)", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"))

      const result = service.calculateNextRetry(3)

      // baseDelay=30, multiplier=2, failureCount=3: 30 * 2^2 = 120 seconds
      const expected = new Date(Date.now() + 120 * 1000)
      expect(result.getTime()).toBe(expected.getTime())

      vi.useRealTimers()
    })

    it("should cap backoff at maxBackoffMinutes", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"))

      // With maxConsecutiveFailures=5, failure 4 is the max before dormant
      // 30 * 2^3 = 240 seconds = 4 minutes (under 30 min cap)
      // Let's test with a lower maxBackoffMinutes
      const limitedConfig: RconConfig = {
        ...config,
        maxConsecutiveFailures: 20,
        maxBackoffMinutes: 1, // 1 minute = 60 seconds cap
      }
      const limitedService = new RetryBackoffCalculatorService(mockLogger, limitedConfig)

      const result = limitedService.calculateNextRetry(10)

      // 30 * 2^9 = 15360 seconds, but capped at 60 seconds (1 minute)
      const expected = new Date(Date.now() + 60 * 1000)
      expect(result.getTime()).toBe(expected.getTime())

      vi.useRealTimers()
    })
  })

  describe("shouldRetry", () => {
    it("should return true for HEALTHY servers", () => {
      const state: ServerFailureState = {
        serverId: 1,
        consecutiveFailures: 0,
        lastFailureAt: null,
        nextRetryAt: null,
        status: ServerRetryStatus.HEALTHY,
      }

      expect(service.shouldRetry(state)).toBe(true)
    })

    it("should return true when nextRetryAt has passed", () => {
      const state: ServerFailureState = {
        serverId: 1,
        consecutiveFailures: 3,
        lastFailureAt: new Date("2025-01-01T00:00:00Z"),
        nextRetryAt: new Date(Date.now() - 1000), // 1 second ago
        status: ServerRetryStatus.BACKING_OFF,
      }

      expect(service.shouldRetry(state)).toBe(true)
    })

    it("should return true when nextRetryAt is exactly now", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2025-01-01T12:00:00Z"))

      const state: ServerFailureState = {
        serverId: 1,
        consecutiveFailures: 3,
        lastFailureAt: new Date("2025-01-01T00:00:00Z"),
        nextRetryAt: new Date("2025-01-01T12:00:00Z"), // exactly now
        status: ServerRetryStatus.BACKING_OFF,
      }

      expect(service.shouldRetry(state)).toBe(true)

      vi.useRealTimers()
    })

    it("should return false when nextRetryAt is in the future and status is BACKING_OFF", () => {
      const state: ServerFailureState = {
        serverId: 1,
        consecutiveFailures: 3,
        lastFailureAt: new Date(),
        nextRetryAt: new Date(Date.now() + 60000), // 1 minute from now
        status: ServerRetryStatus.BACKING_OFF,
      }

      expect(service.shouldRetry(state)).toBe(false)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Server 1 is in backoff"),
        expect.objectContaining({
          serverId: 1,
          status: ServerRetryStatus.BACKING_OFF,
          consecutiveFailures: 3,
        }),
      )
    })

    it("should return false when nextRetryAt is in the future and status is DORMANT", () => {
      const state: ServerFailureState = {
        serverId: 1,
        consecutiveFailures: 10,
        lastFailureAt: new Date(),
        nextRetryAt: new Date(Date.now() + 3600000), // 1 hour from now
        status: ServerRetryStatus.DORMANT,
      }

      expect(service.shouldRetry(state)).toBe(false)
    })

    it("should return false when nextRetryAt is null and status is not HEALTHY", () => {
      const state: ServerFailureState = {
        serverId: 1,
        consecutiveFailures: 3,
        lastFailureAt: new Date(),
        nextRetryAt: null,
        status: ServerRetryStatus.BACKING_OFF,
      }

      expect(service.shouldRetry(state)).toBe(false)
    })

    it("should log timeUntilRetry as null when nextRetryAt is null", () => {
      const state: ServerFailureState = {
        serverId: 1,
        consecutiveFailures: 3,
        lastFailureAt: new Date(),
        nextRetryAt: null,
        status: ServerRetryStatus.BACKING_OFF,
      }

      service.shouldRetry(state)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          nextRetryAt: undefined, // null?.toISOString() is undefined
          timeUntilRetry: null,
        }),
      )
    })
  })

  describe("resetFailureState", () => {
    it("should log recovery when server had previous failures", () => {
      // First, record some failures
      service.recordFailure(1)
      service.recordFailure(1)

      vi.clearAllMocks()

      service.resetFailureState(1)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Server 1 recovered from failure state"),
        expect.objectContaining({
          serverId: 1,
          previousFailures: 2,
          previousStatus: ServerRetryStatus.BACKING_OFF,
          wasRecovering: true,
        }),
      )
    })

    it("should not log when server had no previous failures", () => {
      service.resetFailureState(999)

      expect(mockLogger.info).not.toHaveBeenCalled()
    })

    it("should not log when previous state had zero consecutive failures", () => {
      // This scenario shouldn't happen normally but we test the branch
      service.resetFailureState(1)

      expect(mockLogger.info).not.toHaveBeenCalled()
    })

    it("should remove server from tracking after reset", () => {
      service.recordFailure(1)
      service.resetFailureState(1)

      const state = service.getFailureState(1)
      expect(state.status).toBe(ServerRetryStatus.HEALTHY)
      expect(state.consecutiveFailures).toBe(0)
    })
  })

  describe("recordFailure", () => {
    it("should create new failure state for first failure", () => {
      const state = service.recordFailure(1)

      expect(state.serverId).toBe(1)
      expect(state.consecutiveFailures).toBe(1)
      expect(state.status).toBe(ServerRetryStatus.BACKING_OFF)
      expect(state.lastFailureAt).toBeInstanceOf(Date)
      expect(state.nextRetryAt).toBeInstanceOf(Date)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Server 1 entered failure state"),
        expect.objectContaining({
          serverId: 1,
          consecutiveFailures: 1,
          status: ServerRetryStatus.BACKING_OFF,
        }),
      )
    })

    it("should increment failure count for subsequent failures", () => {
      service.recordFailure(1) // failure 1
      const state = service.recordFailure(1) // failure 2

      expect(state.consecutiveFailures).toBe(2)
    })

    it("should log status transition when status changes", () => {
      // Record failures up to the point of status transition
      for (let i = 0; i < 4; i++) {
        service.recordFailure(1) // BACKING_OFF state
      }

      vi.clearAllMocks()

      // 5th failure should transition to DORMANT
      const state = service.recordFailure(1)

      expect(state.status).toBe(ServerRetryStatus.DORMANT)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Server 1 transitioned to dormant"),
        expect.objectContaining({
          serverId: 1,
          consecutiveFailures: 5,
          previousStatus: ServerRetryStatus.BACKING_OFF,
          newStatus: ServerRetryStatus.DORMANT,
        }),
      )
    })

    it("should log debug when failure count increases without status change", () => {
      service.recordFailure(1) // failure 1 - enters failure state (warn)
      vi.clearAllMocks()

      service.recordFailure(1) // failure 2 - same status, incremented

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Server 1 failure count increased"),
        expect.objectContaining({
          serverId: 1,
          consecutiveFailures: 2,
          status: ServerRetryStatus.BACKING_OFF,
        }),
      )
    })

    it("should remain DORMANT after exceeding maxConsecutiveFailures", () => {
      for (let i = 0; i < 10; i++) {
        service.recordFailure(1)
      }

      const state = service.getFailureState(1)
      expect(state.status).toBe(ServerRetryStatus.DORMANT)
      expect(state.consecutiveFailures).toBe(10)
    })
  })

  describe("getFailureState", () => {
    it("should return healthy state for unknown server", () => {
      const state = service.getFailureState(999)

      expect(state).toEqual({
        serverId: 999,
        consecutiveFailures: 0,
        lastFailureAt: null,
        nextRetryAt: null,
        status: ServerRetryStatus.HEALTHY,
      })
    })

    it("should return tracked state for known server", () => {
      service.recordFailure(1)

      const state = service.getFailureState(1)

      expect(state.serverId).toBe(1)
      expect(state.consecutiveFailures).toBe(1)
      expect(state.status).toBe(ServerRetryStatus.BACKING_OFF)
    })
  })

  describe("getAllFailureStates", () => {
    it("should return empty array when no failures tracked", () => {
      expect(service.getAllFailureStates()).toEqual([])
    })

    it("should return all tracked failure states", () => {
      service.recordFailure(1)
      service.recordFailure(2)
      service.recordFailure(3)

      const states = service.getAllFailureStates()

      expect(states).toHaveLength(3)
      expect(states.map((s) => s.serverId).sort()).toEqual([1, 2, 3])
    })
  })

  describe("getRetryStatistics", () => {
    it("should return all zeros when no failures tracked", () => {
      const stats = service.getRetryStatistics()

      expect(stats).toEqual({
        totalServersInFailureState: 0,
        healthyServers: 0,
        backingOffServers: 0,
        dormantServers: 0,
      })
    })

    it("should count backing off servers", () => {
      service.recordFailure(1)
      service.recordFailure(2)

      const stats = service.getRetryStatistics()

      expect(stats.totalServersInFailureState).toBe(2)
      expect(stats.backingOffServers).toBe(2)
      expect(stats.dormantServers).toBe(0)
    })

    it("should count dormant servers", () => {
      // Push server 1 to dormant (5 failures with maxConsecutiveFailures=5)
      for (let i = 0; i < 5; i++) {
        service.recordFailure(1)
      }
      // Server 2 still backing off
      service.recordFailure(2)

      const stats = service.getRetryStatistics()

      expect(stats.totalServersInFailureState).toBe(2)
      expect(stats.backingOffServers).toBe(1)
      expect(stats.dormantServers).toBe(1)
      expect(stats.healthyServers).toBe(0)
    })

    it("should handle mixed states correctly", () => {
      // Server 1: dormant
      for (let i = 0; i < 5; i++) {
        service.recordFailure(1)
      }
      // Server 2: backing off
      service.recordFailure(2)
      // Server 3: backing off
      service.recordFailure(3)
      service.recordFailure(3)

      const stats = service.getRetryStatistics()

      expect(stats.totalServersInFailureState).toBe(3)
      expect(stats.dormantServers).toBe(1)
      expect(stats.backingOffServers).toBe(2)
      expect(stats.healthyServers).toBe(0)
    })
  })

  describe("determineRetryStatus (private, tested via recordFailure)", () => {
    it("should return BACKING_OFF for failure count 1", () => {
      const state = service.recordFailure(1)
      expect(state.status).toBe(ServerRetryStatus.BACKING_OFF)
    })

    it("should return BACKING_OFF for failure count less than max", () => {
      service.recordFailure(1)
      service.recordFailure(1)
      service.recordFailure(1)
      const state = service.recordFailure(1) // 4 failures, max is 5

      expect(state.status).toBe(ServerRetryStatus.BACKING_OFF)
    })

    it("should return DORMANT for failure count equal to max", () => {
      for (let i = 0; i < 4; i++) {
        service.recordFailure(1)
      }
      const state = service.recordFailure(1) // 5th failure = max

      expect(state.status).toBe(ServerRetryStatus.DORMANT)
    })

    it("should return DORMANT for failure count exceeding max", () => {
      for (let i = 0; i < 6; i++) {
        service.recordFailure(1)
      }

      const state = service.getFailureState(1)
      expect(state.status).toBe(ServerRetryStatus.DORMANT)
    })
  })

  describe("edge cases", () => {
    it("should handle reset followed by new failure correctly", () => {
      service.recordFailure(1)
      service.recordFailure(1)
      service.resetFailureState(1)

      const state = service.recordFailure(1)

      expect(state.consecutiveFailures).toBe(1) // Reset to 1, not 3
      expect(state.status).toBe(ServerRetryStatus.BACKING_OFF)
    })

    it("should track multiple servers independently", () => {
      service.recordFailure(1)
      service.recordFailure(1)
      service.recordFailure(2)

      expect(service.getFailureState(1).consecutiveFailures).toBe(2)
      expect(service.getFailureState(2).consecutiveFailures).toBe(1)
    })

    it("should not affect other servers when resetting one", () => {
      service.recordFailure(1)
      service.recordFailure(2)
      service.resetFailureState(1)

      expect(service.getFailureState(1).status).toBe(ServerRetryStatus.HEALTHY)
      expect(service.getFailureState(2).status).toBe(ServerRetryStatus.BACKING_OFF)
    })
  })
})
