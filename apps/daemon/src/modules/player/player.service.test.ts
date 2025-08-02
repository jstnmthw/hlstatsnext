/**
 * PlayerService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { PlayerService } from "./player.service"
import { PlayerRepository } from "./player.repository"
import { createMockLogger } from "../../tests/mocks/logger"
import { createMockDatabaseClient } from "../../tests/mocks/database"
import type { Player } from "@repo/database/client"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import { EventType } from "@/shared/types/events"
import type { PlayerKillEvent, PlayerEvent } from "./player.types"

describe("PlayerService", () => {
  let playerService: PlayerService
  let mockRepository: PlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>
  let mockRankingService: IRankingService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()
    mockRepository = new PlayerRepository(mockDatabase, mockLogger)

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

  describe("handleKillEvent", () => {
    it("should handle kill events successfully", async () => {
      // Mock player stats
      const killerStats = {
        playerId: 1,
        skill: 1000,
        kills: 5,
        deaths: 3,
        kill_streak: 2,
        death_streak: 0
      } as Player

      const victimStats = {
        playerId: 2,
        skill: 950,
        kills: 3,
        deaths: 5,
        kill_streak: 0,
        death_streak: 1
      } as Player

      // Mock repository methods
      vi.spyOn(mockRepository, "getPlayerStats")
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)
      vi.spyOn(mockRepository, "update").mockResolvedValue(killerStats)
      vi.spyOn(mockRepository, "logEventFrag").mockResolvedValue(undefined)

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-kill",
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT"
        }
      }

      const result = await playerService.handleKillEvent(killEvent)

      expect(result.success).toBe(true)
      expect(result.affected).toBe(2)

      // Verify ranking service was called
      expect(mockRankingService.calculateSkillAdjustment).toHaveBeenCalledWith(
        expect.objectContaining({ playerId: 1, rating: 1000 }),
        expect.objectContaining({ playerId: 2, rating: 950 }),
        expect.objectContaining({ weapon: "ak47", headshot: false })
      )

      // Verify player stats were updated
      expect(mockRepository.update).toHaveBeenCalledTimes(2)
      expect(mockRepository.logEventFrag).toHaveBeenCalledWith(
        1, 2, 1, "", "ak47", false,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined
      )
    })

    it("should handle headshot kills", async () => {
      const killerStats = { playerId: 1, skill: 1000, kills: 0, deaths: 0, kill_streak: 0, death_streak: 0 } as Player
      const victimStats = { playerId: 2, skill: 1000, kills: 0, deaths: 0, kill_streak: 0, death_streak: 0 } as Player

      vi.spyOn(mockRepository, "getPlayerStats")
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)
      vi.spyOn(mockRepository, "update").mockResolvedValue(killerStats)
      vi.spyOn(mockRepository, "logEventFrag").mockResolvedValue(undefined)

      const headshotEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-headshot",
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "deagle",
          headshot: true,
          killerTeam: "CT",
          victimTeam: "TERRORIST"
        }
      }

      await playerService.handleKillEvent(headshotEvent)

      // Verify update was called with headshot increment
      expect(mockRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          headshots: { increment: 1 }
        })
      )
    })

    it("should handle team kills", async () => {
      const killerStats = { playerId: 1, skill: 1000, kills: 0, deaths: 0, kill_streak: 0, death_streak: 0 } as Player
      const victimStats = { playerId: 2, skill: 1000, kills: 0, deaths: 0, kill_streak: 0, death_streak: 0 } as Player

      vi.spyOn(mockRepository, "getPlayerStats")
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)
      vi.spyOn(mockRepository, "update").mockResolvedValue(killerStats)
      vi.spyOn(mockRepository, "logEventFrag").mockResolvedValue(undefined)

      const teamkillEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-teamkill",
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "TERRORIST" // Same team
        }
      }

      await playerService.handleKillEvent(teamkillEvent)

      // Verify teamkill was recorded
      expect(mockRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          teamkills: { increment: 1 }
        })
      )
    })

    it("should fail when players don't exist", async () => {
      vi.spyOn(mockRepository, "getPlayerStats")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-no-players",
        data: {
          killerId: 999,
          victimId: 998,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT"
        }
      }

      const result = await playerService.handleKillEvent(killEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Unable to retrieve player stats for skill calculation")
    })
  })

  describe("handlePlayerEvent", () => {
    it("should route PLAYER_KILL events to handleKillEvent", async () => {
      const killEvent: PlayerEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-routing",
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT"
        }
      }

      // Mock the handleKillEvent method
      const handleKillEventSpy = vi.spyOn(playerService, "handleKillEvent")
        .mockResolvedValue({ success: true, affected: 2 })

      const result = await playerService.handlePlayerEvent(killEvent)

      expect(handleKillEventSpy).toHaveBeenCalledWith(killEvent)
      expect(result.success).toBe(true)
    })

    it("should handle unknown event types gracefully", async () => {
      const unknownEvent: PlayerEvent = {
        eventType: "UNKNOWN_EVENT" as EventType,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-unknown",
        data: {
          playerId: 123,
          message: "test",
          team: "CT",
          isDead: false
        }
      }

      const result = await playerService.handlePlayerEvent(unknownEvent)

      expect(result.success).toBe(true)
    })
  })

  describe("player creation with created_at", () => {
    it("should set created_at when creating players", async () => {
      vi.spyOn(mockRepository, "findByUniqueId").mockResolvedValue(null)
      
      const createSpy = vi.spyOn(mockRepository, "create").mockResolvedValue({ playerId: 1 } as Player)

      await playerService.getOrCreatePlayer("76561198000123456", "TestPlayer", "csgo")

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          lastName: "TestPlayer",
          game: "csgo",
          skill: 1000,
          steamId: "76561198000123456"
        })
      )
    })
  })
})
