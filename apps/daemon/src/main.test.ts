import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { HLStatsDaemon } from "./main"
import type { AppContext } from "@/context"
import type { BaseEvent } from "@/shared/types/events"

vi.mock("@/context")
vi.mock("@/shared/infrastructure/event-processor")

const mockContext = {
  logger: {
    info: vi.fn(),
    connecting: vi.fn(),
    connected: vi.fn(),
    ok: vi.fn(),
    ready: vi.fn(),
    failed: vi.fn(),
    shutdown: vi.fn(),
    shutdownComplete: vi.fn(),
    received: vi.fn(),
    fatal: vi.fn(),
  },
  database: {
    testConnection: vi.fn(),
    disconnect: vi.fn(),
  },
  ingressService: {
    start: vi.fn(),
    stop: vi.fn(),
  },
} as unknown as AppContext

const mockEventProcessor = {
  processEvent: vi.fn(),
}

describe("HLStatsDaemon", () => {
  let daemon: HLStatsDaemon

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { getAppContext } = vi.mocked(await import("@/context"))
    getAppContext.mockReturnValue(mockContext)

    const { EventProcessor } = vi.mocked(await import("@/shared/infrastructure/event-processor"))
    EventProcessor.mockReturnValue(mockEventProcessor as any)

    daemon = new HLStatsDaemon()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("constructor", () => {
    it("should initialize with development environment", async () => {
      process.env.NODE_ENV = "development"
      
      const { getAppContext } = vi.mocked(await import("@/context"))
      
      new HLStatsDaemon()
      
      expect(getAppContext).toHaveBeenCalledWith({ skipAuth: true })
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        "Initializing HLStatsNext Daemon with modular architecture"
      )
    })

    it("should initialize with production environment", async () => {
      process.env.NODE_ENV = "production"
      
      const { getAppContext } = vi.mocked(await import("@/context"))
      
      new HLStatsDaemon()
      
      expect(getAppContext).toHaveBeenCalledWith({ skipAuth: false })
    })

    it("should default to development when NODE_ENV is not set", async () => {
      delete process.env.NODE_ENV
      
      const { getAppContext } = vi.mocked(await import("@/context"))
      
      new HLStatsDaemon()
      
      expect(getAppContext).toHaveBeenCalledWith({ skipAuth: true })
    })
  })

  describe("start", () => {
    it("should start successfully when database connection succeeds", async () => {
      vi.mocked(mockContext.database.testConnection).mockResolvedValue(true)
      vi.mocked(mockContext.ingressService.start).mockResolvedValue(undefined)

      await daemon.start()

      expect(mockContext.logger.connecting).toHaveBeenCalledWith("database")
      expect(mockContext.database.testConnection).toHaveBeenCalled()
      expect(mockContext.logger.connected).toHaveBeenCalledWith("database")
      expect(mockContext.logger.info).toHaveBeenCalledWith("Starting services")
      expect(mockContext.ingressService.start).toHaveBeenCalled()
      expect(mockContext.logger.ok).toHaveBeenCalledWith("All services started successfully")
      expect(mockContext.logger.ready).toHaveBeenCalledWith(
        "HLStatsNext Daemon is ready to receive game server data"
      )
    })

    it("should exit when database connection fails", async () => {
      vi.mocked(mockContext.database.testConnection).mockResolvedValue(false)
      const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

      await daemon.start()

      expect(mockContext.logger.failed).toHaveBeenCalledWith(
        "Failed to start daemon",
        "Failed to connect to database"
      )
      expect(mockExit).toHaveBeenCalledWith(1)
      
      mockExit.mockRestore()
    })

    it("should handle service start errors", async () => {
      vi.mocked(mockContext.database.testConnection).mockResolvedValue(true)
      vi.mocked(mockContext.ingressService.start).mockRejectedValue(new Error("Service error"))
      const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

      await daemon.start()

      expect(mockContext.logger.failed).toHaveBeenCalledWith(
        "Failed to start daemon",
        "Service error"
      )
      expect(mockExit).toHaveBeenCalledWith(1)
      
      mockExit.mockRestore()
    })

    it("should handle database test connection errors", async () => {
      vi.mocked(mockContext.database.testConnection).mockRejectedValue(new Error("DB Error"))
      const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)

      await daemon.start()

      expect(mockContext.logger.failed).toHaveBeenCalledWith(
        "Database connection test failed",
        "DB Error"
      )
      expect(mockContext.logger.failed).toHaveBeenCalledWith(
        "Failed to start daemon",
        "Failed to connect to database"
      )
      expect(mockExit).toHaveBeenCalledWith(1)
      
      mockExit.mockRestore()
    })
  })

  describe("stop", () => {
    it("should stop successfully", async () => {
      vi.mocked(mockContext.ingressService.stop).mockResolvedValue(undefined)
      vi.mocked(mockContext.database.disconnect).mockResolvedValue(undefined)

      await daemon.stop()

      expect(mockContext.logger.shutdown).toHaveBeenCalled()
      expect(mockContext.ingressService.stop).toHaveBeenCalled()
      expect(mockContext.database.disconnect).toHaveBeenCalled()
      expect(mockContext.logger.info).toHaveBeenCalledWith("Database connection closed")
      expect(mockContext.logger.shutdownComplete).toHaveBeenCalled()
    })

    it("should handle service stop errors", async () => {
      vi.mocked(mockContext.ingressService.stop).mockRejectedValue(new Error("Stop error"))
      vi.mocked(mockContext.database.disconnect).mockResolvedValue(undefined)

      await daemon.stop()

      expect(mockContext.logger.failed).toHaveBeenCalledWith(
        "Error during shutdown",
        "Stop error"
      )
    })

    it("should handle database disconnect errors", async () => {
      vi.mocked(mockContext.ingressService.stop).mockResolvedValue(undefined)
      vi.mocked(mockContext.database.disconnect).mockRejectedValue(new Error("Disconnect error"))

      await daemon.stop()

      expect(mockContext.logger.failed).toHaveBeenCalledWith(
        "Error closing database connection",
        "Disconnect error"
      )
    })
  })

  describe("processEvent", () => {
    it("should process events through event processor", async () => {
      const mockEvent = { type: "test" } as BaseEvent
      vi.mocked(mockEventProcessor.processEvent).mockResolvedValue(undefined)

      await daemon.processEvent(mockEvent)

      expect(mockEventProcessor.processEvent).toHaveBeenCalledWith(mockEvent)
    })
  })

  describe("getContext", () => {
    it("should return application context", () => {
      const context = daemon.getContext()
      expect(context).toBe(mockContext)
    })
  })
})