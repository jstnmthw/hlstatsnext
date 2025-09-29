/**
 * RCON Schedule Service Tests
 *
 * Tests for the scheduled RCON command execution service.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from "vitest"
import { mockDeep, type MockProxy } from "vitest-mock-extended"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IRconService } from "../types/rcon.types"
import type { IServerService } from "@/modules/server/server.types"
import type { ScheduleConfig, ScheduledCommand } from "../types/schedule.types"
import type { IEventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus.types"
import type { IServerStatusEnricher } from "@/modules/server/enrichers/server-status-enricher"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import { RconScheduleService } from "./rcon-schedule.service"
import * as cron from "node-cron"

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
        command: { type: "server-message", message: "test message" },
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
        command: { type: "server-message", message: "test" },
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
        command: { type: "server-message", message: "test message" },
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
        command: { type: "server-message", message: "test" },
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
        command: { type: "server-message", message: "Hello players!" },
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
        command: { type: "server-message", message: "test message" },
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
        command: { type: "server-message", message: "test" },
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
        command: { type: "server-message", message: "test" },
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
        command: { type: "server-message", message: "test" },
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
        command: { type: "server-message", message: "test" },
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
        command: { type: "server-message", message: "test" },
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
        command: { type: "server-message", message: "test" },
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
        command: { type: "server-message", message: "original" },
        enabled: true,
      }

      const updatedSchedule: ScheduledCommand = {
        ...originalSchedule,
        name: "Updated Test Schedule",
        command: { type: "server-message", message: "updated" },
      }

      await service.registerSchedule(originalSchedule)
      await service.updateSchedule(updatedSchedule)

      const schedules = service.getSchedules()
      expect(schedules[0]?.name).toBe("Updated Test Schedule")
      expect(schedules[0]?.command).toEqual({ type: "server-message", message: "updated" })
    })

    it("should register new schedule if it doesn't exist", async () => {
      const newSchedule: ScheduledCommand = {
        id: "new-schedule",
        name: "New Schedule",
        cronExpression: "0 * * * * *",
        command: { type: "server-message", message: "new" },
        enabled: true,
      }

      await service.updateSchedule(newSchedule)

      const schedules = service.getSchedules()
      expect(schedules).toHaveLength(1)
      expect(schedules[0]?.id).toBe("new-schedule")
    })
  })
})
