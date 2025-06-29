import { describe, it, expect, beforeEach, vi } from "vitest"
import { RankingHandler } from "../../src/services/processor/handlers/ranking.handler"
import { EventType, PlayerConnectEvent, PlayerKillEvent, RoundEndEvent } from "../../src/types/common/events"
import { PlayerService } from "@/services/player/player.service"
import { WeaponService } from "@/services/weapon/weapon.service"
import { DatabaseClient } from "@/database/client"

// Mock PlayerService
vi.mock("@/services/player/player.service", () => ({
  PlayerService: vi.fn().mockImplementation(() => ({
    getPlayerRating: vi.fn().mockResolvedValue({
      playerId: 123,
      rating: 1000,
      confidence: 350,
      volatility: 0.06,
      gamesPlayed: 0,
    }),
    updatePlayerRatings: vi.fn().mockResolvedValue(undefined),
    getRoundParticipants: vi.fn().mockResolvedValue([
      {
        playerId: 123,
        player: {
          skill: 1000,
          teamkills: 0,
        },
      },
    ]),
  })),
}))

// Mock WeaponService
vi.mock("@/services/weapon/weapon.service", () => ({
  WeaponService: vi.fn().mockImplementation(() => ({
    getSkillMultiplier: vi.fn().mockResolvedValue(1.0),
  })),
}))

describe("RankingHandler", () => {
  let handler: RankingHandler
  let playerService: PlayerService
  let weaponService: WeaponService

  beforeEach(() => {
    playerService = new PlayerService({} as DatabaseClient)
    weaponService = new WeaponService({} as DatabaseClient)
    handler = new RankingHandler(playerService, weaponService)
  })

  describe("handleEvent", () => {
    it("should handle PLAYER_KILL events and calculate rating changes", async () => {
      // Mock different ratings for killer and victim
      vi.spyOn(playerService, "getPlayerRating")
        .mockResolvedValueOnce({
          playerId: 123,
          rating: 1200,
          confidence: 300,
          volatility: 0.06,
          gamesPlayed: 10,
        })
        .mockResolvedValueOnce({
          playerId: 456,
          rating: 1000,
          confidence: 350,
          volatility: 0.06,
          gamesPlayed: 5,
        })

      const event = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 123,
          victimId: 456,
          weapon: "ak47",
          headshot: true,
          killerTeam: "CT",
          victimTeam: "T",
        },
      } as PlayerKillEvent

      const result = await handler.handleEvent(event)

      expect(result.success).toBe(true)
      expect(result.ratingChanges).toBeDefined()
      expect(result.ratingChanges).toHaveLength(2)

      if (!result.ratingChanges) {
        throw new Error("Rating changes should be defined")
      }

      const killerChange = result.ratingChanges.find((r) => r.playerId === 123)
      const victimChange = result.ratingChanges.find((r) => r.playerId === 456)

      expect(killerChange).toBeDefined()
      expect(victimChange).toBeDefined()

      if (!killerChange || !victimChange) {
        throw new Error("Both killer and victim changes should be defined")
      }

      expect(killerChange.change).toBeGreaterThan(0)
      expect(victimChange.change).toBeLessThan(0)
      expect(killerChange.reason).toContain("ak47")
      expect(killerChange.reason).toContain("headshot")
    })

    it("should handle ROUND_END events", async () => {
      const event = {
        eventType: EventType.ROUND_END,
        timestamp: new Date(),
        serverId: 1,
        data: {
          winningTeam: "CT",
          duration: 120,
          score: { team1: 16, team2: 14 },
        },
      } as RoundEndEvent

      const result = await handler.handleEvent(event)

      expect(result.success).toBe(true)
      expect(result.ratingChanges).toBeDefined()
      expect(result.ratingChanges).toHaveLength(1)
      expect(result.ratingChanges?.[0]?.reason).toContain("clean round")
    })

    it("should return success for unhandled event types", async () => {
      const event = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 123,
          steamId: "76561198000000000",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.100",
        },
      } as PlayerConnectEvent

      const result = await handler.handleEvent(event)

      expect(result.success).toBe(true)
      expect(result.ratingChanges).toBeUndefined()
    })

    it("should handle errors from PlayerService gracefully", async () => {
      vi.spyOn(playerService, "getPlayerRating").mockRejectedValueOnce(new Error("DB Error"))

      const event = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 123,
          victimId: 456,
          weapon: "ak47",
          headshot: false,
          killerTeam: "CT",
          victimTeam: "T",
        },
      } as PlayerKillEvent

      const result = await handler.handleEvent(event)

      expect(result.success).toBe(false)
      expect(result.error).toBe("DB Error")
    })
  })

  describe("calculateExpectedScore", () => {
    it("should calculate expected score for equal ratings", () => {
      const expected = handler.calculateExpectedScore(1000, 1000)
      expect(expected).toBeCloseTo(0.5, 2)
    })

    it("should calculate expected score for different ratings", () => {
      const expected = handler.calculateExpectedScore(1200, 1000)
      expect(expected).toBeGreaterThan(0.5)

      const expectedReverse = handler.calculateExpectedScore(1000, 1200)
      expect(expectedReverse).toBeLessThan(0.5)
    })

    it("should handle extreme rating differences", () => {
      const expected = handler.calculateExpectedScore(2000, 800)
      expect(expected).toBeGreaterThan(0.9)

      const expectedReverse = handler.calculateExpectedScore(800, 2000)
      expect(expectedReverse).toBeLessThan(0.1)
    })
  })

  describe("updatePlayerRating", () => {
    it("should update rating based on match outcome", async () => {
      const result = await handler.updatePlayerRating(123, 1.0, 0.5)

      expect(result.playerId).toBe(123)
      expect(result.rating).toBeGreaterThan(1000)
      expect(result.gamesPlayed).toBe(1)
    })

    it("should decrease rating for losses", async () => {
      const result = await handler.updatePlayerRating(123, 0.0, 0.5)

      expect(result.rating).toBeLessThan(1000)
    })

    it("should clamp ratings within bounds", async () => {
      // Test with extreme expected score difference
      const result = await handler.updatePlayerRating(123, 1.0, 0.0)

      expect(result.rating).toBeLessThanOrEqual(3000)
      expect(result.rating).toBeGreaterThanOrEqual(100)
    })
  })
})
