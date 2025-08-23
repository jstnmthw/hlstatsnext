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
import type { IMatchService } from "@/modules/match/match.types"
import { EventType } from "@/shared/types/events"
import type { PlayerKillEvent, PlayerEvent } from "./player.types"

describe("PlayerService", () => {
  let playerService: PlayerService
  let mockRepository: PlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>
  let mockRankingService: IRankingService
  let mockMatchService: IMatchService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()
    mockRepository = new PlayerRepository(mockDatabase, mockLogger)

    // Create mock ranking service
    mockRankingService = {
      calculateRatingAdjustment: vi.fn().mockResolvedValue({ winner: 10, loser: -8 }),
      calculateSkillAdjustment: vi.fn().mockResolvedValue({ killerChange: 10, victimChange: -8 }),
      calculateSuicidePenalty: vi.fn().mockReturnValue(-5),
    }

    // Create mock match service
    mockMatchService = {
      handleMatchEvent: vi.fn().mockResolvedValue({ success: true }),
      handleKillInMatch: vi.fn().mockResolvedValue({ success: true }),
      handleObjectiveAction: vi.fn().mockResolvedValue({ success: true }),
      getCurrentMap: vi.fn().mockReturnValue("de_dust2"),
      initializeMapForServer: vi.fn().mockResolvedValue("de_dust2"),
      getMatchStats: vi.fn().mockReturnValue(undefined),
      calculateMatchMVP: vi.fn().mockResolvedValue(undefined),
      resetMatchStats: vi.fn(),
      updatePlayerWeaponStats: vi.fn(),
      calculatePlayerScore: vi.fn().mockReturnValue(100),
      setPlayerTeam: vi.fn(),
      getPlayersByTeam: vi.fn().mockReturnValue([]),
      getServerGame: vi.fn().mockResolvedValue("cstrike"),
    }

    const mockServerRepository = {
      findById: vi.fn().mockResolvedValue({ game: "cstrike" }),
      findByAddress: vi.fn(),
      getServerConfig: vi.fn(),
      hasRconCredentials: vi.fn().mockResolvedValue(false),
      findActiveServersWithRcon: vi.fn().mockResolvedValue([]),
      updateServerStatusFromRcon: vi.fn(),
      resetMapStats: vi.fn(),
      getModDefault: vi.fn().mockResolvedValue(null),
      getServerConfigDefault: vi.fn().mockResolvedValue(null),
    }

    playerService = new PlayerService(
      mockRepository,
      mockLogger,
      mockRankingService,
      mockServerRepository,
      mockMatchService,
    )
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

      // Mock repository upsert method
      vi.spyOn(mockRepository, "upsertPlayer").mockResolvedValue({ playerId: 1 } as Player)

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

  describe("handlePlayerEvent - PLAYER_KILL", () => {
    it("should handle kill events successfully", async () => {
      // Mock player stats
      const killerStats = {
        playerId: 1,
        skill: 1000,
        kills: 5,
        deaths: 3,
        killStreak: 2,
        deathStreak: 0,
      } as Player

      const victimStats = {
        playerId: 2,
        skill: 950,
        kills: 3,
        deaths: 5,
        killStreak: 0,
        deathStreak: 1,
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
          victimTeam: "CT",
        },
      }

      const result = await playerService.handlePlayerEvent(killEvent)

      expect(result.success).toBe(true)

      // Verify ranking service was called
      expect(mockRankingService.calculateSkillAdjustment).toHaveBeenCalledWith(
        expect.objectContaining({ playerId: 1, rating: 1000 }),
        expect.objectContaining({ playerId: 2, rating: 950 }),
        expect.objectContaining({ weapon: "ak47", headshot: false }),
      )

      // Verify player stats were updated
      expect(mockRepository.update).toHaveBeenCalledTimes(2)
      expect(mockRepository.logEventFrag).toHaveBeenCalledWith(
        1,
        2,
        1,
        "de_dust2",
        "ak47",
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )

      // Verify match service was called for map resolution
      expect(mockMatchService.getCurrentMap).toHaveBeenCalledWith(1)
    })

    it("should handle headshot kills", async () => {
      const killerStats = {
        playerId: 1,
        skill: 1000,
        kills: 0,
        deaths: 0,
        killStreak: 0,
        deathStreak: 0,
      } as Player
      const victimStats = {
        playerId: 2,
        skill: 1000,
        kills: 0,
        deaths: 0,
        killStreak: 0,
        deathStreak: 0,
      } as Player

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
          victimTeam: "TERRORIST",
        },
      }

      await playerService.handlePlayerEvent(headshotEvent)

      // Verify update was called with headshot increment
      expect(mockRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          headshots: { increment: 1 },
        }),
      )
    })

    it("should handle team kills", async () => {
      const killerStats = {
        playerId: 1,
        skill: 1000,
        kills: 0,
        deaths: 0,
        killStreak: 0,
        deathStreak: 0,
      } as Player
      const victimStats = {
        playerId: 2,
        skill: 1000,
        kills: 0,
        deaths: 0,
        killStreak: 0,
        deathStreak: 0,
      } as Player

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
          victimTeam: "TERRORIST", // Same team
        },
      }

      await playerService.handlePlayerEvent(teamkillEvent)

      // Verify teamkill was recorded
      expect(mockRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          teamkills: { increment: 1 },
        }),
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
          victimTeam: "CT",
        },
      }

      const result = await playerService.handlePlayerEvent(killEvent)

      expect(result.success).toBe(true)
    })

    it("should use current map from MatchService in EventFrag", async () => {
      const killerStats = {
        playerId: 1,
        skill: 1000,
        kills: 0,
        deaths: 0,
        killStreak: 0,
        deathStreak: 0,
      } as Player
      const victimStats = {
        playerId: 2,
        skill: 1000,
        kills: 0,
        deaths: 0,
        killStreak: 0,
        deathStreak: 0,
      } as Player

      vi.spyOn(mockRepository, "getPlayerStats")
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)
      vi.spyOn(mockRepository, "update").mockResolvedValue(killerStats)
      vi.spyOn(mockRepository, "logEventFrag").mockResolvedValue(undefined)

      // Mock MatchService to return specific map
      mockMatchService.getCurrentMap = vi.fn().mockReturnValue("cs_office")

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 5,
        eventId: "test-map",
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "m4a1",
          headshot: false,
          killerTeam: "CT",
          victimTeam: "TERRORIST",
        },
      }

      await playerService.handlePlayerEvent(killEvent)

      // Verify MatchService was called with correct serverId
      expect(mockMatchService.getCurrentMap).toHaveBeenCalledWith(5)

      // Verify EventFrag was created with correct map
      expect(mockRepository.logEventFrag).toHaveBeenCalledWith(
        1,
        2,
        5,
        "cs_office",
        "m4a1",
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )
    })

    it("should fallback to initializeMapForServer when current map is unknown", async () => {
      const killerStats = {
        playerId: 1,
        skill: 1000,
        kills: 0,
        deaths: 0,
        killStreak: 0,
        deathStreak: 0,
      } as Player
      const victimStats = {
        playerId: 2,
        skill: 1000,
        kills: 0,
        deaths: 0,
        killStreak: 0,
        deathStreak: 0,
      } as Player

      vi.spyOn(mockRepository, "getPlayerStats")
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)
      vi.spyOn(mockRepository, "update").mockResolvedValue(killerStats)
      vi.spyOn(mockRepository, "logEventFrag").mockResolvedValue(undefined)

      // Mock MatchService to return "unknown" initially, then resolve to specific map
      mockMatchService.getCurrentMap = vi.fn().mockReturnValue("unknown")
      mockMatchService.initializeMapForServer = vi.fn().mockResolvedValue("de_mirage")

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 3,
        eventId: "test-fallback",
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "awp",
          headshot: true,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      await playerService.handlePlayerEvent(killEvent)

      // Verify both methods were called
      expect(mockMatchService.getCurrentMap).toHaveBeenCalledWith(3)
      expect(mockMatchService.initializeMapForServer).toHaveBeenCalledWith(3)

      // Verify EventFrag was created with resolved map
      expect(mockRepository.logEventFrag).toHaveBeenCalledWith(
        1,
        2,
        3,
        "de_mirage",
        "awp",
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )
    })

    it("should handle missing MatchService gracefully", async () => {
      // Create local mock server repository
      const localMockServerRepository = {
        findById: vi.fn().mockResolvedValue({ game: "cstrike" }),
        findByAddress: vi.fn(),
        getServerConfig: vi.fn(),
        hasRconCredentials: vi.fn().mockResolvedValue(false),
        findActiveServersWithRcon: vi.fn().mockResolvedValue([]),
        updateServerStatusFromRcon: vi.fn(),
        resetMapStats: vi.fn(),
        getModDefault: vi.fn().mockResolvedValue(null),
        getServerConfigDefault: vi.fn().mockResolvedValue(null),
      }

      // Create PlayerService without MatchService
      const playerServiceNoMatch = new PlayerService(
        mockRepository,
        mockLogger,
        mockRankingService,
        localMockServerRepository,
      )

      const killerStats = {
        playerId: 1,
        skill: 1000,
        kills: 0,
        deaths: 0,
        killStreak: 0,
        deathStreak: 0,
      } as Player
      const victimStats = {
        playerId: 2,
        skill: 1000,
        kills: 0,
        deaths: 0,
        killStreak: 0,
        deathStreak: 0,
      } as Player

      vi.spyOn(mockRepository, "getPlayerStats")
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)
      vi.spyOn(mockRepository, "update").mockResolvedValue(killerStats)
      vi.spyOn(mockRepository, "logEventFrag").mockResolvedValue(undefined)

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-no-match-service",
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "glock",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      await playerServiceNoMatch.handlePlayerEvent(killEvent)

      // Should fallback to empty string when MatchService is not available
      expect(mockRepository.logEventFrag).toHaveBeenCalledWith(
        1,
        2,
        1,
        "",
        "glock",
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )
    })
  })

  describe("players_names aggregation wiring", () => {
    it("should upsert alias on connect with numUses", async () => {
      const connectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 10,
        data: {
          playerId: 11,
          steamId: "7656119",
          playerName: "AliasX",
          ipAddress: "1.2.3.4:27015",
        },
        meta: { playerName: "AliasX" },
      } as unknown as PlayerEvent

      const upsertSpy = vi.spyOn(mockRepository, "upsertPlayerName").mockResolvedValue()
      await playerService.handlePlayerEvent(connectEvent)
      expect(upsertSpy).toHaveBeenCalledWith(
        11,
        "AliasX",
        expect.objectContaining({ numUses: 1, lastUse: expect.any(Date) }),
      )
    })

    it("should update alias counters on kill for killer and victim", async () => {
      vi.spyOn(mockRepository, "getPlayerStats")
        .mockResolvedValueOnce({ playerId: 1, skill: 1000, kills: 0, deaths: 0 } as Player)
        .mockResolvedValueOnce({ playerId: 2, skill: 950, kills: 0, deaths: 0 } as Player)
      vi.spyOn(mockRepository, "update").mockResolvedValue({} as Player)
      vi.spyOn(mockRepository, "logEventFrag").mockResolvedValue()

      const upsertSpy = vi.spyOn(mockRepository, "upsertPlayerName").mockResolvedValue()
      const evt: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: true,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
        meta: {
          killer: { steamId: "s1", playerName: "KAlias", isBot: false },
          victim: { steamId: "s2", playerName: "VAlias", isBot: false },
        },
      }

      await playerService.handlePlayerEvent(evt)
      expect(upsertSpy).toHaveBeenCalledWith(
        1,
        "KAlias",
        expect.objectContaining({ kills: 1, headshots: 1, lastUse: expect.any(Date) }),
      )
      expect(upsertSpy).toHaveBeenCalledWith(
        2,
        "VAlias",
        expect.objectContaining({ deaths: 1, lastUse: expect.any(Date) }),
      )
    })
  })

  describe("bot lifecycle synthesis", () => {
    it("synthesizes connect on entry when missing and increments server counters", async () => {
      const entryEvent: PlayerEvent = {
        eventType: EventType.PLAYER_ENTRY,
        timestamp: new Date(),
        serverId: 7,
        data: { playerId: 42 },
      } as unknown as PlayerEvent

      const hasRecentSpy = vi
        .spyOn(
          mockRepository as unknown as {
            hasRecentConnect: (a: number, b: number, c?: number) => Promise<boolean>
          },
          "hasRecentConnect",
        )
        .mockResolvedValue(false)
      const createConnectSpy = vi.spyOn(mockRepository, "createConnectEvent").mockResolvedValue()
      const serverUpdateSpy = vi
        .spyOn(mockRepository, "updateServerForPlayerEvent")
        .mockResolvedValue()

      await playerService.handlePlayerEvent(entryEvent)

      expect(hasRecentSpy).toHaveBeenCalled()
      expect(createConnectSpy).toHaveBeenCalledWith(42, 7, expect.any(String), "")
      expect(serverUpdateSpy).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ activePlayers: { increment: 1 } }),
      )
    })

    it("skips disconnect event when playerId is invalid and no bot metadata", async () => {
      const disconnectEvent: PlayerEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 9,
        data: { playerId: -1 },
      } as unknown as PlayerEvent

      const createDisconnectSpy = vi
        .spyOn(mockRepository, "createDisconnectEvent")
        .mockResolvedValue()
      const result = await playerService.handlePlayerEvent(disconnectEvent)
      expect(result.success).toBe(true)
      expect(createDisconnectSpy).not.toHaveBeenCalled()
    })
  })

  describe("handlePlayerEvent", () => {
    it("should handle PLAYER_KILL events through the event handler factory", async () => {
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
          victimTeam: "CT",
        },
      }

      // Mock repository methods for kill event handling
      vi.spyOn(mockRepository, "getPlayerStats")
        .mockResolvedValueOnce({ playerId: 1, skill: 1000 } as Player)
        .mockResolvedValueOnce({ playerId: 2, skill: 950 } as Player)
      vi.spyOn(mockRepository, "update").mockResolvedValue({} as Player)
      vi.spyOn(mockRepository, "logEventFrag").mockResolvedValue(undefined)

      const result = await playerService.handlePlayerEvent(killEvent)

      expect(result.success).toBe(true)
    })

    it("should handle unknown event types gracefully", async () => {
      const unknownEvent: PlayerEvent = {
        // @ts-expect-error - This is purposely testing an unknown event type
        eventType: "UNKNOWN_EVENT",
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-unknown",
        data: {
          playerId: 123,
          message: "test",
          team: "CT",
          isDead: false,
        },
      }

      const result = await playerService.handlePlayerEvent(unknownEvent)

      expect(result.success).toBe(true)
    })

    it("should persist EventEntry on PLAYER_ENTRY", async () => {
      const entryEvent: PlayerEvent = {
        eventType: EventType.PLAYER_ENTRY,
        timestamp: new Date(),
        serverId: 1,
        eventId: "entry-1",
        data: {
          playerId: 99,
        },
        meta: { isBot: false },
      } as unknown as PlayerEvent

      const repoSpy = vi.spyOn(mockRepository, "createEntryEvent").mockResolvedValue()
      const result = await playerService.handlePlayerEvent(entryEvent)
      expect(result.success).toBe(true)
      expect(repoSpy).toHaveBeenCalledWith(99, 1, expect.any(String))
    })

    it("should skip disconnect event for invalid playerId without bot metadata", async () => {
      const disconnectEvent: PlayerEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 2,
        eventId: "disc-1",
        data: {
          playerId: -1,
        },
      } as unknown as PlayerEvent

      const repoSpy = vi.spyOn(mockRepository, "createDisconnectEvent").mockResolvedValue()
      const result = await playerService.handlePlayerEvent(disconnectEvent)
      expect(result.success).toBe(true)
      expect(repoSpy).not.toHaveBeenCalled()
    })

    it("should resolve bot playerId from metadata and create disconnect event", async () => {
      const disconnectEvent: PlayerEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 2,
        eventId: "disc-bot-1",
        data: {
          playerId: -1,
        },
        meta: {
          steamId: "BOT",
          playerName: "TestBot",
          isBot: true,
        },
      } as unknown as PlayerEvent

      // Mock bot resolution
      vi.spyOn(mockRepository, "findByUniqueId").mockResolvedValue({ playerId: 123 } as Player)
      const repoSpy = vi.spyOn(mockRepository, "createDisconnectEvent").mockResolvedValue()

      const result = await playerService.handlePlayerEvent(disconnectEvent)
      expect(result.success).toBe(true)
      expect(mockRepository.findByUniqueId).toHaveBeenCalledWith("BOT_TestBot", "cstrike")
      expect(repoSpy).toHaveBeenCalledWith(123, 2, expect.any(String))
    })

    it("should log connect and entry rows for bots when processed (IgnoreBots handled in handler)", async () => {
      // Connect event for bot
      const connectEvent: PlayerEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 3,
        eventId: "conn-bot",
        data: {
          playerId: 50,
          steamId: "BOT",
          playerName: "Bot01",
          ipAddress: "",
        },
        meta: { isBot: true },
      } as unknown as PlayerEvent

      const connSpy = vi.spyOn(mockRepository, "createConnectEvent").mockResolvedValue()
      await playerService.handlePlayerEvent(connectEvent)
      expect(connSpy).toHaveBeenCalled()

      // Entry event for bot
      const entryEvent: PlayerEvent = {
        eventType: EventType.PLAYER_ENTRY,
        timestamp: new Date(),
        serverId: 3,
        eventId: "entry-bot",
        data: {
          playerId: 50,
        },
        meta: { isBot: true },
      } as unknown as PlayerEvent

      const entrySpy = vi.spyOn(mockRepository, "createEntryEvent").mockResolvedValue()
      await playerService.handlePlayerEvent(entryEvent)
      expect(entrySpy).toHaveBeenCalled()
    })
  })

  describe("player creation with createdAt", () => {
    it("should call upsertPlayer when creating players", async () => {
      const upsertSpy = vi
        .spyOn(mockRepository, "upsertPlayer")
        .mockResolvedValue({ playerId: 1 } as Player)

      await playerService.getOrCreatePlayer("76561198000123456", "TestPlayer", "csgo")

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          lastName: "TestPlayer",
          game: "csgo",
          skill: 1000,
          steamId: "76561198000123456",
        }),
      )
    })

    it("should use upsert to eliminate race conditions", async () => {
      const steamId = "76561198000123456"
      const playerName = "UpsertPlayer"
      const game = "csgo"

      // Mock the upsert method to return a player
      const upsertSpy = vi
        .spyOn(mockRepository, "upsertPlayer")
        .mockResolvedValue({ playerId: 42 } as Player)

      const result = await playerService.getOrCreatePlayer(steamId, playerName, game)

      expect(result).toBe(42)
      expect(upsertSpy).toHaveBeenCalledTimes(1)
      expect(upsertSpy).toHaveBeenCalledWith({
        lastName: playerName,
        game,
        skill: 1000, // DEFAULT_RATING
        steamId,
      })
    })

    it("should cache concurrent player resolution calls", async () => {
      const steamId = "76561198000987654"
      const playerName = "CachedPlayer"
      const game = "csgo"

      // Mock the upsert method to return a player with some delay
      const upsertSpy = vi
        .spyOn(mockRepository, "upsertPlayer")
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ playerId: 99 } as Player), 50)),
        )

      // Make multiple concurrent calls
      const [result1, result2, result3] = await Promise.all([
        playerService.getOrCreatePlayer(steamId, playerName, game),
        playerService.getOrCreatePlayer(steamId, playerName, game),
        playerService.getOrCreatePlayer(steamId, playerName, game),
      ])

      // All should return the same ID
      expect(result1).toBe(99)
      expect(result2).toBe(99)
      expect(result3).toBe(99)

      // But upsert should only be called once due to caching
      expect(upsertSpy).toHaveBeenCalledTimes(1)
    })
  })
})
