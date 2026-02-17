/**
 * RCON Repository Unit Tests
 *
 * Tests for database access layer for RCON operations.
 */

import { createMockDatabaseClient } from "@/tests/mocks/database"
import { createMockLogger } from "@/tests/mocks/logger"
import type { ICryptoService } from "@repo/crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GameEngine } from "../types/rcon.types"
import { RconRepository } from "./rcon.repository"

function createMockCrypto(): ICryptoService {
  return {
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn().mockResolvedValue("decrypted_password"),
  }
}

describe("RconRepository", () => {
  let repository: RconRepository
  let mockDb: ReturnType<typeof createMockDatabaseClient>
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockCrypto: ReturnType<typeof createMockCrypto>

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = createMockDatabaseClient()
    mockLogger = createMockLogger()
    mockCrypto = createMockCrypto()
    repository = new RconRepository(mockDb, mockLogger, mockCrypto)
  })

  describe("getRconCredentials", () => {
    it("should return credentials for an external server", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "192.168.1.100",
        port: 27015,
        rconPassword: "encrypted_pass",
        game: "csgo",
        connectionType: "external",
        dockerHost: null,
        name: "Test Server",
      } as never)

      const result = await repository.getRconCredentials(1)

      expect(result).toEqual({
        serverId: 1,
        address: "192.168.1.100",
        port: 27015,
        rconPassword: "decrypted_password",
        gameEngine: GameEngine.SOURCE,
      })

      expect(mockDb.mockPrisma.server.findUnique).toHaveBeenCalledWith({
        where: { serverId: 1 },
        select: {
          serverId: true,
          address: true,
          port: true,
          rconPassword: true,
          game: true,
          connectionType: true,
          dockerHost: true,
          name: true,
        },
      })

      expect(mockCrypto.decrypt).toHaveBeenCalledWith("encrypted_pass")
    })

    it("should return credentials for a Docker server", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 2,
        address: "192.168.1.100",
        port: 27015,
        rconPassword: "encrypted_pass",
        game: "cstrike",
        connectionType: "docker",
        dockerHost: "10.0.0.5",
        name: "Docker Server",
      } as never)

      const result = await repository.getRconCredentials(2)

      expect(result).toEqual({
        serverId: 2,
        address: "10.0.0.5",
        port: 27015, // Standard game port for Docker
        rconPassword: "decrypted_password",
        gameEngine: GameEngine.GOLDSRC,
      })

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Using Docker connection"),
      )
    })

    it("should return null when server is not found", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(null as never)

      const result = await repository.getRconCredentials(999)

      expect(result).toBeNull()
      expect(mockLogger.debug).toHaveBeenCalledWith("Server 999 not found")
    })

    it("should return null when server has no RCON password", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 3,
        address: "192.168.1.100",
        port: 27015,
        rconPassword: null,
        game: "csgo",
        connectionType: "external",
        dockerHost: null,
        name: "No Password Server",
      } as never)

      const result = await repository.getRconCredentials(3)

      expect(result).toBeNull()
      expect(mockLogger.debug).toHaveBeenCalledWith("Server 3 has no RCON password configured")
    })

    it("should return null when password decryption fails", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 4,
        address: "192.168.1.100",
        port: 27015,
        rconPassword: "bad_encrypted_pass",
        game: "csgo",
        connectionType: "external",
        dockerHost: null,
        name: "Bad Password Server",
      } as never)

      vi.mocked(mockCrypto.decrypt).mockRejectedValue(new Error("Decryption failed"))

      const result = await repository.getRconCredentials(4)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to decrypt RCON password for server 4"),
      )
    })

    it("should return null when database query fails", async () => {
      mockDb.mockPrisma.server.findUnique.mockRejectedValue(new Error("DB connection failed"))

      const result = await repository.getRconCredentials(5)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to get RCON credentials for server 5"),
      )
    })

    it("should use external connection when connectionType is not docker", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 6,
        address: "10.20.30.40",
        port: 27016,
        rconPassword: "enc",
        game: "tf2",
        connectionType: "external",
        dockerHost: null,
        name: "External Server",
      } as never)

      const result = await repository.getRconCredentials(6)

      expect(result!.address).toBe("10.20.30.40")
      expect(result!.port).toBe(27016)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Using external connection"),
      )
    })

    it("should use external connection when docker but no dockerHost", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 7,
        address: "10.20.30.40",
        port: 27016,
        rconPassword: "enc",
        game: "csgo",
        connectionType: "docker",
        dockerHost: null,
        name: "Docker No Host",
      } as never)

      const result = await repository.getRconCredentials(7)

      // When docker but no dockerHost, falls through to external
      expect(result!.address).toBe("10.20.30.40")
      expect(result!.port).toBe(27016)
    })

    it("should use empty string dockerHost as falsy -> external", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 8,
        address: "10.20.30.40",
        port: 27016,
        rconPassword: "enc",
        game: "csgo",
        connectionType: "docker",
        dockerHost: "",
        name: "Docker Empty Host",
      } as never)

      const result = await repository.getRconCredentials(8)

      // Empty string is falsy, so falls through to external
      expect(result!.address).toBe("10.20.30.40")
      expect(result!.port).toBe(27016)
    })
  })

  describe("updateServerStatus", () => {
    it("should insert server load record", async () => {
      mockDb.mockPrisma.serverLoad.create.mockResolvedValue({} as never)

      const status = {
        map: "de_dust2",
        players: 20,
        maxPlayers: 32,
        uptime: 3600,
        fps: 128.5,
        timestamp: new Date("2026-01-15T12:00:00Z"),
        realPlayerCount: 18,
        botCount: 2,
      }

      await repository.updateServerStatus(1, status)

      expect(mockDb.mockPrisma.serverLoad.create).toHaveBeenCalledWith({
        data: {
          serverId: 1,
          timestamp: Math.floor(status.timestamp.getTime() / 1000),
          activePlayers: 18, // realPlayerCount
          minPlayers: 18,
          maxPlayers: 32,
          map: "de_dust2",
          uptime: "3600",
          fps: "128.5",
        },
      })

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Recorded server load history"),
        expect.objectContaining({
          map: "de_dust2",
          realPlayers: 18,
          totalPlayers: 20,
          maxPlayers: 32,
        }),
      )
    })

    it("should use players count when realPlayerCount is undefined", async () => {
      mockDb.mockPrisma.serverLoad.create.mockResolvedValue({} as never)

      const status = {
        map: "de_nuke",
        players: 15,
        maxPlayers: 24,
        uptime: 1800,
        fps: 64.0,
        timestamp: new Date("2026-01-15T12:00:00Z"),
        // No realPlayerCount
      }

      await repository.updateServerStatus(2, status)

      expect(mockDb.mockPrisma.serverLoad.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          activePlayers: 15, // Falls back to players
          minPlayers: 15,
        }),
      })
    })

    it("should handle database insert failure gracefully", async () => {
      mockDb.mockPrisma.serverLoad.create.mockRejectedValue(new Error("Duplicate key constraint"))

      const status = {
        map: "de_dust2",
        players: 20,
        maxPlayers: 32,
        uptime: 3600,
        fps: 128.5,
        timestamp: new Date("2026-01-15T12:00:00Z"),
      }

      // Should not throw
      await expect(repository.updateServerStatus(1, status)).resolves.not.toThrow()

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Could not insert server status history"),
      )
    })
  })

  describe("mapGameToEngine", () => {
    // Test through getRconCredentials which calls mapGameToEngine internally

    it("should map cstrike to GOLDSRC", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "cstrike",
        connectionType: "external",
        dockerHost: null,
        name: "CS",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.GOLDSRC)
    })

    it("should map cs_ prefix to GOLDSRC", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "cs_16",
        connectionType: "external",
        dockerHost: null,
        name: "CS",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.GOLDSRC)
    })

    it("should map css to SOURCE", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "css",
        connectionType: "external",
        dockerHost: null,
        name: "CSS",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })

    it("should map csgo to SOURCE", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "csgo",
        connectionType: "external",
        dockerHost: null,
        name: "CSGO",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })

    it("should map cs2 to SOURCE", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "cs2",
        connectionType: "external",
        dockerHost: null,
        name: "CS2",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })

    it("should map tf to SOURCE", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "tf",
        connectionType: "external",
        dockerHost: null,
        name: "TF",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })

    it("should map tf2 to SOURCE", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "tf2",
        connectionType: "external",
        dockerHost: null,
        name: "TF2",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })

    it("should map hl2 to SOURCE", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "hl2mp",
        connectionType: "external",
        dockerHost: null,
        name: "HL2",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })

    it("should map source to SOURCE", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "source_engine",
        connectionType: "external",
        dockerHost: null,
        name: "Source Game",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })

    it("should map l4d to SOURCE_2009", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "l4d2",
        connectionType: "external",
        dockerHost: null,
        name: "L4D2",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE_2009)
    })

    it("should map portal to SOURCE_2009", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "portal2",
        connectionType: "external",
        dockerHost: null,
        name: "Portal",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE_2009)
    })

    it("should map ep2 to SOURCE_2009", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "ep2",
        connectionType: "external",
        dockerHost: null,
        name: "EP2",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE_2009)
    })

    it("should map dod:s to SOURCE_2009", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "dod:s",
        connectionType: "external",
        dockerHost: null,
        name: "DoD:S",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE_2009)
    })

    it("should default to SOURCE for unknown games and log a warning", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "unknown_game",
        connectionType: "external",
        dockerHost: null,
        name: "Unknown",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unknown game type "unknown_game", defaulting to Source engine',
      )
    })

    it("should be case insensitive when mapping games", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "CSTRIKE",
        connectionType: "external",
        dockerHost: null,
        name: "CS",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.GOLDSRC)
    })

    it("should handle mixed case game names", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "1.2.3.4",
        port: 27015,
        rconPassword: "enc",
        game: "CsGo",
        connectionType: "external",
        dockerHost: null,
        name: "CSGO",
      } as never)

      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })
  })
})
