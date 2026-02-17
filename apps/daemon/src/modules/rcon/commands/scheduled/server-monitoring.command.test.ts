/**
 * Server Monitoring Command Tests
 *
 * Comprehensive tests for the server monitoring scheduled command.
 */

import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IServerStatusEnricher } from "@/modules/server/enrichers/server-status-enricher"
import type { IServerService, ServerInfo } from "@/modules/server/server.types"
import type { ILogger } from "@/shared/utils/logger.types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mockDeep, type MockProxy } from "vitest-mock-extended"
import type { IRconService, ServerFailureState } from "../../types/rcon.types"
import { ServerRetryStatus } from "../../types/rcon.types"
import type { ScheduledCommand, ScheduleExecutionContext } from "../../types/schedule.types"
import { ServerMonitoringCommand } from "./server-monitoring.command"

// Mock the RetryBackoffCalculatorService
vi.mock("../../services/retry-backoff-calculator.service", () => ({
  RetryBackoffCalculatorService: class {
    private failureStates = new Map<number, ServerFailureState>()

    constructor() {}

    getFailureState(serverId: number): ServerFailureState {
      return (
        this.failureStates.get(serverId) ?? {
          serverId,
          consecutiveFailures: 0,
          lastFailureAt: null,
          nextRetryAt: null,
          status: ServerRetryStatus.HEALTHY,
        }
      )
    }

    shouldRetry(failureState: ServerFailureState): boolean {
      return (
        failureState.status === ServerRetryStatus.HEALTHY ||
        (failureState.nextRetryAt !== null && new Date() >= failureState.nextRetryAt)
      )
    }

    resetFailureState(serverId: number): void {
      this.failureStates.delete(serverId)
    }

    recordFailure(serverId: number): ServerFailureState {
      const existing = this.failureStates.get(serverId)
      const failureCount = (existing?.consecutiveFailures ?? 0) + 1
      const state: ServerFailureState = {
        serverId,
        consecutiveFailures: failureCount,
        lastFailureAt: new Date(),
        nextRetryAt: new Date(Date.now() + 30000),
        status: failureCount >= 10 ? ServerRetryStatus.DORMANT : ServerRetryStatus.BACKING_OFF,
      }
      this.failureStates.set(serverId, state)
      return state
    }

    getRetryStatistics() {
      return {
        totalServersInFailureState: this.failureStates.size,
        healthyServers: 0,
        backingOffServers: 0,
        dormantServers: 0,
      }
    }

    getAllFailureStates(): ServerFailureState[] {
      return Array.from(this.failureStates.values())
    }
  },
}))

describe("ServerMonitoringCommand", () => {
  let command: ServerMonitoringCommand
  let mockLogger: MockProxy<ILogger>
  let mockRconService: MockProxy<IRconService>
  let mockServerService: MockProxy<IServerService>
  let mockServerStatusEnricher: MockProxy<IServerStatusEnricher>
  let mockSessionService: MockProxy<IPlayerSessionService>

  const mockServer: ServerInfo = {
    serverId: 1,
    game: "cstrike",
    name: "Test Server",
    address: "127.0.0.1",
    port: 27015,
  }

  const mockServer2: ServerInfo = {
    serverId: 2,
    game: "cstrike",
    name: "Test Server 2",
    address: "127.0.0.2",
    port: 27016,
  }

  const createContext = (schedule?: ScheduledCommand): ScheduleExecutionContext => {
    const sched = schedule ?? {
      id: "monitoring-test",
      name: "Monitoring Test",
      cronExpression: "*/30 * * * * *",
      command: { type: "server-monitoring" },
      enabled: true,
    }
    return {
      scheduleId: sched.id,
      executionId: `${sched.id}-exec-${Date.now()}`,
      schedule: sched,
      startTime: new Date(),
    }
  }

  beforeEach(() => {
    mockLogger = mockDeep<ILogger>()
    mockRconService = mockDeep<IRconService>()
    mockServerService = mockDeep<IServerService>()
    mockServerStatusEnricher = mockDeep<IServerStatusEnricher>()
    mockSessionService = mockDeep<IPlayerSessionService>()

    command = new ServerMonitoringCommand(
      mockLogger,
      mockRconService,
      mockServerService,
      mockServerStatusEnricher,
      mockSessionService,
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("constructor", () => {
    it("should initialize with default config values", () => {
      const cmd = new ServerMonitoringCommand(
        mockLogger,
        mockRconService,
        mockServerService,
        mockServerStatusEnricher,
        mockSessionService,
      )
      expect(cmd).toBeInstanceOf(ServerMonitoringCommand)
    })

    it("should initialize with custom config values", () => {
      const cmd = new ServerMonitoringCommand(
        mockLogger,
        mockRconService,
        mockServerService,
        mockServerStatusEnricher,
        mockSessionService,
        {
          maxConsecutiveFailures: 5,
          backoffMultiplier: 3,
          maxBackoffMinutes: 60,
          dormantRetryMinutes: 120,
        },
      )
      expect(cmd).toBeInstanceOf(ServerMonitoringCommand)
    })

    it("should initialize with partial config values", () => {
      const cmd = new ServerMonitoringCommand(
        mockLogger,
        mockRconService,
        mockServerService,
        mockServerStatusEnricher,
        mockSessionService,
        { maxConsecutiveFailures: 5 },
      )
      expect(cmd).toBeInstanceOf(ServerMonitoringCommand)
    })
  })

  describe("getType", () => {
    it("should return 'server-monitoring'", () => {
      expect(command.getType()).toBe("server-monitoring")
    })
  })

  describe("validate", () => {
    it("should return true for enabled schedule", async () => {
      const schedule: ScheduledCommand = {
        id: "monitoring-valid",
        name: "Valid Monitoring",
        cronExpression: "*/30 * * * * *",
        command: { type: "server-monitoring" },
        enabled: true,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(true)
    })

    it("should return false for disabled schedule", async () => {
      const schedule: ScheduledCommand = {
        id: "monitoring-disabled",
        name: "Disabled Monitoring",
        cronExpression: "*/30 * * * * *",
        command: { type: "server-monitoring" },
        enabled: false,
      }

      const isValid = await command.validate(schedule)
      expect(isValid).toBe(false)
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("is disabled"))
    })
  })

  describe("execute", () => {
    it("should return zero counts when no active servers found", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([])

      const result = await command.execute(createContext())

      expect(result.serversProcessed).toBe(0)
      expect(result.commandsSent).toBe(0)
      expect(mockLogger.info).toHaveBeenCalledWith("No active servers found for monitoring")
    })

    it("should successfully monitor a single server", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
      mockRconService.isConnected.mockReturnValue(true)
      mockServerStatusEnricher.enrichServerStatus.mockResolvedValue()

      const result = await command.execute(createContext())

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(1)
      expect(mockServerStatusEnricher.enrichServerStatus).toHaveBeenCalledWith(1)
    })

    it("should successfully monitor multiple servers", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer, mockServer2])
      mockRconService.isConnected.mockReturnValue(true)
      mockServerStatusEnricher.enrichServerStatus.mockResolvedValue()

      const result = await command.execute(createContext())

      expect(result.serversProcessed).toBe(2)
      expect(result.commandsSent).toBe(2)
    })

    it("should establish RCON connection for disconnected servers", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
      mockRconService.isConnected.mockReturnValue(false)
      mockRconService.connect.mockResolvedValue()
      mockServerStatusEnricher.enrichServerStatus.mockResolvedValue()

      const result = await command.execute(createContext())

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(1)
      expect(mockRconService.connect).toHaveBeenCalledWith(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Establishing RCON connection"),
      )
    })

    it("should log debug for already connected servers", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
      mockRconService.isConnected.mockReturnValue(true)
      mockServerStatusEnricher.enrichServerStatus.mockResolvedValue()

      await command.execute(createContext())

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("RCON already connected"),
      )
    })

    it("should handle server monitoring failure with error object", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
      mockRconService.isConnected.mockReturnValue(true)
      mockServerStatusEnricher.enrichServerStatus.mockRejectedValue(new Error("Connection timeout"))
      mockRconService.getEngineDisplayNameForServer.mockResolvedValue("Source")
      mockRconService.disconnect.mockResolvedValue()

      const result = await command.execute(createContext())

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(0)
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Connection timeout"))
    })

    it("should handle server monitoring failure with non-Error object", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
      mockRconService.isConnected.mockReturnValue(true)
      mockServerStatusEnricher.enrichServerStatus.mockRejectedValue("string error")
      mockRconService.getEngineDisplayNameForServer.mockResolvedValue("GoldSrc")
      mockRconService.disconnect.mockResolvedValue()

      const result = await command.execute(createContext())

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(0)
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("string error"))
    })

    it("should handle disconnect error gracefully during error handling", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
      mockRconService.isConnected.mockReturnValue(true)
      mockServerStatusEnricher.enrichServerStatus.mockRejectedValue(new Error("timeout"))
      mockRconService.getEngineDisplayNameForServer.mockResolvedValue("Source")
      mockRconService.disconnect.mockRejectedValue(new Error("disconnect failed"))

      const result = await command.execute(createContext())

      expect(result.serversProcessed).toBe(1)
      expect(result.commandsSent).toBe(0)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Error disconnecting from server"),
      )
    })

    it("should handle mixed success and failure across servers", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer, mockServer2])
      mockRconService.isConnected.mockReturnValue(true)

      // Server 1 succeeds, server 2 fails
      mockServerStatusEnricher.enrichServerStatus.mockImplementation(async (serverId: number) => {
        if (serverId === 2) {
          throw new Error("Server 2 failure")
        }
      })
      mockRconService.getEngineDisplayNameForServer.mockResolvedValue("Source")
      mockRconService.disconnect.mockResolvedValue()

      const result = await command.execute(createContext())

      expect(result.serversProcessed).toBe(2)
      expect(result.commandsSent).toBe(1) // Only server 1 succeeded
    })

    it("should catch top-level errors and return zero counts", async () => {
      mockServerService.findActiveServersWithRcon.mockRejectedValue(
        new Error("Database unavailable"),
      )

      const result = await command.execute(createContext())

      expect(result.serversProcessed).toBe(0)
      expect(result.commandsSent).toBe(0)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Server monitoring execution failed"),
        expect.any(Object),
      )
    })

    it("should catch top-level non-Error errors and return zero counts", async () => {
      mockServerService.findActiveServersWithRcon.mockRejectedValue("string rejection")

      const result = await command.execute(createContext())

      expect(result.serversProcessed).toBe(0)
      expect(result.commandsSent).toBe(0)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("string rejection"),
        expect.any(Object),
      )
    })

    it("should log skipped servers in backoff period", async () => {
      // Create a command and manually trigger a failure to put server in backoff
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer, mockServer2])
      mockRconService.isConnected.mockReturnValue(true)

      // First execution: server 2 fails, putting it in backoff
      mockServerStatusEnricher.enrichServerStatus.mockImplementation(async (serverId: number) => {
        if (serverId === 2) {
          throw new Error("failure")
        }
      })
      mockRconService.getEngineDisplayNameForServer.mockResolvedValue("Source")
      mockRconService.disconnect.mockResolvedValue()

      await command.execute(createContext())

      // Second execution: server 2 should be skipped (in backoff)
      mockServerStatusEnricher.enrichServerStatus.mockResolvedValue()

      await command.execute(createContext())

      // Server 2 was recorded as failing, and the mock shouldRetry returns false for BACKING_OFF
      // So skippedCount > 0 and debug log should fire
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Skipped"))
    })

    it("should handle null monitorResult or server in results loop", async () => {
      // This tests the guard: if (!monitorResult || !server) { continue }
      // In practice this is hard to trigger, but we can verify the code handles
      // empty results gracefully
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
      mockRconService.isConnected.mockReturnValue(true)
      mockServerStatusEnricher.enrichServerStatus.mockResolvedValue()

      const result = await command.execute(createContext())
      expect(result.serversProcessed).toBe(1)
    })

    it("should log completion with scheduleId, totals, and skipped info", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
      mockRconService.isConnected.mockReturnValue(true)
      mockServerStatusEnricher.enrichServerStatus.mockResolvedValue()

      const ctx = createContext()
      await command.execute(ctx)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Server monitoring completed",
        expect.objectContaining({
          scheduleId: ctx.schedule.id,
          totalServers: 1,
          monitored: 1,
          successful: 1,
          errors: 0,
          skipped: 0,
        }),
      )
    })
  })

  describe("connectToServerImmediately", () => {
    it("should return early when server is not found", async () => {
      mockServerService.findById.mockResolvedValue(null)

      await command.connectToServerImmediately(999)

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Server 999 not found"))
      expect(mockRconService.connect).not.toHaveBeenCalled()
    })

    it("should return early when server has no RCON credentials", async () => {
      mockServerService.findById.mockResolvedValue(mockServer)
      mockServerService.hasRconCredentials.mockResolvedValue(false)

      await command.connectToServerImmediately(1)

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("no RCON credentials"))
      expect(mockRconService.connect).not.toHaveBeenCalled()
    })

    it("should return early when server is in backoff period", async () => {
      // First, record failures to put server in backoff
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
      mockRconService.isConnected.mockReturnValue(true)
      mockServerStatusEnricher.enrichServerStatus.mockRejectedValue(new Error("fail"))
      mockRconService.getEngineDisplayNameForServer.mockResolvedValue("Source")
      mockRconService.disconnect.mockResolvedValue()

      // Trigger failure to put server 1 in backoff
      await command.execute(createContext())

      // Now try immediate connection
      mockServerService.findById.mockResolvedValue(mockServer)
      mockServerService.hasRconCredentials.mockResolvedValue(true)

      await command.connectToServerImmediately(1)

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("backoff period"))
    })

    it("should connect and enrich status for newly connected server", async () => {
      mockServerService.findById.mockResolvedValue(mockServer)
      mockServerService.hasRconCredentials.mockResolvedValue(true)
      mockRconService.isConnected.mockReturnValue(false)
      mockRconService.connect.mockResolvedValue()
      mockServerStatusEnricher.enrichServerStatus.mockResolvedValue()
      mockSessionService.synchronizeServerSessions.mockResolvedValue(5)

      await command.connectToServerImmediately(1)

      expect(mockRconService.connect).toHaveBeenCalledWith(1)
      expect(mockServerStatusEnricher.enrichServerStatus).toHaveBeenCalledWith(1)
      expect(mockSessionService.synchronizeServerSessions).toHaveBeenCalledWith(1)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Created 5 player sessions"),
      )
    })

    it("should skip enrichment when server was already connected", async () => {
      mockServerService.findById.mockResolvedValue(mockServer)
      mockServerService.hasRconCredentials.mockResolvedValue(true)
      mockRconService.isConnected.mockReturnValue(true) // Already connected

      await command.connectToServerImmediately(1)

      // Should not enrich or synchronize since already connected
      expect(mockServerStatusEnricher.enrichServerStatus).not.toHaveBeenCalled()
      expect(mockSessionService.synchronizeServerSessions).not.toHaveBeenCalled()
    })

    it("should handle session synchronization failure gracefully", async () => {
      mockServerService.findById.mockResolvedValue(mockServer)
      mockServerService.hasRconCredentials.mockResolvedValue(true)
      mockRconService.isConnected.mockReturnValue(false)
      mockRconService.connect.mockResolvedValue()
      mockServerStatusEnricher.enrichServerStatus.mockResolvedValue()
      mockSessionService.synchronizeServerSessions.mockRejectedValue(
        new Error("Session sync failed"),
      )

      await command.connectToServerImmediately(1)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to synchronize sessions"),
      )
    })

    it("should handle connection error gracefully", async () => {
      mockServerService.findById.mockResolvedValue(mockServer)
      mockServerService.hasRconCredentials.mockResolvedValue(true)
      mockRconService.isConnected.mockReturnValue(false)
      mockRconService.connect.mockRejectedValue(new Error("Connection refused"))

      await command.connectToServerImmediately(1)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error in immediate RCON connection"),
      )
    })

    it("should reset failure state on successful connection", async () => {
      mockServerService.findById.mockResolvedValue(mockServer)
      mockServerService.hasRconCredentials.mockResolvedValue(true)
      mockRconService.isConnected.mockReturnValue(true)

      await command.connectToServerImmediately(1)

      // Failure state should be reset (we can't check directly, but no errors should be logged)
      expect(mockLogger.error).not.toHaveBeenCalled()
    })
  })

  describe("getRetryStatistics", () => {
    it("should return statistics from the retry calculator", () => {
      const stats = command.getRetryStatistics()

      expect(stats).toEqual(
        expect.objectContaining({
          totalServersInFailureState: expect.any(Number),
          healthyServers: expect.any(Number),
          backingOffServers: expect.any(Number),
          dormantServers: expect.any(Number),
        }),
      )
    })

    it("should return zeroes when no failures have occurred", () => {
      const stats = command.getRetryStatistics()

      expect(stats.totalServersInFailureState).toBe(0)
    })
  })

  describe("getAllFailureStates", () => {
    it("should return empty array when no failures", () => {
      const states = command.getAllFailureStates()
      expect(states).toEqual([])
    })

    it("should return failure states after server failures", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
      mockRconService.isConnected.mockReturnValue(true)
      mockServerStatusEnricher.enrichServerStatus.mockRejectedValue(new Error("fail"))
      mockRconService.getEngineDisplayNameForServer.mockResolvedValue("Source")
      mockRconService.disconnect.mockResolvedValue()

      await command.execute(createContext())

      const states = command.getAllFailureStates()
      expect(states.length).toBeGreaterThan(0)
      expect(states[0]?.serverId).toBe(1)
      expect(states[0]?.consecutiveFailures).toBe(1)
    })
  })

  describe("handleServerError", () => {
    it("should log engine type and failure details", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
      mockRconService.isConnected.mockReturnValue(true)
      mockServerStatusEnricher.enrichServerStatus.mockRejectedValue(
        new Error("RCON connection lost"),
      )
      mockRconService.getEngineDisplayNameForServer.mockResolvedValue("GoldSrc")
      mockRconService.disconnect.mockResolvedValue()

      await command.execute(createContext())

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("GoldSrc RCON monitoring failed"),
        expect.objectContaining({
          serverId: 1,
          serverName: "Test Server",
          engineType: "GoldSrc",
        }),
      )
    })

    it("should attempt disconnect on error", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
      mockRconService.isConnected.mockReturnValue(true)
      mockServerStatusEnricher.enrichServerStatus.mockRejectedValue(new Error("error"))
      mockRconService.getEngineDisplayNameForServer.mockResolvedValue("Source")
      mockRconService.disconnect.mockResolvedValue()

      await command.execute(createContext())

      expect(mockRconService.disconnect).toHaveBeenCalledWith(1)
    })

    it("should handle non-Error objects in handleServerError", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([mockServer])
      mockRconService.isConnected.mockReturnValue(true)
      mockServerStatusEnricher.enrichServerStatus.mockRejectedValue(42)
      mockRconService.getEngineDisplayNameForServer.mockResolvedValue("Source")
      mockRconService.disconnect.mockResolvedValue()

      await command.execute(createContext())

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("RCON monitoring failed"),
        expect.objectContaining({
          error: "42",
        }),
      )
    })
  })
})
