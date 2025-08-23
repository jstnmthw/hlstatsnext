import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { HLStatsDaemon } from "./main"
import type { AppContext } from "@/context"
import type { BaseEvent, EventType } from "@/shared/types/events"
import { getAppContext } from "@/context"
import { getEnvironmentConfig } from "@/config/environment.config"
import { RconMonitorService } from "@/modules/rcon/rcon-monitor.service"
import { DatabaseConnectionService } from "@/database/connection.service"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockDatabaseClient } from "@/tests/mocks/database"

vi.mock("@/context")
vi.mock("@/config/environment.config")
vi.mock("@/modules/rcon/rcon-monitor.service")
vi.mock("@/database/connection.service")

const mockEventPublisher = {
  publish: vi.fn(),
  publishBatch: vi.fn(),
}

const mockRconMonitor = {
  start: vi.fn(),
  stop: vi.fn(),
}

const mockDatabaseConnection = {
  testConnection: vi.fn(),
  disconnect: vi.fn(),
}

const mockContext = {
  logger: createMockLogger(),
  database: createMockDatabaseClient(),
  ingressService: {
    start: vi.fn(),
    stop: vi.fn(),
  },
  rconService: {
    disconnectAll: vi.fn(),
  },
  eventPublisher: mockEventPublisher,
} as unknown as AppContext

describe("HLStatsDaemon", () => {
  let daemon: HLStatsDaemon

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getAppContext).mockReturnValue(mockContext)

    vi.mocked(getEnvironmentConfig).mockReturnValue({
      nodeEnv: "test",
      ingressOptions: {},
      rconConfig: { enabled: true, statusInterval: 30000 },
    })

    vi.mocked(RconMonitorService).mockImplementation(
      () => mockRconMonitor as unknown as InstanceType<typeof RconMonitorService>,
    )

    vi.mocked(DatabaseConnectionService).mockImplementation(
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
    it("should start successfully when database connection succeeds", async () => {
      vi.mocked(mockDatabaseConnection.testConnection).mockResolvedValue(true)
      vi.mocked(mockContext.ingressService.start).mockResolvedValue(undefined)

      await daemon.start()

      expect(mockDatabaseConnection.testConnection).toHaveBeenCalled()
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
  })

  describe("stop", () => {
    it("should stop successfully", async () => {
      vi.mocked(mockContext.ingressService.stop).mockResolvedValue(undefined)
      vi.mocked(mockContext.rconService.disconnectAll).mockResolvedValue(undefined)
      vi.mocked(mockDatabaseConnection.disconnect).mockResolvedValue(undefined)

      await daemon.stop()

      expect(mockContext.logger.shutdown).toHaveBeenCalled()
      expect(mockRconMonitor.stop).toHaveBeenCalled()
      expect(mockContext.ingressService.stop).toHaveBeenCalled()
      expect(mockContext.rconService.disconnectAll).toHaveBeenCalled()
      expect(mockDatabaseConnection.disconnect).toHaveBeenCalled()
      expect(mockContext.logger.shutdownComplete).toHaveBeenCalled()
    })

    it("should handle service stop errors", async () => {
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
