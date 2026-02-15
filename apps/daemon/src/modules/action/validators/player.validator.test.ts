/**
 * Player Validator Tests
 *
 * Tests for player validation in action handlers.
 */

import type { IPlayerService } from "@/modules/player/types/player.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PlayerValidator } from "./player.validator"

function createMockPlayerService(): IPlayerService {
  return {
    getPlayerStats: vi.fn(),
    getPlayerStatsBatch: vi.fn(),
    getOrCreatePlayer: vi.fn(),
    updatePlayerStats: vi.fn(),
    createPlayerAction: vi.fn(),
    createKillEvent: vi.fn(),
    findById: vi.fn(),
    findByUniqueId: vi.fn(),
    createPlayer: vi.fn(),
    updatePlayer: vi.fn(),
  } as unknown as IPlayerService
}

describe("PlayerValidator", () => {
  let validator: PlayerValidator
  let mockPlayerService: IPlayerService
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockPlayerService = createMockPlayerService()
    validator = new PlayerValidator(mockPlayerService, mockLogger)
  })

  describe("validateSinglePlayer", () => {
    it("should return without early return when player exists", async () => {
      vi.mocked(mockPlayerService.getPlayerStats).mockResolvedValue({
        playerId: 100,
        skill: 1000,
      } as any)

      const result = await validator.validateSinglePlayer(100, "Kill")

      expect(result.shouldEarlyReturn).toBe(false)
      expect(result.playerId).toBe(100)
    })

    it("should resolve player from meta when not found", async () => {
      vi.mocked(mockPlayerService.getPlayerStats).mockResolvedValue(null)
      vi.mocked(mockPlayerService.getOrCreatePlayer).mockResolvedValue(200)

      const result = await validator.validateSinglePlayer(
        100,
        "Kill",
        { steamId: "STEAM_0:1:123", playerName: "TestPlayer" },
        "cstrike",
        1,
      )

      expect(result.shouldEarlyReturn).toBe(false)
      expect(result.playerId).toBe(200)
      expect(mockPlayerService.getOrCreatePlayer).toHaveBeenCalledWith(
        "STEAM_0:1:123",
        "TestPlayer",
        "cstrike",
        1,
      )
    })

    it("should early return with success when player not found and no meta", async () => {
      vi.mocked(mockPlayerService.getPlayerStats).mockResolvedValue(null)

      const result = await validator.validateSinglePlayer(100, "Kill")

      expect(result.shouldEarlyReturn).toBe(true)
      expect(result.earlyResult).toEqual({ success: true })
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Player 100 not found"))
    })

    it("should early return when player resolution fails", async () => {
      vi.mocked(mockPlayerService.getPlayerStats).mockResolvedValue(null)
      vi.mocked(mockPlayerService.getOrCreatePlayer).mockRejectedValue(
        new Error("Resolution failed"),
      )

      const result = await validator.validateSinglePlayer(
        100,
        "Kill",
        { steamId: "STEAM_0:1:123", playerName: "TestPlayer" },
        "cstrike",
      )

      expect(result.shouldEarlyReturn).toBe(true)
      expect(result.earlyResult).toEqual({ success: true })
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("could not be resolved"))
    })

    it("should skip validation when player service is undefined", async () => {
      const validatorWithoutService = new PlayerValidator(undefined, mockLogger)

      const result = await validatorWithoutService.validateSinglePlayer(100, "Kill")

      expect(result.shouldEarlyReturn).toBe(false)
      expect(result.playerId).toBe(100)
    })

    it("should early return when meta is incomplete", async () => {
      vi.mocked(mockPlayerService.getPlayerStats).mockResolvedValue(null)

      // Missing playerName
      const result1 = await validator.validateSinglePlayer(
        100,
        "Kill",
        { steamId: "STEAM_0:1:123" },
        "cstrike",
      )
      expect(result1.shouldEarlyReturn).toBe(true)

      // Missing game
      const result2 = await validator.validateSinglePlayer(100, "Kill", {
        steamId: "STEAM_0:1:123",
        playerName: "TestPlayer",
      })
      expect(result2.shouldEarlyReturn).toBe(true)
    })
  })

  describe("validateMultiplePlayers", () => {
    it("should return all valid players", async () => {
      vi.mocked(mockPlayerService.getPlayerStatsBatch).mockResolvedValue(
        new Map([
          [1, { playerId: 1 }],
          [2, { playerId: 2 }],
          [3, { playerId: 3 }],
        ]) as any,
      )

      const result = await validator.validateMultiplePlayers([1, 2, 3], "TeamAction")

      expect(result.validPlayerIds).toEqual([1, 2, 3])
      expect(result.hasValidPlayers).toBe(true)
    })

    it("should filter out invalid players", async () => {
      vi.mocked(mockPlayerService.getPlayerStatsBatch).mockResolvedValue(
        new Map([
          [1, { playerId: 1 }],
          [3, { playerId: 3 }],
        ]) as any,
      )

      const result = await validator.validateMultiplePlayers([1, 2, 3], "TeamAction")

      expect(result.validPlayerIds).toEqual([1, 3])
      expect(result.hasValidPlayers).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Player 2 not found"))
    })

    it("should return empty when no valid players", async () => {
      vi.mocked(mockPlayerService.getPlayerStatsBatch).mockResolvedValue(new Map())

      const result = await validator.validateMultiplePlayers([1, 2, 3], "TeamAction")

      expect(result.validPlayerIds).toEqual([])
      expect(result.hasValidPlayers).toBe(false)
    })

    it("should return original ids when player service is undefined", async () => {
      const validatorWithoutService = new PlayerValidator(undefined, mockLogger)

      const result = await validatorWithoutService.validateMultiplePlayers([1, 2, 3], "TeamAction")

      expect(result.validPlayerIds).toEqual([1, 2, 3])
      expect(result.hasValidPlayers).toBe(true)
    })

    it("should handle empty player list", async () => {
      const result = await validator.validateMultiplePlayers([], "TeamAction")

      expect(result.validPlayerIds).toEqual([])
      expect(result.hasValidPlayers).toBe(false)
    })
  })

  describe("validatePlayerPair", () => {
    it("should validate when both players exist", async () => {
      vi.mocked(mockPlayerService.getPlayerStatsBatch).mockResolvedValue(
        new Map([
          [100, { playerId: 100 }],
          [200, { playerId: 200 }],
        ]) as any,
      )

      const result = await validator.validatePlayerPair(100, 200, "Kill")

      expect(result.shouldEarlyReturn).toBe(false)
      expect(result.earlyResult).toBeUndefined()
    })

    it("should early return when player not found", async () => {
      vi.mocked(mockPlayerService.getPlayerStatsBatch).mockResolvedValue(
        new Map([[200, { playerId: 200 }]]) as any,
      )

      const result = await validator.validatePlayerPair(100, 200, "Kill")

      expect(result.shouldEarlyReturn).toBe(true)
      expect(result.earlyResult).toEqual({ success: true })
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Player 100 not found"))
    })

    it("should early return when victim not found", async () => {
      vi.mocked(mockPlayerService.getPlayerStatsBatch).mockResolvedValue(
        new Map([[100, { playerId: 100 }]]) as any,
      )

      const result = await validator.validatePlayerPair(100, 200, "Kill")

      expect(result.shouldEarlyReturn).toBe(true)
      expect(result.earlyResult).toEqual({ success: true })
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Victim 200 not found"))
    })

    it("should skip validation when player service is undefined", async () => {
      const validatorWithoutService = new PlayerValidator(undefined, mockLogger)

      const result = await validatorWithoutService.validatePlayerPair(100, 200, "Kill")

      expect(result.shouldEarlyReturn).toBe(false)
    })
  })
})
