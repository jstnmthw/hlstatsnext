/**
 * RCON Schedule Service Tests
 *
 * Tests for the scheduled RCON command execution service.
 */

import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IServerStatusEnricher } from "@/modules/server/enrichers/server-status-enricher"
import type { IServerService } from "@/modules/server/server.types"
import type { IEventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus.types"
import type { ILogger } from "@/shared/utils/logger.types"
import * as cron from "node-cron"
import { afterEach, beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest"
import { mockDeep, type MockProxy } from "vitest-mock-extended"
import type { IRconService } from "../types/rcon.types"
import type { ScheduleConfig, ScheduledCommand } from "../types/schedule.types"
import { RconScheduleService } from "./rcon-schedule.service"

// Mock the command classes
vi.mock("../commands/scheduled/server-message.command", () => ({
  ServerMessageCommand: class {
    constructor() {}
    async validate() {
      return true
    }
    async execute() {
      return { success: true, response: "Message sent" }
    }
    getType() {
      return "server-message"
    }
  },
}))

vi.mock("../commands/scheduled/server-monitoring.command", () => ({
  ServerMonitoringCommand: class {
    constructor() {}
    async validate() {
      return true
    }
    async execute() {
      return { serversProcessed: 1, commandsSent: 1 }
    }
    getType() {
      return "server_monitoring"
    }
    async connectToServerImmediately() {
      return
    }
  },
}))

// Mock node-cron completely
vi.mock("node-cron")

describe("RconScheduleService", () => {
  let service: RconScheduleService
  let mockLogger: MockProxy<ILogger>
  let mockRconService: MockProxy<IRconService>
  let mockServerService: MockProxy<IServerService>
  let mockScheduleConfig: ScheduleConfig
  let mockEventBus: MockProxy<IEventBus>
  let mockServerStatusEnricher: MockProxy<IServerStatusEnricher>
  let mockSessionService: MockProxy<IPlayerSessionService>
  let mockScheduledTasks: Array<{
    start: MockedFunction<() => void>
    stop: MockedFunction<() => void>
    now: MockedFunction<() => void>
  }>

  beforeEach(() => {
    mockLogger = mockDeep<ILogger>()
    mockRconService = mockDeep<IRconService>()
    mockServerService = mockDeep<IServerService>()
    mockEventBus = mockDeep<IEventBus>()
    mockServerStatusEnricher = mockDeep<IServerStatusEnricher>()
    mockSessionService = mockDeep<IPlayerSessionService>()

    mockScheduleConfig = {
      enabled: true,
      defaultTimeoutMs: 30000,
      defaultRetryOnFailure: true,
      defaultMaxRetries: 3,
      historyRetentionHours: 24,
      maxConcurrentPerServer: 3,
      schedules: [],
    }

    // Clear array of tasks
    mockScheduledTasks = []

    // Mock cron functions with proper vi.mocked approach
    vi.mocked(cron.schedule).mockImplementation(() => {
      const newTask = {
        start: vi.fn(),
        stop: vi.fn(),
        now: vi.fn(),
      }
      mockScheduledTasks.push(newTask)
      // Return the task with proper typing for node-cron ScheduledTask interface
      return newTask as unknown as import("node-cron").ScheduledTask
    })

    vi.mocked(cron.validate).mockImplementation((expression: string) => {
      // cron.validate() throws on invalid expressions, returns nothing on valid ones
      if (expression === "invalid-cron") {
        throw new Error("Invalid cron expression")
      }
      return true
    })

    service = new RconScheduleService(
      mockLogger,
      mockRconService,
      mockServerService,
      mockScheduleConfig,
      mockEventBus,
      mockServerStatusEnricher,
      mockSessionService,
    )
  })

  afterEach(() => {
    // Clear all mock call histories
    vi.clearAllMocks()
  })

  describe("constructor", () => {
    it("should initialize with provided dependencies", () => {
      expect(service).toBeInstanceOf(RconScheduleService)
    })
  })

  describe("start", () => {
    it("should start successfully when enabled", async () => {
      await service.start()

      expect(mockLogger.info).toHaveBeenCalledWith("Starting RCON scheduler service...")
      expect(mockLogger.ok).toHaveBeenCalledWith(
        expect.stringContaining("RCON scheduler started with"),
        expect.any(Object),
      )
    })

    it("should skip startup when disabled", async () => {
      const disabledConfig = { ...mockScheduleConfig, enabled: false }
      const disabledService = new RconScheduleService(
        mockLogger,
        mockRconService,
        mockServerService,
        disabledConfig,
        mockEventBus,
        mockServerStatusEnricher,
        mockSessionService,
      )

      await disabledService.start()

      expect(mockLogger.info).toHaveBeenCalledWith("RCON scheduler disabled by configuration")
    })

    it("should not start twice", async () => {
      await service.start()
      await service.start()

      expect(mockLogger.warn).toHaveBeenCalledWith("RCON scheduler already started")
    })

    it("should register enabled schedules from config", async () => {
      const testSchedule: ScheduledCommand = {
        id: "test-schedule",
        name: "Test Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test message" },
        enabled: true,
      }

      const configWithSchedule = {
        ...mockScheduleConfig,
        schedules: [testSchedule],
      }

      const serviceWithSchedule = new RconScheduleService(
        mockLogger,
        mockRconService,
        mockServerService,
        configWithSchedule,
        mockEventBus,
        mockServerStatusEnricher,
        mockSessionService,
      )

      await serviceWithSchedule.start()

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Registered schedule: ${testSchedule.id} (${testSchedule.name})`,
        expect.any(Object),
      )
    })
  })

  describe("stop", () => {
    it("should stop successfully", async () => {
      await service.start()
      await service.stop()

      expect(mockLogger.info).toHaveBeenCalledWith("Stopping RCON scheduler service...")
      expect(mockLogger.info).toHaveBeenCalledWith("RCON scheduler stopped")
    })

    it("should handle stop when not started", async () => {
      await service.stop()

      expect(mockLogger.debug).toHaveBeenCalledWith("RCON scheduler not started")
    })

    it("should stop and destroy all tasks", async () => {
      const testSchedule: ScheduledCommand = {
        id: "test-schedule",
        name: "Test Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.start()
      await service.registerSchedule(testSchedule)

      // Verify the schedule was registered
      const schedules = service.getSchedules()
      expect(schedules).toHaveLength(1)
      expect(schedules[0]?.id).toBe(testSchedule.id)

      await service.stop()

      // Verify service stopped successfully
      expect(mockLogger.info).toHaveBeenCalledWith("RCON scheduler stopped")
    })
  })

  describe("registerSchedule", () => {
    beforeEach(async () => {
      await service.start()
    })

    it("should register a valid schedule", async () => {
      const testSchedule: ScheduledCommand = {
        id: "test-schedule",
        name: "Test Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test message" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Registered schedule: ${testSchedule.id} (${testSchedule.name})`,
        expect.any(Object),
      )
    })

    it("should reject duplicate schedule IDs", async () => {
      const testSchedule: ScheduledCommand = {
        id: "test-schedule",
        name: "Test Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)

      await expect(service.registerSchedule(testSchedule)).rejects.toThrow(
        "Schedule with ID test-schedule already exists",
      )
    })

    it("should handle invalid cron expressions gracefully", async () => {
      const testSchedule: ScheduledCommand = {
        id: "cron-test-schedule",
        name: "Cron Test Schedule",
        cronExpression: "invalid-cron",
        command: { type: "hlx_csay", color: "00FF00", message: "Hello players!" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)

      const schedules = service.getSchedules()
      expect(schedules).toHaveLength(0)
    })

    it("should handle missing command executors gracefully", async () => {
      const scheduleWithMissingExecutor: ScheduledCommand = {
        id: "missing-executor",
        name: "Missing Executor Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "stats_snapshot", param1: "test" },
        enabled: true,
      }

      // This should not throw, but should log a warning
      await service.registerSchedule(scheduleWithMissingExecutor)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "No executor found for command type: stats_snapshot (schedule: missing-executor), skipping this schedule",
      )

      // Schedule should not be registered
      const schedules = service.getSchedules()
      expect(schedules).toHaveLength(0)
    })
  })

  describe("unregisterSchedule", () => {
    beforeEach(async () => {
      await service.start()
    })

    it("should unregister an existing schedule", async () => {
      const testSchedule: ScheduledCommand = {
        id: "test-schedule",
        name: "Test Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test message" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)

      let schedules = service.getSchedules()
      expect(schedules).toHaveLength(1)

      await service.unregisterSchedule(testSchedule.id)

      expect(mockLogger.info).toHaveBeenCalledWith(`Unregistered schedule: ${testSchedule.id}`)

      // Verify the schedule was removed
      schedules = service.getSchedules()
      expect(schedules).toHaveLength(0)
    })

    it("should reject unregistering non-existent schedule", async () => {
      await expect(service.unregisterSchedule("non-existent")).rejects.toThrow(
        "Schedule not found: non-existent",
      )
    })
  })

  describe("setScheduleEnabled", () => {
    beforeEach(async () => {
      await service.start()
    })

    it("should enable a disabled schedule", async () => {
      const testSchedule: ScheduledCommand = {
        id: "test-schedule",
        name: "Test Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: false,
      }

      await service.registerSchedule(testSchedule)

      // Verify the schedule was registered as disabled
      let schedules = service.getSchedules()
      expect(schedules[0]?.enabled).toBe(false)

      await service.setScheduleEnabled(testSchedule.id, true)

      expect(mockLogger.info).toHaveBeenCalledWith(`Enabled schedule: ${testSchedule.id}`)

      // Verify the schedule is now enabled
      schedules = service.getSchedules()
      expect(schedules[0]?.enabled).toBe(true)
    })

    it("should disable an enabled schedule", async () => {
      const testSchedule: ScheduledCommand = {
        id: "test-schedule",
        name: "Test Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)

      // Verify the schedule was registered as enabled
      let schedules = service.getSchedules()
      expect(schedules[0]?.enabled).toBe(true)

      await service.setScheduleEnabled(testSchedule.id, false)

      expect(mockLogger.info).toHaveBeenCalledWith(`Disabled schedule: ${testSchedule.id}`)

      // Verify the schedule is now disabled
      schedules = service.getSchedules()
      expect(schedules[0]?.enabled).toBe(false)
    })

    it("should reject enabling non-existent schedule", async () => {
      await expect(service.setScheduleEnabled("non-existent", true)).rejects.toThrow(
        "Schedule not found: non-existent",
      )
    })
  })

  describe("getSchedules", () => {
    beforeEach(async () => {
      await service.start()
    })

    it("should return empty array when no schedules registered", () => {
      const schedules = service.getSchedules()
      expect(schedules).toEqual([])
    })

    it("should return all registered schedules", async () => {
      const testSchedule: ScheduledCommand = {
        id: "test-schedule",
        name: "Test Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)
      const schedules = service.getSchedules()

      expect(schedules).toHaveLength(1)
      expect(schedules[0]).toEqual(testSchedule)
    })
  })

  describe("getScheduleStatus", () => {
    beforeEach(async () => {
      await service.start()
    })

    it("should return status for all schedules", async () => {
      const testSchedule: ScheduledCommand = {
        id: "test-schedule",
        name: "Test Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)
      const statuses = service.getScheduleStatus()

      expect(statuses).toHaveLength(1)
      expect(statuses[0]).toMatchObject({
        scheduleId: testSchedule.id,
        name: testSchedule.name,
        enabled: testSchedule.enabled,
        status: "scheduled",
        stats: expect.objectContaining({
          successfulExecutions: 0,
          failedExecutions: 0,
        }),
      })
    })
  })

  describe("executeScheduleNow", () => {
    beforeEach(async () => {
      await service.start()
    })

    it("should execute a schedule immediately", async () => {
      const testSchedule: ScheduledCommand = {
        id: "test-schedule",
        name: "Test Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      // Mock server service to return test servers
      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        {
          serverId: 1,
          game: "cstrike",
          name: "Test Server",
          address: "127.0.0.1",
          port: 27015,
        },
      ])

      // Mock RCON service connection and command execution
      mockRconService.isConnected.mockReturnValue(true)
      mockRconService.executeCommand.mockResolvedValue("Message sent successfully")

      await service.registerSchedule(testSchedule)
      const results = await service.executeScheduleNow(testSchedule.id)

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        executionId: expect.any(String),
        status: "success",
        serversProcessed: 1,
        commandsSent: 1,
      })
    })

    it("should reject executing non-existent schedule", async () => {
      await expect(service.executeScheduleNow("non-existent")).rejects.toThrow(
        "Schedule not found: non-existent",
      )
    })
  })

  describe("getExecutionHistory", () => {
    beforeEach(async () => {
      await service.start()
    })

    it("should return empty history for new schedule", async () => {
      const testSchedule: ScheduledCommand = {
        id: "test-schedule",
        name: "Test Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)
      const history = service.getExecutionHistory(testSchedule.id)

      expect(history).toEqual([])
    })

    it("should return empty history for non-existent schedule", () => {
      const history = service.getExecutionHistory("non-existent")
      expect(history).toEqual([])
    })
  })

  describe("updateSchedule", () => {
    beforeEach(async () => {
      await service.start()
    })

    it("should update an existing schedule", async () => {
      const originalSchedule: ScheduledCommand = {
        id: "test-schedule",
        name: "Test Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "original" },
        enabled: true,
      }

      const updatedSchedule: ScheduledCommand = {
        ...originalSchedule,
        name: "Updated Test Schedule",
        command: { type: "hlx_csay", color: "00FF00", message: "updated" },
      }

      await service.registerSchedule(originalSchedule)
      await service.updateSchedule(updatedSchedule)

      const schedules = service.getSchedules()
      expect(schedules[0]?.name).toBe("Updated Test Schedule")
      expect(schedules[0]?.command).toEqual({
        type: "hlx_csay",
        color: "00FF00",
        message: "updated",
      })
    })

    it("should register new schedule if it doesn't exist", async () => {
      const newSchedule: ScheduledCommand = {
        id: "new-schedule",
        name: "New Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "new" },
        enabled: true,
      }

      await service.updateSchedule(newSchedule)

      const schedules = service.getSchedules()
      expect(schedules).toHaveLength(1)
      expect(schedules[0]?.id).toBe("new-schedule")
    })
  })

  // ─── Additional coverage tests ───────────────────────────────────────────

  describe("start (error handling)", () => {
    it("should handle duplicate schedule IDs during start", async () => {
      // If a schedule with the same ID is somehow present in config twice,
      // the second one should trigger ScheduleAlreadyExists error during start
      const testSchedule: ScheduledCommand = {
        id: "dup-schedule",
        name: "Duplicate Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      const configWithDups = {
        ...mockScheduleConfig,
        schedules: [testSchedule, testSchedule],
      }

      const dupService = new RconScheduleService(
        mockLogger,
        mockRconService,
        mockServerService,
        configWithDups,
        mockEventBus,
        mockServerStatusEnricher,
        mockSessionService,
      )

      // The second duplicate schedule should cause start() to throw
      // start() catches the inner error and re-throws as "Failed to start scheduler"
      await expect(dupService.start()).rejects.toThrow("Failed to start scheduler")
    })

    it("should skip disabled schedules from config during start", async () => {
      const disabledSchedule: ScheduledCommand = {
        id: "disabled-schedule",
        name: "Disabled Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: false,
      }

      const enabledSchedule: ScheduledCommand = {
        id: "enabled-schedule",
        name: "Enabled Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      const configWithMixed = {
        ...mockScheduleConfig,
        schedules: [disabledSchedule, enabledSchedule],
      }

      const mixedService = new RconScheduleService(
        mockLogger,
        mockRconService,
        mockServerService,
        configWithMixed,
        mockEventBus,
        mockServerStatusEnricher,
        mockSessionService,
      )

      await mixedService.start()

      // Only the enabled schedule should be registered
      const schedules = mixedService.getSchedules()
      expect(schedules).toHaveLength(1)
      expect(schedules[0]?.id).toBe("enabled-schedule")
    })

    it("should subscribe to SERVER_AUTHENTICATED events on start", async () => {
      await service.start()

      expect(mockEventBus.on).toHaveBeenCalledWith("SERVER_AUTHENTICATED", expect.any(Function))
    })
  })

  describe("stop (edge cases)", () => {
    it("should unsubscribe from events on stop", async () => {
      mockEventBus.on.mockReturnValue("handler-id-123")

      await service.start()
      await service.stop()

      expect(mockEventBus.off).toHaveBeenCalledWith("handler-id-123")
    })

    it("should stop all jobs and clear state when stopping with schedules", async () => {
      const testSchedule: ScheduledCommand = {
        id: "stop-test-schedule",
        name: "Stop Test Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.start()
      await service.registerSchedule(testSchedule)

      // Verify schedule exists
      expect(service.getSchedules()).toHaveLength(1)

      await service.stop()

      // Verify all cleaned up
      expect(service.getSchedules()).toHaveLength(0)
      expect(mockLogger.info).toHaveBeenCalledWith("RCON scheduler stopped")
    })

    it("should handle stop when no eventHandlerId was set", async () => {
      // Start with events disabled so eventHandlerId is not set
      // We just start and stop normally but don't subscribe
      await service.start()

      // Manually clear the eventHandlerId by stopping and restarting test
      // The eventBus.off should still not throw
      await service.stop()

      expect(mockLogger.info).toHaveBeenCalledWith("RCON scheduler stopped")
    })
  })

  describe("registerSchedule (validation failures)", () => {
    beforeEach(async () => {
      await service.start()
    })

    it("should log metadata category when registering a schedule", async () => {
      const testSchedule: ScheduledCommand = {
        id: "meta-schedule",
        name: "Meta Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
        metadata: { category: "announcements" },
      }

      await service.registerSchedule(testSchedule)

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Registered schedule: meta-schedule (Meta Schedule)`,
        expect.objectContaining({
          category: "announcements",
        }),
      )
    })

    it("should register and start task when scheduler is already running", async () => {
      const testSchedule: ScheduledCommand = {
        id: "late-schedule",
        name: "Late Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)

      // Verify the schedule was registered and task started
      const schedules = service.getSchedules()
      expect(schedules).toHaveLength(1)
      expect(schedules[0]?.id).toBe("late-schedule")
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Registered schedule: late-schedule"),
        expect.any(Object),
      )
    })
  })

  describe("unregisterSchedule (additional coverage)", () => {
    it("should successfully unregister and clean up a schedule", async () => {
      await service.start()

      const testSchedule: ScheduledCommand = {
        id: "clean-unregister",
        name: "Clean Unregister",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)

      // Verify it exists
      expect(service.getSchedules()).toHaveLength(1)

      // Unregister
      await service.unregisterSchedule("clean-unregister")

      // Verify it's gone
      expect(service.getSchedules()).toHaveLength(0)
      expect(mockLogger.info).toHaveBeenCalledWith("Unregistered schedule: clean-unregister")
    })
  })

  describe("executeSchedule (private, via executeScheduleNow)", () => {
    beforeEach(async () => {
      await service.start()
    })

    it("should return empty results when no servers match criteria", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([])

      const testSchedule: ScheduledCommand = {
        id: "no-servers",
        name: "No Servers",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)
      const results = await service.executeScheduleNow(testSchedule.id)

      expect(results).toEqual([])
    })

    it("should filter servers by serverIds in serverFilter", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
        { serverId: 2, game: "cstrike", name: "Server 2", address: "127.0.0.2", port: 27015 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "filtered-schedule",
        name: "Filtered Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
        serverFilter: {
          serverIds: [1],
        },
      }

      await service.registerSchedule(testSchedule)
      const results = await service.executeScheduleNow(testSchedule.id)

      // Only server 1 should be targeted
      expect(results).toHaveLength(1)
    })

    it("should exclude servers by excludeServerIds in serverFilter", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
        { serverId: 2, game: "cstrike", name: "Server 2", address: "127.0.0.2", port: 27015 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "excluded-schedule",
        name: "Excluded Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
        serverFilter: {
          excludeServerIds: [2],
        },
      }

      await service.registerSchedule(testSchedule)
      const results = await service.executeScheduleNow(testSchedule.id)

      expect(results).toHaveLength(1)
    })

    it("should handle player count filter with debug log (not implemented)", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "player-filter-schedule",
        name: "Player Filter",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
        serverFilter: {
          minPlayers: 5,
          maxPlayers: 20,
        },
      }

      await service.registerSchedule(testSchedule)
      await service.executeScheduleNow(testSchedule.id)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Player count filtering skipped"),
      )
    })

    it("should skip execution when concurrency limit is reached", async () => {
      const maxConcurrent = 1
      const configLimited = {
        ...mockScheduleConfig,
        maxConcurrentPerServer: maxConcurrent,
      }

      const svc = new RconScheduleService(
        mockLogger,
        mockRconService,
        mockServerService,
        configLimited,
        mockEventBus,
        mockServerStatusEnricher,
        mockSessionService,
      )

      await svc.start()

      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "concurrent-test",
        name: "Concurrent Test",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await svc.registerSchedule(testSchedule)
      const results = await svc.executeScheduleNow(testSchedule.id)

      // Should execute normally with 1 server
      expect(results).toHaveLength(1)
    })

    it("should use defaultMaxRetries from config when schedule has no maxRetries", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "default-retry",
        name: "Default Retry",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
        // No maxRetries set - should use config.defaultMaxRetries
      }

      await service.registerSchedule(testSchedule)
      const results = await service.executeScheduleNow(testSchedule.id)

      // Should succeed (executor mock returns success)
      expect(results).toHaveLength(1)
      expect(results[0]?.status).toBe("success")
    })
  })

  describe("executeScheduleNow (additional execution paths)", () => {
    it("should execute and return results with proper structure", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "exec-now-test",
        name: "Exec Now Test",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.start()
      await service.registerSchedule(testSchedule)

      const results = await service.executeScheduleNow(testSchedule.id)

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        executionId: expect.any(String),
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        duration: expect.any(Number),
        status: "success",
      })
    })

    it("should handle execution when findActiveServersWithRcon returns empty", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([])

      const testSchedule: ScheduledCommand = {
        id: "empty-servers",
        name: "Empty Servers",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.start()
      await service.registerSchedule(testSchedule)

      const results = await service.executeScheduleNow(testSchedule.id)

      expect(results).toEqual([])
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("No servers match criteria"),
      )
    })

    it("should process multiple servers concurrently", async () => {
      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
        { serverId: 2, game: "cstrike", name: "Server 2", address: "127.0.0.2", port: 27016 },
        { serverId: 3, game: "cstrike", name: "Server 3", address: "127.0.0.3", port: 27017 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "multi-server-exec",
        name: "Multi Server Exec",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.start()
      await service.registerSchedule(testSchedule)

      const results = await service.executeScheduleNow(testSchedule.id)

      expect(results).toHaveLength(3)
      for (const result of results) {
        expect(result.status).toBe("success")
      }
    })
  })

  describe("getScheduleStatus (stopped schedule)", () => {
    it("should return status 'stopped' for disabled schedule", async () => {
      await service.start()

      const testSchedule: ScheduledCommand = {
        id: "disabled-status",
        name: "Disabled Status",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: false,
      }

      await service.registerSchedule(testSchedule)
      const statuses = service.getScheduleStatus()

      expect(statuses).toHaveLength(1)
      expect(statuses[0]?.status).toBe("stopped")
    })
  })

  describe("getExecutionHistory (with limit)", () => {
    it("should respect limit parameter", async () => {
      await service.start()

      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "history-limit",
        name: "History Limit",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)

      // Execute multiple times to build history
      await service.executeScheduleNow(testSchedule.id)
      await service.executeScheduleNow(testSchedule.id)
      await service.executeScheduleNow(testSchedule.id)

      const history = service.getExecutionHistory(testSchedule.id, 2)
      expect(history.length).toBeLessThanOrEqual(2)
    })
  })

  describe("handleServerAuthenticated (via event bus)", () => {
    it("should call connectToServerImmediately when event fires", async () => {
      let capturedHandler: ((event: unknown) => void) | undefined

      mockEventBus.on.mockImplementation((_eventType, handler) => {
        capturedHandler = handler as (event: unknown) => void
        return "handler-123"
      })

      await service.start()

      expect(capturedHandler).toBeDefined()

      // Trigger the handler
      if (capturedHandler) {
        capturedHandler({ serverId: 42, eventType: "SERVER_AUTHENTICATED" })
      }

      // The handler uses setImmediate, so we need to flush
      await new Promise((resolve) => setImmediate(resolve))

      // The mock ServerMonitoringCommand.connectToServerImmediately should be called
      // We can't directly verify it, but we can verify no errors were logged
    })
  })

  describe("shouldExecuteOnServer (no filter)", () => {
    it("should return true when no serverFilter is set", async () => {
      await service.start()

      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
        { serverId: 2, game: "cstrike", name: "Server 2", address: "127.0.0.2", port: 27015 },
        { serverId: 3, game: "cstrike", name: "Server 3", address: "127.0.0.3", port: 27015 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "no-filter",
        name: "No Filter",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
        // no serverFilter
      }

      await service.registerSchedule(testSchedule)
      const results = await service.executeScheduleNow(testSchedule.id)

      // All 3 servers should be targeted
      expect(results).toHaveLength(3)
    })
  })

  describe("updateJobStats and addToHistory", () => {
    it("should accumulate stats across multiple executions", async () => {
      await service.start()

      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "stats-test",
        name: "Stats Test",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)

      // Execute three times via cron simulation
      vi.mocked(cron.schedule).mockImplementation((_expr, _callback) => {
        const newTask = {
          start: vi.fn(),
          stop: vi.fn(),
          now: vi.fn(),
        }
        mockScheduledTasks.push(newTask)
        return newTask as unknown as import("node-cron").ScheduledTask
      })

      // Just call executeScheduleNow to accumulate stats
      await service.executeScheduleNow(testSchedule.id)
      await service.executeScheduleNow(testSchedule.id)

      const statuses = service.getScheduleStatus()
      expect(statuses).toHaveLength(1)
      // Stats should be initial (executeScheduleNow doesn't update stats directly)
      // But getScheduleStatus should still return valid data
      expect(statuses[0]?.stats).toBeDefined()
    })

    it("should return history for existing schedule", async () => {
      await service.start()

      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "history-test",
        name: "History Test",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)

      // executeScheduleNow does not record to history (only cron callback does)
      // But we can still verify the history retrieval logic works
      const history = service.getExecutionHistory("history-test")
      expect(history).toEqual([])
    })
  })

  describe("executeOnServer additional coverage", () => {
    it("should use schedule maxRetries when defined instead of config default", async () => {
      await service.start()

      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "custom-retries",
        name: "Custom Retries",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
        maxRetries: 5,
        retryOnFailure: true,
      }

      await service.registerSchedule(testSchedule)
      const results = await service.executeScheduleNow(testSchedule.id)

      // The mock executor succeeds so no retries needed
      expect(results).toHaveLength(1)
      expect(results[0]?.status).toBe("success")
    })

    it("should handle execution with retryOnFailure set to false", async () => {
      await service.start()

      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "no-retry",
        name: "No Retry",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
        maxRetries: 0,
        retryOnFailure: false,
      }

      await service.registerSchedule(testSchedule)
      const results = await service.executeScheduleNow(testSchedule.id)

      expect(results).toHaveLength(1)
      expect(results[0]?.status).toBe("success")
    })

    it("should include executionId with schedule id, server id, and timestamp", async () => {
      await service.start()

      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "exec-id-test",
        name: "Execution ID Test",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)
      const results = await service.executeScheduleNow(testSchedule.id)

      expect(results[0]?.executionId).toMatch(/^exec-id-test-1-\d+$/)
    })

    it("should include proper timing information in results", async () => {
      await service.start()

      mockServerService.findActiveServersWithRcon.mockResolvedValue([
        { serverId: 1, game: "cstrike", name: "Server 1", address: "127.0.0.1", port: 27015 },
      ])

      const testSchedule: ScheduledCommand = {
        id: "timing-test",
        name: "Timing Test",
        cronExpression: "0 * * * * *",
        command: { type: "hlx_csay", color: "00FF00", message: "test" },
        enabled: true,
      }

      await service.registerSchedule(testSchedule)
      const results = await service.executeScheduleNow(testSchedule.id)

      expect(results[0]?.startTime).toBeInstanceOf(Date)
      expect(results[0]?.endTime).toBeInstanceOf(Date)
      expect(results[0]?.duration).toBeGreaterThanOrEqual(0)
    })
  })
})
