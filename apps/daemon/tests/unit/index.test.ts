import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Mocked } from "vitest"

// Using relative paths to avoid module resolution issues in IDE/linter
import { DatabaseClient } from "../../src/database/client"
import { IngressService } from "../../src/services/ingress/ingress.service"
import * as processorService from "../../src/services/processor/processor.service"
import { RconService } from "../../src/services/rcon/rcon.service"
import { StatisticsService } from "../../src/services/statistics/statistics.service"
import { HLStatsDaemon } from "../../src/index"
import { logger } from "../../src/utils/logger"
import type { IEventProcessor } from "../../src/services/processor/processor.types"

vi.mock("../../src/database/client")
vi.mock("../../src/services/ingress/ingress.service")
vi.mock("../../src/services/rcon/rcon.service")
vi.mock("../../src/services/statistics/statistics.service")

// Mock the entire processor service module
const mockProcessor: Mocked<IEventProcessor> = {
  enqueue: vi.fn(),
  processEvent: vi.fn(),
  getTopPlayers: vi.fn(),
}

const createEventProcessorServiceSpy = vi
  .spyOn(processorService, "createEventProcessorService")
  .mockReturnValue(mockProcessor)

// Mock process.exit to prevent tests from terminating
const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never)

const mockLoggerOk = vi.spyOn(logger, "ok").mockImplementation(() => undefined)
const mockLoggerFailed = vi.spyOn(logger, "failed").mockImplementation(() => undefined)

describe("HLStatsDaemon", () => {
  let daemon: HLStatsDaemon

  beforeEach(() => {
    vi.clearAllMocks()
    daemon = new HLStatsDaemon()
  })

  it("should initialize all services in the constructor", () => {
    // The constructor is called in the beforeEach block
    expect(DatabaseClient).toHaveBeenCalledTimes(1)
    expect(createEventProcessorServiceSpy).toHaveBeenCalledTimes(1)
    expect(IngressService).toHaveBeenCalledTimes(1)
    expect(RconService).toHaveBeenCalledTimes(1)
    expect(StatisticsService).toHaveBeenCalledTimes(1)
  })

  describe("start", () => {
    it("should start all services successfully", async () => {
      const dbInstance = vi.mocked(DatabaseClient).mock.instances[0] as Mocked<DatabaseClient>
      dbInstance.testConnection.mockResolvedValue(true)

      const ingressInstance = vi.mocked(IngressService).mock.instances[0] as Mocked<IngressService>
      ingressInstance.start.mockResolvedValue(undefined)

      const rconInstance = vi.mocked(RconService).mock.instances[0] as Mocked<RconService>
      rconInstance.start.mockResolvedValue(undefined)

      const statisticsInstance = vi.mocked(StatisticsService).mock
        .instances[0] as Mocked<StatisticsService>
      statisticsInstance.start.mockResolvedValue(undefined)

      await daemon.start()

      expect(dbInstance.testConnection).toHaveBeenCalled()
      expect(ingressInstance.start).toHaveBeenCalled()
      expect(rconInstance.start).toHaveBeenCalled()
      expect(statisticsInstance.start).toHaveBeenCalled()

      expect(mockLoggerOk).toHaveBeenCalledWith(
        expect.stringContaining("All services started successfully"),
      )
    })

    it("should exit if database connection fails", async () => {
      const dbInstance = vi.mocked(DatabaseClient).mock.instances[0] as Mocked<DatabaseClient>
      dbInstance.testConnection.mockResolvedValue(false)

      await daemon.start()

      expect(mockLoggerFailed).toHaveBeenCalledWith(
        "Failed to start daemon",
        expect.stringContaining("Failed to connect to database"),
      )
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it("should exit if a service fails to start", async () => {
      const dbInstance = vi.mocked(DatabaseClient).mock.instances[0] as Mocked<DatabaseClient>
      dbInstance.testConnection.mockResolvedValue(true)

      const ingressInstance = vi.mocked(IngressService).mock.instances[0] as Mocked<IngressService>
      const startError = new Error("Ingress failed")
      ingressInstance.start.mockRejectedValue(startError)

      await daemon.start()

      expect(mockLoggerFailed).toHaveBeenCalledWith("Failed to start daemon", "Ingress failed")
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe("stop", () => {
    it("should stop all services successfully", async () => {
      const dbInstance = vi.mocked(DatabaseClient).mock.instances[0] as Mocked<DatabaseClient>
      dbInstance.disconnect.mockResolvedValue(undefined)
      const ingressInstance = vi.mocked(IngressService).mock.instances[0] as Mocked<IngressService>
      ingressInstance.stop.mockResolvedValue(undefined)
      const rconInstance = vi.mocked(RconService).mock.instances[0] as Mocked<RconService>
      rconInstance.stop.mockResolvedValue(undefined)
      const statisticsInstance = vi.mocked(StatisticsService).mock
        .instances[0] as Mocked<StatisticsService>
      statisticsInstance.stop.mockResolvedValue(undefined)

      await daemon.stop()

      expect(ingressInstance.stop).toHaveBeenCalled()
      expect(rconInstance.stop).toHaveBeenCalled()
      expect(statisticsInstance.stop).toHaveBeenCalled()
      expect(dbInstance.disconnect).toHaveBeenCalled()

      expect(mockLoggerOk).toHaveBeenCalledWith(expect.stringContaining("Daemon shutdown complete"))
    })

    it("should log an error if a service fails to stop", async () => {
      const ingressInstance = vi.mocked(IngressService).mock.instances[0] as Mocked<IngressService>
      const stopError = new Error("Ingress stop failed")
      ingressInstance.stop.mockRejectedValue(stopError)

      await daemon.stop()

      expect(mockLoggerFailed).toHaveBeenCalledWith("Error during shutdown", "Ingress stop failed")
    })
  })
})
