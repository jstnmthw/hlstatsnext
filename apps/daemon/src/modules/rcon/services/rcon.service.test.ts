/**
 * RCON Service Unit Tests
 *
 * Tests covering branches of the RCON service that don't require
 * working protocol mocks (which vi.mock cannot intercept for the
 * service's own imports).
 */

import { createMockLogger } from "@/tests/mocks/logger"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type {
  IRconProtocol,
  IRconRepository,
  RconConfig,
  RconCredentials,
} from "../types/rcon.types"
import { GameEngine, RconError, RconProtocolType } from "../types/rcon.types"
import { RconService } from "./rcon.service"

// Mock the protocol classes to avoid real socket creation
vi.mock("../protocols/source-rcon.protocol", () => ({
  SourceRconProtocol: vi.fn().mockImplementation(() => createMockProtocol(RconProtocolType.SOURCE)),
}))

vi.mock("../protocols/goldsrc-rcon.protocol", () => ({
  GoldSrcRconProtocol: vi
    .fn()
    .mockImplementation(() => createMockProtocol(RconProtocolType.GOLDSRC)),
}))

vi.mock("../parsers/goldsrc-status.parser", () => ({
  GoldSrcStatusParser: vi.fn().mockImplementation(() => ({
    parseStatus: vi.fn().mockReturnValue({
      map: "de_dust2",
      players: 20,
      maxPlayers: 32,
      uptime: 3600,
      fps: 128,
      timestamp: new Date(),
    }),
  })),
}))

function createMockProtocol(type: RconProtocolType = RconProtocolType.SOURCE): IRconProtocol {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn().mockResolvedValue("command output"),
    isConnected: vi.fn().mockReturnValue(true),
    getType: vi.fn().mockReturnValue(type),
  }
}

const mockLogger = createMockLogger()

function createMockRepository(): IRconRepository {
  return {
    getRconCredentials: vi.fn(),
    updateServerStatus: vi.fn(),
  }
}

const testCredentials: RconCredentials = {
  serverId: 1,
  address: "127.0.0.1",
  port: 27015,
  rconPassword: "test_password",
  gameEngine: GameEngine.SOURCE,
}

describe("RconService", () => {
  let rconService: RconService
  let mockRepository: IRconRepository

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockRepository = createMockRepository()
    const testConfig: Partial<RconConfig> = {
      enabled: true,
      timeout: 100,
      maxRetries: 2,
      statusInterval: 1000,
      maxConnectionsPerServer: 1,
    }
    rconService = new RconService(mockRepository, mockLogger, testConfig)
  })

  afterEach(async () => {
    vi.useRealTimers()
  })

  describe("constructor", () => {
    it("should use default configuration when none provided", () => {
      vi.clearAllMocks()
      new RconService(mockRepository, mockLogger)
      expect(mockLogger.info).toHaveBeenCalledWith(
        "RCON service initialized",
        expect.objectContaining({
          config: expect.objectContaining({
            enabled: true,
            statusInterval: 30000,
            timeout: 5000,
            maxRetries: 3,
            maxConnectionsPerServer: 1,
          }),
        }),
      )
    })

    it("should merge custom configuration with defaults", () => {
      vi.clearAllMocks()
      const customConfig = {
        enabled: false,
        timeout: 10000,
        maxRetries: 5,
      }

      new RconService(mockRepository, mockLogger, customConfig)
      expect(mockLogger.info).toHaveBeenCalledWith(
        "RCON service initialized",
        expect.objectContaining({
          config: expect.objectContaining({
            enabled: false,
            timeout: 10000,
            maxRetries: 5,
            statusInterval: 30000,
            maxConnectionsPerServer: 1,
          }),
        }),
      )
    })
  })

  describe("connect", () => {
    it("should throw error when service is disabled", async () => {
      const disabledService = new RconService(mockRepository, mockLogger, { enabled: false })

      await expect(disabledService.connect(1)).rejects.toThrow(RconError)
      await expect(disabledService.connect(1)).rejects.toThrow("RCON service is disabled")
    })

    it("should throw error when no credentials found", async () => {
      vi.mocked(mockRepository.getRconCredentials).mockResolvedValue(null)

      await expect(rconService.connect(1)).rejects.toThrow(RconError)
      await expect(rconService.connect(1)).rejects.toThrow("No RCON credentials found")
    })

    it("should throw for unsupported game engine", async () => {
      const badCredentials: RconCredentials = {
        ...testCredentials,
        gameEngine: 999 as GameEngine,
      }
      vi.mocked(mockRepository.getRconCredentials).mockResolvedValue(badCredentials)

      await expect(rconService.connect(1)).rejects.toThrow("Unsupported game engine")
    })

    it("should fail after all retry attempts exhausted", async () => {
      // Use maxRetries: 1 to avoid timer delays and unhandled rejection issues
      const singleRetryService = new RconService(mockRepository, mockLogger, {
        enabled: true,
        maxRetries: 1,
      })
      vi.mocked(mockRepository.getRconCredentials).mockResolvedValue(testCredentials)

      const failProtocol: IRconProtocol = {
        connect: vi.fn().mockRejectedValue(new Error("Connection refused")),
        disconnect: vi.fn().mockResolvedValue(undefined),
        execute: vi.fn(),
        isConnected: vi.fn().mockReturnValue(false),
        getType: vi.fn().mockReturnValue(RconProtocolType.SOURCE),
      }
      vi.spyOn(RconService.prototype as any, "createProtocol").mockReturnValue(failProtocol)

      await expect(singleRetryService.connect(1)).rejects.toThrow(
        "RCON connection failed to server 1 after 1 attempts",
      )
    })

    it("should wrap non-Error objects in Error during retry", async () => {
      // Use maxRetries: 1 to avoid timer delays and unhandled rejection issues
      const singleRetryService = new RconService(mockRepository, mockLogger, {
        enabled: true,
        maxRetries: 1,
      })
      vi.mocked(mockRepository.getRconCredentials).mockResolvedValue(testCredentials)

      const failProtocol: IRconProtocol = {
        connect: vi.fn().mockRejectedValue("string error"),
        disconnect: vi.fn().mockResolvedValue(undefined),
        execute: vi.fn(),
        isConnected: vi.fn().mockReturnValue(false),
        getType: vi.fn().mockReturnValue(RconProtocolType.SOURCE),
      }
      vi.spyOn(RconService.prototype as any, "createProtocol").mockReturnValue(failProtocol)

      await expect(singleRetryService.connect(1)).rejects.toThrow(RconError)
    })
  })

  describe("disconnect", () => {
    it("should handle disconnect gracefully when not connected", async () => {
      await rconService.disconnect(1)
      expect(mockLogger.debug).toHaveBeenCalledWith("No connection found for server 1")
    })
  })

  describe("executeCommand", () => {
    it("should throw error when not connected", async () => {
      await expect(rconService.executeCommand(1, "status")).rejects.toThrow(
        "No connection found for server 1",
      )
    })
  })

  describe("isConnected", () => {
    it("should return false for non-existent connection", () => {
      expect(rconService.isConnected(1)).toBe(false)
    })
  })

  describe("disconnectAll", () => {
    it("should complete successfully with no connections", async () => {
      await rconService.disconnectAll()
      expect(mockLogger.debug).toHaveBeenCalledWith("No RCON connections to close")
    })
  })

  describe("getConnectionStats", () => {
    it("should return empty array when no connections", () => {
      const stats = rconService.getConnectionStats()
      expect(stats).toEqual([])
    })
  })

  describe("getEngineDisplayNameForServer", () => {
    it("should return GoldSource for GOLDSRC engine", async () => {
      vi.mocked(mockRepository.getRconCredentials).mockResolvedValue({
        ...testCredentials,
        gameEngine: GameEngine.GOLDSRC,
      })

      const name = await rconService.getEngineDisplayNameForServer(1)
      expect(name).toBe("GoldSource")
    })

    it("should return Source for SOURCE engine", async () => {
      vi.mocked(mockRepository.getRconCredentials).mockResolvedValue({
        ...testCredentials,
        gameEngine: GameEngine.SOURCE,
      })

      const name = await rconService.getEngineDisplayNameForServer(1)
      expect(name).toBe("Source")
    })

    it("should return Source 2009 for SOURCE_2009 engine", async () => {
      vi.mocked(mockRepository.getRconCredentials).mockResolvedValue({
        ...testCredentials,
        gameEngine: GameEngine.SOURCE_2009,
      })

      const name = await rconService.getEngineDisplayNameForServer(1)
      expect(name).toBe("Source 2009")
    })

    it("should return Unknown when no credentials found", async () => {
      vi.mocked(mockRepository.getRconCredentials).mockResolvedValue(null)

      const name = await rconService.getEngineDisplayNameForServer(1)
      expect(name).toBe("Unknown")
    })

    it("should return Unknown when repository throws error", async () => {
      vi.mocked(mockRepository.getRconCredentials).mockRejectedValue(new Error("DB error"))

      const name = await rconService.getEngineDisplayNameForServer(1)
      expect(name).toBe("Unknown")
    })

    it("should return Unknown for unknown engine value", async () => {
      vi.mocked(mockRepository.getRconCredentials).mockResolvedValue({
        ...testCredentials,
        gameEngine: 999 as GameEngine,
      })

      const name = await rconService.getEngineDisplayNameForServer(1)
      expect(name).toBe("Unknown")
    })
  })

  describe("getActiveConnection", () => {
    it("should throw NOT_CONNECTED when connection is not in map", async () => {
      await expect(rconService.executeCommand(99, "test")).rejects.toThrow(
        "No connection found for server 99",
      )
    })
  })
})
