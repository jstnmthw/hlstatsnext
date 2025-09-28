/**
 * Server Status Enricher Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { ServerStatusEnricher } from "./server-status-enricher"
import { createMockLogger } from "@/tests/mocks/logger"
import type { IRconService, ServerStatus } from "@/modules/rcon/types/rcon.types"
import type { IServerRepository, IServerService } from "@/modules/server/server.types"

// Mock implementations
const mockRconService: IRconService = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  executeCommand: vi.fn(),
  getStatus: vi.fn(),
  isConnected: vi.fn(),
  disconnectAll: vi.fn(),
  getConnectionStats: vi.fn(),
  getEngineDisplayNameForServer: vi.fn(),
}

const mockServerRepository: IServerRepository = {
  findById: vi.fn(),
  findByAddress: vi.fn(),
  getServerConfig: vi.fn(),
  hasRconCredentials: vi.fn(),
  findActiveServersWithRcon: vi.fn(),
  findServersByIds: vi.fn(),
  findAllServersWithRcon: vi.fn(),
  updateServerStatusFromRcon: vi.fn(),
  resetMapStats: vi.fn(),
  getModDefault: vi.fn(),
  getServerConfigDefault: vi.fn(),
}

const mockServerService: IServerService = {
  findById: vi.fn(),
  getServer: vi.fn(),
  getServerByAddress: vi.fn(),
  getServerGame: vi.fn(),
  getServerConfigBoolean: vi.fn(),
  getServerConfig: vi.fn(),
  getServerModType: vi.fn(),
  hasRconCredentials: vi.fn(),
  findActiveServersWithRcon: vi.fn(),
  findServersByIds: vi.fn(),
  findAllServersWithRcon: vi.fn(),
  handleServerShutdown: vi.fn(),
  handleStatsUpdate: vi.fn(),
  handleAdminAction: vi.fn(),
}

const mockLogger = createMockLogger()

describe("ServerStatusEnricher", () => {
  let enricher: ServerStatusEnricher
  let serverId: number

  beforeEach(() => {
    vi.clearAllMocks()
    enricher = new ServerStatusEnricher(
      mockRconService,
      mockServerRepository,
      mockServerService,
      mockLogger,
    )
    serverId = 1
  })

  describe("enrichServerStatus", () => {
    it("should enrich server status with real player count", async () => {
      // Arrange
      const mockStatus: ServerStatus = {
        map: "cs_backalley",
        players: 5,
        maxPlayers: 32,
        uptime: 15871,
        fps: 100,
        hostname: "[DEV] CS1.6 Test Server",
        timestamp: new Date(),
        realPlayerCount: 1, // 1 real player, 4 bots
        botCount: 4,
      }

      vi.mocked(mockRconService.isConnected).mockReturnValue(true)
      vi.mocked(mockRconService.getStatus).mockResolvedValue(mockStatus)
      vi.mocked(mockServerService.getServerConfigBoolean).mockResolvedValue(false) // IgnoreBots = false
      vi.mocked(mockServerRepository.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        activeMap: "de_dust2", // Different map to trigger change
      })

      // Act
      await enricher.enrichServerStatus(serverId)

      // Assert
      expect(mockRconService.getStatus).toHaveBeenCalledWith(serverId)
      expect(mockServerService.getServerConfigBoolean).toHaveBeenCalledWith(
        serverId,
        "IgnoreBots",
        false,
      )
      expect(mockServerRepository.resetMapStats).toHaveBeenCalledWith(
        serverId,
        "cs_backalley",
        5, // Total players since IgnoreBots = false
      )
    })

    it("should update server status when map hasn't changed", async () => {
      // Arrange
      const mockStatus: ServerStatus = {
        map: "de_dust2",
        players: 3,
        maxPlayers: 32,
        uptime: 15871,
        fps: 100,
        hostname: "[DEV] CS1.6 Test Server",
        timestamp: new Date(),
        realPlayerCount: 3,
        botCount: 0,
      }

      vi.mocked(mockRconService.isConnected).mockReturnValue(true)
      vi.mocked(mockRconService.getStatus).mockResolvedValue(mockStatus)
      vi.mocked(mockServerService.getServerConfigBoolean).mockResolvedValue(false) // IgnoreBots = false
      vi.mocked(mockServerRepository.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        activeMap: "de_dust2", // Same map
      })

      // Act
      await enricher.enrichServerStatus(serverId)

      // Assert
      expect(mockServerService.getServerConfigBoolean).toHaveBeenCalledWith(
        serverId,
        "IgnoreBots",
        false,
      )
      expect(mockServerRepository.updateServerStatusFromRcon).toHaveBeenCalledWith(serverId, {
        activePlayers: 3, // Total players since IgnoreBots = false
        maxPlayers: 32,
        activeMap: "de_dust2",
        hostname: "[DEV] CS1.6 Test Server",
      })
      expect(mockServerRepository.resetMapStats).not.toHaveBeenCalled()
    })

    it("should connect to RCON if not already connected", async () => {
      // Arrange
      const mockStatus: ServerStatus = {
        map: "de_dust2",
        players: 2,
        maxPlayers: 32,
        uptime: 15871,
        fps: 100,
        timestamp: new Date(),
        realPlayerCount: 2,
      }

      vi.mocked(mockRconService.isConnected).mockReturnValue(false)
      vi.mocked(mockRconService.getStatus).mockResolvedValue(mockStatus)
      vi.mocked(mockServerService.getServerConfigBoolean).mockResolvedValue(false) // IgnoreBots = false
      vi.mocked(mockServerRepository.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        activeMap: "de_dust2",
      })

      // Act
      await enricher.enrichServerStatus(serverId)

      // Assert
      expect(mockRconService.connect).toHaveBeenCalledWith(serverId)
      expect(mockRconService.getStatus).toHaveBeenCalledWith(serverId)
      expect(mockServerService.getServerConfigBoolean).toHaveBeenCalledWith(
        serverId,
        "IgnoreBots",
        false,
      )
    })

    it("should handle RCON failures gracefully", async () => {
      // Arrange
      vi.mocked(mockRconService.isConnected).mockReturnValue(true)
      vi.mocked(mockRconService.getStatus).mockRejectedValue(new Error("RCON timeout"))

      // Act
      await enricher.enrichServerStatus(serverId)

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to enrich server 1 status"),
      )
      expect(mockServerRepository.updateServerStatusFromRcon).not.toHaveBeenCalled()
    })

    it("should use total player count if realPlayerCount is not available", async () => {
      // Arrange
      const mockStatus: ServerStatus = {
        map: "de_dust2",
        players: 5,
        maxPlayers: 32,
        uptime: 15871,
        fps: 100,
        timestamp: new Date(),
        // No realPlayerCount or botCount
      }

      vi.mocked(mockRconService.isConnected).mockReturnValue(true)
      vi.mocked(mockRconService.getStatus).mockResolvedValue(mockStatus)
      vi.mocked(mockServerService.getServerConfigBoolean).mockResolvedValue(false) // IgnoreBots = false
      vi.mocked(mockServerRepository.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        activeMap: "de_dust2",
      })

      // Act
      await enricher.enrichServerStatus(serverId)

      // Assert
      expect(mockServerService.getServerConfigBoolean).toHaveBeenCalledWith(
        serverId,
        "IgnoreBots",
        false,
      )
      expect(mockServerRepository.updateServerStatusFromRcon).toHaveBeenCalledWith(
        serverId,
        expect.objectContaining({
          activePlayers: 5, // Falls back to total players
        }),
      )
    })

    it("should handle server with no previous active map", async () => {
      // Arrange
      const mockStatus: ServerStatus = {
        map: "de_dust2",
        players: 2,
        maxPlayers: 32,
        uptime: 15871,
        fps: 100,
        timestamp: new Date(),
        realPlayerCount: 2,
      }

      vi.mocked(mockRconService.isConnected).mockReturnValue(true)
      vi.mocked(mockRconService.getStatus).mockResolvedValue(mockStatus)
      vi.mocked(mockServerService.getServerConfigBoolean).mockResolvedValue(false) // IgnoreBots = false
      vi.mocked(mockServerRepository.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        // No activeMap set
      })

      // Act
      await enricher.enrichServerStatus(serverId)

      // Assert
      expect(mockServerService.getServerConfigBoolean).toHaveBeenCalledWith(
        serverId,
        "IgnoreBots",
        false,
      )
      expect(mockServerRepository.updateServerStatusFromRcon).toHaveBeenCalledWith(
        serverId,
        expect.objectContaining({
          activePlayers: 2,
          maxPlayers: 32,
          activeMap: "de_dust2",
        }),
      )
    })

    describe("IgnoreBots configuration", () => {
      it("should include bots when IgnoreBots=false (default)", async () => {
        // Arrange
        const mockStatus: ServerStatus = {
          map: "de_dust2",
          players: 5,
          maxPlayers: 32,
          uptime: 15871,
          fps: 100,
          hostname: "[DEV] CS1.6 Test Server",
          timestamp: new Date(),
          realPlayerCount: 2, // 2 real players, 3 bots
          botCount: 3,
        }

        vi.mocked(mockRconService.isConnected).mockReturnValue(true)
        vi.mocked(mockRconService.getStatus).mockResolvedValue(mockStatus)
        vi.mocked(mockServerService.getServerConfigBoolean).mockResolvedValue(false) // IgnoreBots = false
        vi.mocked(mockServerRepository.findById).mockResolvedValue({
          serverId: 1,
          game: "cstrike",
          name: "Test Server",
          address: "127.0.0.1",
          port: 27015,
          activeMap: "de_dust2",
        })

        // Act
        await enricher.enrichServerStatus(serverId)

        // Assert
        expect(mockServerService.getServerConfigBoolean).toHaveBeenCalledWith(
          serverId,
          "IgnoreBots",
          false,
        )
        expect(mockServerRepository.updateServerStatusFromRcon).toHaveBeenCalledWith(serverId, {
          activePlayers: 5, // Total players (real + bots)
          maxPlayers: 32,
          activeMap: "de_dust2",
          hostname: "[DEV] CS1.6 Test Server",
        })
      })

      it("should exclude bots when IgnoreBots=true", async () => {
        // Arrange
        const mockStatus: ServerStatus = {
          map: "de_dust2",
          players: 5,
          maxPlayers: 32,
          uptime: 15871,
          fps: 100,
          hostname: "[DEV] CS1.6 Test Server",
          timestamp: new Date(),
          realPlayerCount: 2, // 2 real players, 3 bots
          botCount: 3,
        }

        vi.mocked(mockRconService.isConnected).mockReturnValue(true)
        vi.mocked(mockRconService.getStatus).mockResolvedValue(mockStatus)
        vi.mocked(mockServerService.getServerConfigBoolean).mockResolvedValue(true) // IgnoreBots = true
        vi.mocked(mockServerRepository.findById).mockResolvedValue({
          serverId: 1,
          game: "cstrike",
          name: "Test Server",
          address: "127.0.0.1",
          port: 27015,
          activeMap: "de_dust2",
        })

        // Act
        await enricher.enrichServerStatus(serverId)

        // Assert
        expect(mockServerService.getServerConfigBoolean).toHaveBeenCalledWith(
          serverId,
          "IgnoreBots",
          false,
        )
        expect(mockServerRepository.updateServerStatusFromRcon).toHaveBeenCalledWith(serverId, {
          activePlayers: 2, // Only real players
          maxPlayers: 32,
          activeMap: "de_dust2",
          hostname: "[DEV] CS1.6 Test Server",
        })
      })

      it("should handle map change with IgnoreBots=true", async () => {
        // Arrange
        const mockStatus: ServerStatus = {
          map: "cs_office",
          players: 8,
          maxPlayers: 32,
          uptime: 15871,
          fps: 100,
          hostname: "[DEV] CS1.6 Test Server",
          timestamp: new Date(),
          realPlayerCount: 3, // 3 real players, 5 bots
          botCount: 5,
        }

        vi.mocked(mockRconService.isConnected).mockReturnValue(true)
        vi.mocked(mockRconService.getStatus).mockResolvedValue(mockStatus)
        vi.mocked(mockServerService.getServerConfigBoolean).mockResolvedValue(true) // IgnoreBots = true
        vi.mocked(mockServerRepository.findById).mockResolvedValue({
          serverId: 1,
          game: "cstrike",
          name: "Test Server",
          address: "127.0.0.1",
          port: 27015,
          activeMap: "de_dust2", // Different map to trigger change
        })

        // Act
        await enricher.enrichServerStatus(serverId)

        // Assert
        expect(mockServerService.getServerConfigBoolean).toHaveBeenCalledWith(
          serverId,
          "IgnoreBots",
          false,
        )
        expect(mockServerRepository.resetMapStats).toHaveBeenCalledWith(
          serverId,
          "cs_office",
          3, // Only real players since IgnoreBots = true
        )
      })

      it("should fallback to total players when realPlayerCount unavailable and IgnoreBots=true", async () => {
        // Arrange
        const mockStatus: ServerStatus = {
          map: "de_dust2",
          players: 6,
          maxPlayers: 32,
          uptime: 15871,
          fps: 100,
          hostname: "[DEV] CS1.6 Test Server",
          timestamp: new Date(),
          // No realPlayerCount or botCount (older server/parser)
        }

        vi.mocked(mockRconService.isConnected).mockReturnValue(true)
        vi.mocked(mockRconService.getStatus).mockResolvedValue(mockStatus)
        vi.mocked(mockServerService.getServerConfigBoolean).mockResolvedValue(true) // IgnoreBots = true
        vi.mocked(mockServerRepository.findById).mockResolvedValue({
          serverId: 1,
          game: "cstrike",
          name: "Test Server",
          address: "127.0.0.1",
          port: 27015,
          activeMap: "de_dust2",
        })

        // Act
        await enricher.enrichServerStatus(serverId)

        // Assert
        expect(mockServerService.getServerConfigBoolean).toHaveBeenCalledWith(
          serverId,
          "IgnoreBots",
          false,
        )
        expect(mockServerRepository.updateServerStatusFromRcon).toHaveBeenCalledWith(serverId, {
          activePlayers: 6, // Falls back to total players when realPlayerCount unavailable
          maxPlayers: 32,
          activeMap: "de_dust2",
          hostname: "[DEV] CS1.6 Test Server",
        })
      })

      it("should handle server with only bots when IgnoreBots=true", async () => {
        // Arrange
        const mockStatus: ServerStatus = {
          map: "de_dust2",
          players: 4,
          maxPlayers: 32,
          uptime: 15871,
          fps: 100,
          hostname: "[DEV] CS1.6 Test Server",
          timestamp: new Date(),
          realPlayerCount: 0, // 0 real players, 4 bots
          botCount: 4,
        }

        vi.mocked(mockRconService.isConnected).mockReturnValue(true)
        vi.mocked(mockRconService.getStatus).mockResolvedValue(mockStatus)
        vi.mocked(mockServerService.getServerConfigBoolean).mockResolvedValue(true) // IgnoreBots = true
        vi.mocked(mockServerRepository.findById).mockResolvedValue({
          serverId: 1,
          game: "cstrike",
          name: "Test Server",
          address: "127.0.0.1",
          port: 27015,
          activeMap: "de_dust2",
        })

        // Act
        await enricher.enrichServerStatus(serverId)

        // Assert
        expect(mockServerService.getServerConfigBoolean).toHaveBeenCalledWith(
          serverId,
          "IgnoreBots",
          false,
        )
        expect(mockServerRepository.updateServerStatusFromRcon).toHaveBeenCalledWith(serverId, {
          activePlayers: 0, // Only real players (0)
          maxPlayers: 32,
          activeMap: "de_dust2",
          hostname: "[DEV] CS1.6 Test Server",
        })
      })
    })
  })
})
