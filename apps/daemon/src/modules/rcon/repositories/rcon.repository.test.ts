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
    it("should return credentials for a server", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 1,
        address: "192.168.1.100",
        port: 27015,
        rconPassword: "encrypted_pass",
        game: "csgo",
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
        },
      })

      expect(mockCrypto.decrypt).toHaveBeenCalledWith("encrypted_pass")
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

    it("should use server address and port directly (token auth)", async () => {
      // With token-based auth, server.address and server.port are set correctly
      // during beacon auto-registration
      mockDb.mockPrisma.server.findUnique.mockResolvedValue({
        serverId: 6,
        address: "10.20.30.40",
        port: 27016,
        rconPassword: "enc",
        game: "tf2",
      } as never)

      const result = await repository.getRconCredentials(6)

      expect(result!.address).toBe("10.20.30.40")
      expect(result!.port).toBe(27016)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "RCON connection for server 6: 10.20.30.40:27016",
      )
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

    const createServerMock = (game: string) => ({
      serverId: 1,
      address: "1.2.3.4",
      port: 27015,
      rconPassword: "enc",
      game,
    })

    it("should map cstrike to GOLDSRC", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(createServerMock("cstrike") as never)
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.GOLDSRC)
    })

    it("should map cs_ prefix to GOLDSRC", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(createServerMock("cs_16") as never)
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.GOLDSRC)
    })

    it("should map css to SOURCE", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(createServerMock("css") as never)
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })

    it("should map csgo to SOURCE", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(createServerMock("csgo") as never)
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })

    it("should map cs2 to SOURCE", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(createServerMock("cs2") as never)
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })

    it("should map tf to SOURCE", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(createServerMock("tf") as never)
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })

    it("should map tf2 to SOURCE", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(createServerMock("tf2") as never)
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })

    it("should map hl2 to SOURCE", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(createServerMock("hl2mp") as never)
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })

    it("should map source to SOURCE", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(
        createServerMock("source_engine") as never,
      )
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })

    it("should map l4d to SOURCE_2009", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(createServerMock("l4d2") as never)
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE_2009)
    })

    it("should map portal to SOURCE_2009", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(createServerMock("portal2") as never)
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE_2009)
    })

    it("should map ep2 to SOURCE_2009", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(createServerMock("ep2") as never)
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE_2009)
    })

    it("should map dod:s to SOURCE_2009", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(createServerMock("dod:s") as never)
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE_2009)
    })

    it("should default to SOURCE for unknown games and log a warning", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(
        createServerMock("unknown_game") as never,
      )
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unknown game type "unknown_game", defaulting to Source engine',
      )
    })

    it("should be case insensitive when mapping games", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(createServerMock("CSTRIKE") as never)
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.GOLDSRC)
    })

    it("should handle mixed case game names", async () => {
      mockDb.mockPrisma.server.findUnique.mockResolvedValue(createServerMock("CsGo") as never)
      const result = await repository.getRconCredentials(1)
      expect(result!.gameEngine).toBe(GameEngine.SOURCE)
    })
  })
})
