/**
 * Map Service Tests
 *
 * Tests for the centralized map tracking service.
 */

import type { IMatchRepository } from "@/modules/match/match.types"
import type { IRconService } from "@/modules/rcon/types/rcon.types"
import type { ILogger } from "@/shared/utils/logger.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MapService } from "./map.service"

function createMockRconService(): IRconService {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    executeCommand: vi.fn(),
    getStatus: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    disconnectAll: vi.fn(),
    getEngineDisplayNameForServer: vi.fn(),
    getConnectionStats: vi.fn().mockReturnValue([]),
  }
}

function createMockMatchRepository(): IMatchRepository {
  return {
    getLastKnownMap: vi.fn(),
    getPlayerSkill: vi.fn(),
    updateServerStats: vi.fn(),
    findServerById: vi.fn(),
    createPlayerHistory: vi.fn(),
    updateMapCount: vi.fn(),
    incrementServerRounds: vi.fn(),
    updateTeamWins: vi.fn(),
    updateBombStats: vi.fn(),
    resetMapStats: vi.fn(),
  }
}

describe("MapService", () => {
  let service: MapService
  let mockLogger: ILogger
  let mockRconService: IRconService
  let mockMatchRepository: IMatchRepository

  beforeEach(() => {
    vi.useFakeTimers()
    mockLogger = createMockLogger()
    mockRconService = createMockRconService()
    mockMatchRepository = createMockMatchRepository()
    service = new MapService(mockRconService, mockMatchRepository, mockLogger)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("getCurrentMap", () => {
    it("should return map from RCON when cache is empty", async () => {
      vi.mocked(mockRconService.getStatus).mockResolvedValue({
        map: "de_dust2",
        players: 10,
        maxPlayers: 32,
        hostname: "Test Server",
        uptime: 3600,
        fps: 128,
        timestamp: new Date(),
      })

      const result = await service.getCurrentMap(1)

      expect(result).toBe("de_dust2")
      expect(mockRconService.getStatus).toHaveBeenCalledWith(1)
    })

    it("should return cached map when cache is valid", async () => {
      vi.mocked(mockRconService.getStatus).mockResolvedValue({
        map: "de_dust2",
        players: 10,
        maxPlayers: 32,
        hostname: "Test Server",
        uptime: 3600,
        fps: 128,
        timestamp: new Date(),
      })

      // First call - populates cache
      await service.getCurrentMap(1)

      // Second call within 30 seconds - should use cache
      vi.advanceTimersByTime(15000)
      const result = await service.getCurrentMap(1)

      expect(result).toBe("de_dust2")
      expect(mockRconService.getStatus).toHaveBeenCalledTimes(1)
    })

    it("should refresh cache after TTL expires", async () => {
      vi.mocked(mockRconService.getStatus)
        .mockResolvedValueOnce({
          map: "de_dust2",
          players: 10,
          maxPlayers: 32,
          hostname: "Test Server",
          uptime: 3600,
          fps: 128,
          timestamp: new Date(),
        })
        .mockResolvedValueOnce({
          map: "de_inferno",
          players: 12,
          maxPlayers: 32,
          hostname: "Test Server",
          uptime: 3600,
          fps: 128,
          timestamp: new Date(),
        })

      // First call
      await service.getCurrentMap(1)

      // Advance past 30 second TTL
      vi.advanceTimersByTime(31000)

      const result = await service.getCurrentMap(1)

      expect(result).toBe("de_inferno")
      expect(mockRconService.getStatus).toHaveBeenCalledTimes(2)
    })

    it("should fall back to database when RCON fails", async () => {
      vi.mocked(mockRconService.getStatus).mockRejectedValue(new Error("RCON error"))
      vi.mocked(mockMatchRepository.getLastKnownMap).mockResolvedValue("cs_office")

      const result = await service.getCurrentMap(1)

      expect(result).toBe("cs_office")
      expect(mockMatchRepository.getLastKnownMap).toHaveBeenCalledWith(1)
    })

    it("should return 'unknown' when RCON fails and no database fallback", async () => {
      vi.mocked(mockRconService.getStatus).mockRejectedValue(new Error("RCON error"))
      vi.mocked(mockMatchRepository.getLastKnownMap).mockResolvedValue(null)

      const result = await service.getCurrentMap(1)

      expect(result).toBe("unknown")
    })

    it("should return 'unknown' when RCON returns no map", async () => {
      vi.mocked(mockRconService.getStatus).mockResolvedValue({
        map: "",
        players: 0,
        maxPlayers: 32,
        hostname: "Test Server",
        uptime: 3600,
        fps: 128,
        timestamp: new Date(),
      })

      const result = await service.getCurrentMap(1)

      expect(result).toBe("unknown")
    })

    it("should cache per-server", async () => {
      vi.mocked(mockRconService.getStatus)
        .mockResolvedValueOnce({
          map: "de_dust2",
          players: 10,
          maxPlayers: 32,
          hostname: "Server 1",
          uptime: 3600,
          fps: 128,
          timestamp: new Date(),
        })
        .mockResolvedValueOnce({
          map: "de_inferno",
          players: 12,
          maxPlayers: 32,
          hostname: "Server 2",
          uptime: 3600,
          fps: 128,
          timestamp: new Date(),
        })

      const result1 = await service.getCurrentMap(1)
      const result2 = await service.getCurrentMap(2)

      expect(result1).toBe("de_dust2")
      expect(result2).toBe("de_inferno")
      expect(mockRconService.getStatus).toHaveBeenCalledTimes(2)
    })
  })

  describe("getLastKnownMap", () => {
    it("should return last known map from repository", async () => {
      vi.mocked(mockMatchRepository.getLastKnownMap).mockResolvedValue("de_mirage")

      const result = await service.getLastKnownMap(1)

      expect(result).toBe("de_mirage")
      expect(mockMatchRepository.getLastKnownMap).toHaveBeenCalledWith(1)
    })

    it("should return null when no map in database", async () => {
      vi.mocked(mockMatchRepository.getLastKnownMap).mockResolvedValue(null)

      const result = await service.getLastKnownMap(1)

      expect(result).toBeNull()
    })
  })

  describe("handleMapChange", () => {
    it("should clear cache on map change", async () => {
      vi.mocked(mockRconService.getStatus).mockResolvedValue({
        map: "de_dust2",
        players: 10,
        maxPlayers: 32,
        hostname: "Test Server",
        uptime: 3600,
        fps: 128,
        timestamp: new Date(),
      })

      // Populate cache
      await service.getCurrentMap(1)

      // Handle map change
      await service.handleMapChange(1, "de_inferno", "de_dust2")

      // Next call should hit RCON again
      vi.mocked(mockRconService.getStatus).mockResolvedValue({
        map: "de_inferno",
        players: 10,
        maxPlayers: 32,
        hostname: "Test Server",
        uptime: 3600,
        fps: 128,
        timestamp: new Date(),
      })

      const result = await service.getCurrentMap(1)

      expect(result).toBe("de_inferno")
      expect(mockRconService.getStatus).toHaveBeenCalledTimes(2)
    })

    it("should log map added when previousMap is undefined", async () => {
      await service.handleMapChange(1, "de_dust2", undefined)

      expect(mockLogger.info).toHaveBeenCalledWith("Map added for server 1: de_dust2")
    })

    it("should log map changed when maps differ", async () => {
      await service.handleMapChange(1, "de_inferno", "de_dust2")

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Map changed for server 1: de_dust2 → de_inferno",
      )
    })

    it("should not log when maps are the same", async () => {
      await service.handleMapChange(1, "de_dust2", "de_dust2")

      expect(mockLogger.info).not.toHaveBeenCalled()
    })
  })
})
