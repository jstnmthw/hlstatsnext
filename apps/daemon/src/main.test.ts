import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { HLStatsDaemon } from "./main"
import type { AppContext } from "@/context"
import type { BaseEvent, EventType } from "@/shared/types/events"
import { getAppContext, initializeQueueInfrastructure } from "@/context"
import { getEnvironmentConfig } from "@/config/environment.config"
import { RconMonitorService } from "@/modules/rcon/services/rcon-monitor.service"
import { DatabaseConnectionService } from "@/database/connection.service"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockDatabaseClient } from "@/tests/mocks/database"
import { DeterministicUuidService } from "@/shared/infrastructure/identifiers/deterministic-uuid.service"
import { setUuidService } from "@/shared/infrastructure/messaging/queue/utils/message-utils"
import { SystemClock } from "@/shared/infrastructure/time/system-clock"

vi.mock("@/context")
vi.mock("@/config/environment.config")
vi.mock("@/modules/rcon/services/rcon-monitor.service")
vi.mock("@/database/connection.service")
vi.mock("@/shared/infrastructure/messaging/queue/utils/message-utils", () => {
  let currentUuidService: unknown = null
  return {
    getUuidService: () => currentUuidService,
    setUuidService: (service: unknown) => {
      currentUuidService = service
    },
  }
})

const mockEventPublisher = {
  publish: vi.fn(),
  publishBatch: vi.fn(),
}

const mockRconMonitor = {
  start: vi.fn(),
  stop: vi.fn(),
  connectToServerImmediately: vi.fn(),
}

const mockDatabaseConnection = {
  testConnection: vi.fn(),
  disconnect: vi.fn(),
}

const mockContext = {
  logger: createMockLogger(),
  database: createMockDatabaseClient(),
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    clearHandlers: vi.fn(),
    getStats: vi.fn(),
  },
  ingressService: {
    start: vi.fn(),
    stop: vi.fn(),
    processRawEvent: vi.fn().mockResolvedValue(null),
  },
  rconService: {
    disconnectAll: vi.fn(),
  },
  rconScheduleService: {
    start: vi.fn(),
    stop: vi.fn(),
  },
  eventPublisher: mockEventPublisher,
  queueModule: {
    shutdown: vi.fn(),
  },
} as unknown as AppContext

describe("HLStatsDaemon", () => {
  let daemon: HLStatsDaemon

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getAppContext).mockReturnValue(mockContext)
    vi.mocked(initializeQueueInfrastructure).mockResolvedValue()

    vi.mocked(getEnvironmentConfig).mockReturnValue({
      nodeEnv: "test",
      ingressOptions: {},
      rconConfig: { enabled: true, statusInterval: 30000 },
      scheduleConfig: {
        enabled: true,
        defaultTimeoutMs: 30000,
        historyRetentionHours: 24,
        maxConcurrentPerServer: 3,
      },
    })

    const MockedRconMonitorService = vi.mocked(RconMonitorService, true)
    MockedRconMonitorService.mockImplementation(
      () => mockRconMonitor as unknown as InstanceType<typeof RconMonitorService>,
    )

    const MockedDatabaseConnectionService = vi.mocked(DatabaseConnectionService, true)
    MockedDatabaseConnectionService.mockImplementation(
      () => mockDatabaseConnection as unknown as InstanceType<typeof DatabaseConnectionService>,
    )

    daemon = new HLStatsDaemon()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("constructor", () => {
    it("should initialize with proper configuration", async () => {
      const mockedGetAppContext = vi.mocked(getAppContext)

      expect(mockedGetAppContext).toHaveBeenCalledWith({})
      expect(mockContext.logger.info).toHaveBeenCalledWith("Initializing HLStatsNext Daemon...")
    })
  })

  describe("start", () => {
    beforeEach(() => {
      // Initialize UUID service for tests (following pattern from other tests)
      const systemClock = new SystemClock()
      setUuidService(new DeterministicUuidService(systemClock))
    })

    it("should start successfully when database connection succeeds", async () => {
      vi.mocked(mockDatabaseConnection.testConnection).mockResolvedValue(true)
      vi.mocked(mockContext.ingressService.start).mockResolvedValue(undefined)

      await daemon.start()

      expect(mockDatabaseConnection.testConnection).toHaveBeenCalled()
      expect(mockContext.logger.info).toHaveBeenCalledWith("Running preflight checks...")
      expect(mockContext.logger.ok).toHaveBeenCalledWith("All preflight checks passed")
      expect(mockContext.logger.info).toHaveBeenCalledWith("Starting services")
      expect(mockContext.ingressService.start).toHaveBeenCalled()
      expect(mockRconMonitor.start).toHaveBeenCalled()
      expect(mockContext.logger.ok).toHaveBeenCalledWith("All services started successfully")
      expect(mockContext.logger.ready).toHaveBeenCalledWith(
        "HLStatsNext Daemon is ready to receive game server data",
      )
    })

    it("should exit when database connection fails", async () => {
      vi.mocked(mockDatabaseConnection.testConnection).mockResolvedValue(false)
      const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

      await daemon.start()

      expect(mockContext.logger.failed).toHaveBeenCalledWith(
        "Failed to start daemon",
        "Failed to connect to database",
      )
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })

    it("should handle service start errors", async () => {
      vi.mocked(mockDatabaseConnection.testConnection).mockResolvedValue(true)
      // Mock an error in the service startup phase (after preflight checks)
      vi.mocked(mockContext.ingressService.start).mockRejectedValue(new Error("Service error"))
      const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

      await daemon.start()

      expect(mockContext.logger.failed).toHaveBeenCalledWith(
        "Failed to start daemon",
        "Service error",
      )
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })

    it("should fail startup when UUID service is not initialized", async () => {
      vi.mocked(mockDatabaseConnection.testConnection).mockResolvedValue(true)

      // Clear UUID service to simulate uninitialized state
      setUuidService(null as never)

      const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

      await daemon.start()

      expect(mockContext.logger.failed).toHaveBeenCalledWith(
        "Failed to start daemon",
        expect.stringContaining("UUID service preflight check failed"),
      )
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })

    it("should fail startup when event publisher is not available", async () => {
      vi.mocked(mockDatabaseConnection.testConnection).mockResolvedValue(true)

      // Remove event publisher from context but ensure UUID service is working
      const contextWithoutPublisher = {
        ...mockContext,
        eventPublisher: undefined,
        logger: createMockLogger(), // Fresh logger for this test
      }
      vi.mocked(getAppContext).mockReturnValue(contextWithoutPublisher)

      const newDaemon = new HLStatsDaemon()
      const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

      await newDaemon.start()

      expect(contextWithoutPublisher.logger.failed).toHaveBeenCalledWith(
        "Failed to start daemon",
        expect.stringContaining("Event publisher not initialized"),
      )
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })

    it("should validate parser functionality with sample log line", async () => {
      vi.mocked(mockDatabaseConnection.testConnection).mockResolvedValue(true)
      vi.mocked(mockContext.ingressService.start).mockResolvedValue(undefined)

      await daemon.start()

      // Verify processRawEvent was called with test data during preflight
      expect(mockContext.ingressService.processRawEvent).toHaveBeenCalledWith(
        'L 01/01/2024 - 12:00:00: "TestPlayer<999><STEAM_TEST><CT>" connected',
        "127.0.0.1",
        27015,
      )
      expect(mockContext.logger.debug).toHaveBeenCalledWith(
        "Parser functionality validated successfully",
      )
    })

    it("should handle parser errors gracefully during preflight", async () => {
      vi.mocked(mockDatabaseConnection.testConnection).mockResolvedValue(true)

      // Make processRawEvent throw an error (parser error)
      vi.mocked(mockContext.ingressService.processRawEvent).mockRejectedValue(
        new Error("Parser error"),
      )

      const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

      await daemon.start()

      expect(mockContext.logger.failed).toHaveBeenCalledWith(
        "Failed to start daemon",
        expect.stringContaining("Parser preflight check failed: Parser error"),
      )
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
    })
  })

  describe("stop", () => {
    it("should stop successfully", async () => {
      vi.mocked(mockContext.ingressService.stop).mockResolvedValue(undefined)
      vi.mocked(mockContext.rconService.disconnectAll).mockResolvedValue(undefined)
      vi.mocked(mockContext.rconScheduleService.stop).mockResolvedValue(undefined)
      vi.mocked(mockDatabaseConnection.disconnect).mockResolvedValue(undefined)

      await daemon.stop()

      expect(mockContext.logger.shutdown).toHaveBeenCalled()
      expect(mockContext.rconScheduleService.stop).toHaveBeenCalled()
      expect(mockRconMonitor.stop).toHaveBeenCalled()
      expect(mockContext.ingressService.stop).toHaveBeenCalled()
      expect(mockContext.rconService.disconnectAll).toHaveBeenCalled()
      expect(mockDatabaseConnection.disconnect).toHaveBeenCalled()
      expect(mockContext.logger.shutdownComplete).toHaveBeenCalled()
    })

    it("should handle service stop errors", async () => {
      vi.mocked(mockContext.rconScheduleService.stop).mockResolvedValue(undefined)
      vi.mocked(mockContext.ingressService.stop).mockRejectedValue(new Error("Stop error"))
      vi.mocked(mockContext.rconService.disconnectAll).mockResolvedValue(undefined)
      vi.mocked(mockDatabaseConnection.disconnect).mockResolvedValue(undefined)

      await daemon.stop()

      expect(mockContext.logger.failed).toHaveBeenCalledWith("Error during shutdown", "Stop error")
    })
  })

  describe("emitEvents", () => {
    it("should emit events through queue publisher", async () => {
      const mockEvent: BaseEvent = {
        eventType: "PLAYER_CONNECT" as EventType,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      }
      vi.mocked(mockEventPublisher.publish).mockResolvedValue(undefined)

      await daemon.emitEvents([mockEvent])

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(mockEvent)
    })
  })

  describe("getContext", () => {
    it("should return application context", () => {
      const context = daemon.getContext()
      expect(context).toBe(mockContext)
    })
  })
})
