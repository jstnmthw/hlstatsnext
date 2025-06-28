import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Mocked } from "vitest"

// Using relative paths to avoid module resolution issues in IDE/linter
import { DatabaseClient } from "../../src/database/client"
import { GatewayService } from "../../src/services/gateway/gateway.service"
import { IngressService } from "../../src/services/ingress/ingress.service"
import { EventProcessorService } from "../../src/services/processor/processor.service"
import { RconService } from "../../src/services/rcon/rcon.service"
import { StatisticsService } from "../../src/services/statistics/statistics.service"
import { HLStatsDaemon } from "../../src/index"
import { logger } from "../../src/utils/logger"

vi.mock("../../src/database/client")
vi.mock("../../src/services/gateway/gateway.service")
vi.mock("../../src/services/ingress/ingress.service")
vi.mock("../../src/services/processor/processor.service")
vi.mock("../../src/services/rcon/rcon.service")
vi.mock("../../src/services/statistics/statistics.service")

// Mock process.exit to prevent tests from terminating
const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never)

const mockLoggerOk = vi.spyOn(logger, "ok").mockImplementation(() => undefined)
const mockLoggerError = vi.spyOn(logger, "error").mockImplementation(() => undefined)

describe("HLStatsDaemon", () => {
  let daemon: HLStatsDaemon

  beforeEach(() => {
    vi.clearAllMocks()
    daemon = new HLStatsDaemon()
  })

  it("should initialize all services in the constructor", () => {
    // The constructor is called in the beforeEach block
    expect(DatabaseClient).toHaveBeenCalledTimes(1)
    expect(EventProcessorService).toHaveBeenCalledTimes(1)
    expect(GatewayService).toHaveBeenCalledTimes(1)
    expect(IngressService).toHaveBeenCalledTimes(1)
    expect(RconService).toHaveBeenCalledTimes(1)
    expect(StatisticsService).toHaveBeenCalledTimes(1)
  })

  describe("start", () => {
    it("should start all services successfully", async () => {
      // Since the constructor was called, we can get the instance from the mock
      const processorInstance = vi.mocked(EventProcessorService).mock.instances[0] as Mocked<EventProcessorService>
      processorInstance.testDatabaseConnection.mockResolvedValue(true)

      const gatewayInstance = vi.mocked(GatewayService).mock.instances[0] as Mocked<GatewayService>
      gatewayInstance.start.mockResolvedValue(undefined)

      const ingressInstance = vi.mocked(IngressService).mock.instances[0] as Mocked<IngressService>
      ingressInstance.start.mockResolvedValue(undefined)

      const rconInstance = vi.mocked(RconService).mock.instances[0] as Mocked<RconService>
      rconInstance.start.mockResolvedValue(undefined)

      const statisticsInstance = vi.mocked(StatisticsService).mock.instances[0] as Mocked<StatisticsService>
      statisticsInstance.start.mockResolvedValue(undefined)

      await daemon.start()

      expect(processorInstance.testDatabaseConnection).toHaveBeenCalled()
      expect(gatewayInstance.start).toHaveBeenCalled()
      expect(ingressInstance.start).toHaveBeenCalled()
      expect(rconInstance.start).toHaveBeenCalled()
      expect(statisticsInstance.start).toHaveBeenCalled()

      expect(mockLoggerOk).toHaveBeenCalledWith(expect.stringContaining("All services started successfully"))
    })

    it("should exit if database connection fails", async () => {
      const processorInstance = vi.mocked(EventProcessorService).mock.instances[0] as Mocked<EventProcessorService>
      processorInstance.testDatabaseConnection.mockResolvedValue(false)

      await daemon.start()

      expect(mockLoggerError).toHaveBeenCalledWith(expect.stringContaining("Failed to start daemon"))
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it("should exit if a service fails to start", async () => {
      const processorInstance = vi.mocked(EventProcessorService).mock.instances[0] as Mocked<EventProcessorService>
      processorInstance.testDatabaseConnection.mockResolvedValue(true)

      const gatewayInstance = vi.mocked(GatewayService).mock.instances[0] as Mocked<GatewayService>
      const startError = new Error("Gateway failed")
      gatewayInstance.start.mockRejectedValue(startError)

      await daemon.start()

      expect(mockLoggerError).toHaveBeenCalledWith(expect.stringContaining("Failed to start daemon"))
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe("stop", () => {
    it("should stop all services successfully", async () => {
      const gatewayInstance = vi.mocked(GatewayService).mock.instances[0] as Mocked<GatewayService>
      gatewayInstance.stop.mockResolvedValue(undefined)
      const ingressInstance = vi.mocked(IngressService).mock.instances[0] as Mocked<IngressService>
      ingressInstance.stop.mockResolvedValue(undefined)
      const rconInstance = vi.mocked(RconService).mock.instances[0] as Mocked<RconService>
      rconInstance.stop.mockResolvedValue(undefined)
      const statisticsInstance = vi.mocked(StatisticsService).mock.instances[0] as Mocked<StatisticsService>
      statisticsInstance.stop.mockResolvedValue(undefined)
      const processorInstance = vi.mocked(EventProcessorService).mock.instances[0] as Mocked<EventProcessorService>
      processorInstance.disconnect.mockResolvedValue(undefined)

      await daemon.stop()

      expect(gatewayInstance.stop).toHaveBeenCalled()
      expect(ingressInstance.stop).toHaveBeenCalled()
      expect(rconInstance.stop).toHaveBeenCalled()
      expect(statisticsInstance.stop).toHaveBeenCalled()
      expect(processorInstance.disconnect).toHaveBeenCalled()

      expect(mockLoggerOk).toHaveBeenCalledWith(expect.stringContaining("Daemon shutdown complete"))
    })

    it("should log an error if a service fails to stop", async () => {
      const gatewayInstance = vi.mocked(GatewayService).mock.instances[0] as Mocked<GatewayService>
      const stopError = new Error("Gateway stop failed")
      gatewayInstance.stop.mockRejectedValue(stopError)

      await daemon.stop()

      expect(mockLoggerError).toHaveBeenCalledWith(expect.stringContaining("Error during shutdown"))
    })
  })
})
