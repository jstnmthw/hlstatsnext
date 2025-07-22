/**
 * PlayerService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { PlayerService } from "./player.service"
import { PlayerRepository } from "./player.repository"
import { createMockLogger } from "../../test-support/mocks/logger"
import { createMockDatabaseClient } from "../../test-support/mocks/database"
import type { DatabaseClient } from "@/database/client"
import type { Player } from "@repo/database/client"
import type { IRankingService } from "@/modules/ranking/ranking.types"

describe("PlayerService", () => {
  let playerService: PlayerService
  let mockRepository: PlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>
  let mockRankingService: IRankingService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()
    mockRepository = new PlayerRepository(mockDatabase as unknown as DatabaseClient, mockLogger)
    
    // Create mock ranking service
    mockRankingService = {
      handleRatingUpdate: vi.fn().mockResolvedValue({ success: true }),
      calculateRatingAdjustment: vi.fn().mockResolvedValue({ winner: 10, loser: -8 }),
      calculateSkillAdjustment: vi.fn().mockResolvedValue({ killerChange: 10, victimChange: -8 }),
      calculateSuicidePenalty: vi.fn().mockReturnValue(-5),
    }
    
    playerService = new PlayerService(mockRepository, mockLogger, mockRankingService)
  })

  describe("getOrCreatePlayer", () => {
    it("should be defined and callable", () => {
      expect(playerService.getOrCreatePlayer).toBeDefined()
      expect(typeof playerService.getOrCreatePlayer).toBe("function")
    })

    it("should handle valid inputs", async () => {
      const steamId = "76561198000000000" // Valid Steam64 ID format
      const playerName = "TestPlayer"
      const game = "csgo"

      // Mock repository method
      vi.spyOn(mockRepository, "findByUniqueId").mockResolvedValue(null)
      vi.spyOn(mockRepository, "create").mockResolvedValue({ playerId: 1 } as Player)

      const result = await playerService.getOrCreatePlayer(steamId, playerName, game)

      expect(typeof result).toBe("number")
      expect(result).toBeGreaterThan(0)
    })
  })

  describe("getPlayerStats", () => {
    it("should be defined and callable", () => {
      expect(playerService.getPlayerStats).toBeDefined()
      expect(typeof playerService.getPlayerStats).toBe("function")
    })
  })

  describe("updatePlayerStats", () => {
    it("should be defined and callable", () => {
      expect(playerService.updatePlayerStats).toBeDefined()
      expect(typeof playerService.updatePlayerStats).toBe("function")
    })
  })

  describe("Service instantiation", () => {
    it("should create service instance", () => {
      expect(playerService).toBeDefined()
      expect(playerService).toBeInstanceOf(PlayerService)
    })
  })
})
