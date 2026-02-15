/**
 * Simple Player Resolver Service Tests
 *
 * Tests for lightweight player resolution.
 */

import type { IPlayerRepository } from "@/modules/player/types/player.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockPlayerRepository } from "@/tests/mocks/player.repository.mock"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SimplePlayerResolverService } from "./simple-player-resolver.service"

describe("SimplePlayerResolverService", () => {
  let service: SimplePlayerResolverService
  let mockRepository: IPlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockRepository = createMockPlayerRepository()
    service = new SimplePlayerResolverService(mockRepository, mockLogger)
  })

  describe("getOrCreatePlayer", () => {
    it("should return existing player ID if found", async () => {
      vi.mocked(mockRepository.findByUniqueId).mockResolvedValue({
        playerId: 100,
        lastName: "ExistingPlayer",
        game: "cstrike",
        skill: 1000,
      } as any)

      const result = await service.getOrCreatePlayer(
        "STEAM_0:1:123456",
        "ExistingPlayer",
        "cstrike",
      )

      expect(result).toBe(100)
      // Steam ID is normalized to Steam64 format: 76561197960265728 + 123456*2 + 1
      expect(mockRepository.findByUniqueId).toHaveBeenCalledWith("76561197960512641", "cstrike")
      expect(mockRepository.upsertPlayer).not.toHaveBeenCalled()
    })

    it("should create new player if not found", async () => {
      vi.mocked(mockRepository.findByUniqueId).mockResolvedValue(null)
      vi.mocked(mockRepository.upsertPlayer).mockResolvedValue({
        playerId: 200,
        lastName: "NewPlayer",
        game: "cstrike",
      } as any)

      const result = await service.getOrCreatePlayer("STEAM_0:1:654321", "NewPlayer", "cstrike")

      expect(result).toBe(200)
      // Steam ID is normalized to Steam64 format: 76561197960265728 + 654321*2 + 1
      expect(mockRepository.upsertPlayer).toHaveBeenCalledWith({
        lastName: "NewPlayer",
        game: "cstrike",
        steamId: "76561197961574371",
      })
    })

    it("should normalize Steam ID to Steam64 format", async () => {
      vi.mocked(mockRepository.findByUniqueId).mockResolvedValue({
        playerId: 100,
      } as any)

      await service.getOrCreatePlayer("STEAM_0:1:123456", "Player", "cstrike")

      // Steam ID is normalized to Steam64 format: 76561197960265728 + 123456*2 + 1
      expect(mockRepository.findByUniqueId).toHaveBeenCalledWith("76561197960512641", "cstrike")
    })

    it("should throw error for invalid Steam ID", async () => {
      await expect(service.getOrCreatePlayer("", "Player", "cstrike")).rejects.toThrow(
        "Invalid Steam ID",
      )
    })

    it("should handle bot players with server-specific IDs", async () => {
      vi.mocked(mockRepository.findByUniqueId).mockResolvedValue(null)
      vi.mocked(mockRepository.upsertPlayer).mockResolvedValue({
        playerId: 500,
      } as any)

      await service.getOrCreatePlayer("BOT", "Expert", "cstrike", 5)

      expect(mockRepository.findByUniqueId).toHaveBeenCalledWith("BOT_5_Expert", "cstrike")
      expect(mockRepository.upsertPlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          steamId: "BOT_5_Expert",
        }),
      )
    })

    it("should handle bot players without server ID", async () => {
      vi.mocked(mockRepository.findByUniqueId).mockResolvedValue(null)
      vi.mocked(mockRepository.upsertPlayer).mockResolvedValue({
        playerId: 501,
      } as any)

      await service.getOrCreatePlayer("BOT", "Hard", "cstrike")

      expect(mockRepository.findByUniqueId).toHaveBeenCalledWith("BOT_0_Hard", "cstrike")
    })

    it("should log when creating new player", async () => {
      vi.mocked(mockRepository.findByUniqueId).mockResolvedValue(null)
      vi.mocked(mockRepository.upsertPlayer).mockResolvedValue({
        playerId: 300,
      } as any)

      await service.getOrCreatePlayer("STEAM_0:0:111", "LoggedPlayer", "tf")

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Created new player: LoggedPlayer"),
      )
    })

    it("should handle repository errors", async () => {
      vi.mocked(mockRepository.findByUniqueId).mockRejectedValue(new Error("Database error"))

      await expect(service.getOrCreatePlayer("STEAM_0:1:123", "Player", "cstrike")).rejects.toThrow(
        "Database error",
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to get/create player"),
      )
    })

    it("should sanitize player name", async () => {
      vi.mocked(mockRepository.findByUniqueId).mockResolvedValue(null)
      vi.mocked(mockRepository.upsertPlayer).mockResolvedValue({
        playerId: 400,
      } as any)

      await service.getOrCreatePlayer("STEAM_0:1:999", "  SpacedName  ", "cstrike")

      expect(mockRepository.upsertPlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          lastName: "SpacedName",
        }),
      )
    })
  })
})
