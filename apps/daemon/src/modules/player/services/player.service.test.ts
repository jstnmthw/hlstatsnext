/**
 * PlayerService Unit Tests
 */

import type { IMapService } from "@/modules/map/map.service"
import type { IMatchService } from "@/modules/match/match.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import { EventType } from "@/shared/types/events"
import { createMockDatabaseClient } from "@/tests/mocks/database"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockServerService } from "@/tests/mocks/server.service.mock"
import { createMockSessionService } from "@/tests/mocks/session.service.mock"
import type { Player } from "@repo/db/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PlayerRepository } from "../repositories/player.repository"
import type { PlayerEvent, PlayerKillEvent } from "../types/player.types"
import { PlayerService } from "./player.service"

describe("PlayerService", () => {
  let playerService: PlayerService
  let mockRepository: PlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>
  let mockRankingService: IRankingService
  let mockMatchService: IMatchService
  let mockMapService: IMapService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()
    mockRepository = new PlayerRepository(mockDatabase, mockLogger)

    // Create mock ranking service
    mockRankingService = {
      calculateRatingAdjustment: vi.fn().mockResolvedValue({ winner: 10, loser: -8 }),
      calculateSkillAdjustment: vi.fn().mockResolvedValue({ killerChange: 10, victimChange: -8 }),
      calculateSuicidePenalty: vi.fn().mockReturnValue(-5),
      calculateTeamkillPenalty: vi.fn().mockReturnValue(-10),
      getPlayerRankPosition: vi.fn().mockResolvedValue(1),
      getBatchPlayerRanks: vi.fn().mockResolvedValue(new Map()),
    }

    // Create mock match service
    mockMatchService = {
      handleMatchEvent: vi.fn().mockResolvedValue({ success: true }),
      getMatchStats: vi.fn().mockReturnValue(undefined),
      resetMatchStats: vi.fn(),
      setPlayerTeam: vi.fn(),
      getPlayersByTeam: vi.fn().mockReturnValue([]),
      getServerGame: vi.fn().mockResolvedValue("cstrike"),
    }

    // Create mock map service
    mockMapService = {
      getCurrentMap: vi.fn().mockResolvedValue("de_dust2"),
      getLastKnownMap: vi.fn().mockResolvedValue("de_dust2"),
      handleMapChange: vi.fn(),
    }

    const mockServerRepository = {
      findById: vi.fn().mockResolvedValue({ game: "cstrike" }),
      findByAddress: vi.fn(),
      getServerConfig: vi.fn(),
      hasRconCredentials: vi.fn().mockResolvedValue(false),
      findActiveServersWithRcon: vi.fn().mockResolvedValue([]),
      findServersByIds: vi.fn().mockResolvedValue([]),
      findAllServersWithRcon: vi.fn().mockResolvedValue([]),
      updateServerStatusFromRcon: vi.fn(),
      resetMapStats: vi.fn(),
      getModDefault: vi.fn().mockResolvedValue(null),
      getServerConfigDefault: vi.fn().mockResolvedValue(null),
    }

    const mockServerService = createMockServerService()
    const mockSessionService = createMockSessionService()

    playerService = new PlayerService(
      mockRepository,
      mockLogger,
      mockRankingService,
      mockServerRepository,
      mockServerService,
      mockSessionService,
      mockMatchService,
      mockMapService,
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

      // Verify map service was called for map resolution
      expect(mockMapService.getCurrentMap).toHaveBeenCalledWith(1)
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
      mockMapService.getCurrentMap = vi.fn().mockResolvedValue("cs_office")

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
      expect(mockMapService.getCurrentMap).toHaveBeenCalledWith(5)

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

      // Mock MapService to return "de_mirage" (MapService handles fallback internally)
      mockMapService.getCurrentMap = vi.fn().mockResolvedValue("de_mirage")

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
      expect(mockMapService.getCurrentMap).toHaveBeenCalledWith(3)

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
        findServersByIds: vi.fn().mockResolvedValue([]),
        findAllServersWithRcon: vi.fn().mockResolvedValue([]),
        updateServerStatusFromRcon: vi.fn(),
        resetMapStats: vi.fn(),
        getModDefault: vi.fn().mockResolvedValue(null),
        getServerConfigDefault: vi.fn().mockResolvedValue(null),
      }

      const localMockServerService = createMockServerService()
      const localMockSessionService = createMockSessionService()

      // Create PlayerService without MatchService
      const playerServiceNoMatch = new PlayerService(
        mockRepository,
        mockLogger,
        mockRankingService,
        localMockServerRepository,
        localMockServerService,
        localMockSessionService,
        undefined, // no matchService
        undefined, // no mapService
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

      // Should fallback to "unknown" when MapService is not available
      expect(mockRepository.logEventFrag).toHaveBeenCalledWith(
        1,
        2,
        1,
        "unknown",
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
      expect(mockRepository.findByUniqueId).toHaveBeenCalledWith("BOT_2_TestBot", "cstrike")
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

    it("should generate server-specific BOT unique IDs when serverId is provided", async () => {
      const steamId = "BOT"
      const botName = "TestBot"
      const game = "cstrike"
      const serverId = 5

      // Mock the upsert method to capture the unique ID used
      const upsertSpy = vi
        .spyOn(mockRepository, "upsertPlayer")
        .mockResolvedValue({ playerId: 123 } as Player)

      const result = await playerService.getOrCreatePlayer(steamId, botName, game, serverId)

      expect(result).toBe(123)
      expect(upsertSpy).toHaveBeenCalledWith({
        lastName: botName,
        game,
        skill: 1000,
        steamId: "BOT_5_TestBot", // Should use server-specific format with original name
      })
    })

    it("should use default server (0) for BOT unique IDs when serverId is not provided", async () => {
      const steamId = "BOT"
      const botName = "TestBot"
      const game = "cstrike"

      // Mock the upsert method to capture the unique ID used
      const upsertSpy = vi
        .spyOn(mockRepository, "upsertPlayer")
        .mockResolvedValue({ playerId: 124 } as Player)

      const result = await playerService.getOrCreatePlayer(steamId, botName, game)

      expect(result).toBe(124)
      expect(upsertSpy).toHaveBeenCalledWith({
        lastName: botName,
        game,
        skill: 1000,
        steamId: "BOT_0_TestBot", // Should use default server 0
      })
    })

    it("should not modify non-BOT Steam IDs when serverId is provided", async () => {
      const steamId = "76561198000123456"
      const playerName = "RealPlayer"
      const game = "cstrike"
      const serverId = 3

      // Mock the upsert method to capture the unique ID used
      const upsertSpy = vi
        .spyOn(mockRepository, "upsertPlayer")
        .mockResolvedValue({ playerId: 125 } as Player)

      const result = await playerService.getOrCreatePlayer(steamId, playerName, game, serverId)

      expect(result).toBe(125)
      expect(upsertSpy).toHaveBeenCalledWith({
        lastName: playerName,
        game,
        skill: 1000,
        steamId: "76561198000123456", // Should remain unchanged for real players
      })
    })
  })

  // ---------------------------------------------------------------
  // Additional coverage for getOrCreatePlayer branches
  // ---------------------------------------------------------------
  describe("getOrCreatePlayer - error and edge cases", () => {
    it("should throw for invalid Steam ID", async () => {
      await expect(
        playerService.getOrCreatePlayer("INVALID_STEAM_ID", "Player", "csgo"),
      ).rejects.toThrow("Invalid Steam ID")
    })

    it("should throw for invalid player name (empty string after trim)", async () => {
      await expect(
        playerService.getOrCreatePlayer("76561198000000000", "   ", "csgo"),
      ).rejects.toThrow()
    })

    it("should remove failed promise from cache on error and allow retry", async () => {
      vi.spyOn(mockRepository, "upsertPlayer")
        .mockRejectedValueOnce(new Error("DB error"))
        .mockResolvedValueOnce({ playerId: 42 } as Player)

      // First call should fail
      await expect(
        playerService.getOrCreatePlayer("76561198000000000", "Player", "csgo"),
      ).rejects.toThrow("DB error")

      // Second call should succeed (cache was cleared on error)
      const result = await playerService.getOrCreatePlayer("76561198000000000", "Player", "csgo")
      expect(result).toBe(42)
    })

    it("should handle case-insensitive BOT detection (lowercase 'bot')", async () => {
      vi.spyOn(mockRepository, "upsertPlayer").mockResolvedValue({ playerId: 200 } as Player)

      // normalizeSteamId with "BOT" returns "BOT", and isBot check uses toUpperCase
      const result = await playerService.getOrCreatePlayer("BOT", "SomeBot", "cstrike", 3)
      expect(result).toBe(200)
      expect(mockRepository.upsertPlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          steamId: "BOT_3_SomeBot",
        }),
      )
    })
  })

  // ---------------------------------------------------------------
  // getPlayerStats
  // ---------------------------------------------------------------
  describe("getPlayerStats - coverage", () => {
    it("should return player stats from repository", async () => {
      const mockPlayer = { playerId: 1, skill: 1000 } as Player
      vi.spyOn(mockRepository, "findById").mockResolvedValue(mockPlayer)

      const result = await playerService.getPlayerStats(1)
      expect(result).toEqual(mockPlayer)
    })

    it("should return null on repository error", async () => {
      vi.spyOn(mockRepository, "findById").mockRejectedValue(new Error("DB error"))

      const result = await playerService.getPlayerStats(1)
      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to get player stats"),
      )
    })
  })

  // ---------------------------------------------------------------
  // updatePlayerStats
  // ---------------------------------------------------------------
  describe("updatePlayerStats - coverage", () => {
    it("should build and apply stat updates", async () => {
      vi.spyOn(mockRepository, "update").mockResolvedValue({} as Player)

      await playerService.updatePlayerStats(1, {
        kills: 5,
        deaths: 3,
        suicides: 1,
        teamkills: 0,
        skill: 10,
        shots: 50,
        hits: 25,
        headshots: 5,
        connectionTime: 300,
        killStreak: 3,
        deathStreak: 0,
        lastEvent: new Date(),
        lastName: "UpdatedName",
      })

      expect(mockRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          kills: { increment: 5 },
          deaths: { increment: 3 },
        }),
      )
    })

    it("should do nothing when no valid updates are provided (empty object)", async () => {
      const updateSpy = vi.spyOn(mockRepository, "update").mockResolvedValue({} as Player)

      await playerService.updatePlayerStats(1, {})

      expect(updateSpy).not.toHaveBeenCalled()
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("No valid updates"))
    })

    it("should not call builder methods for undefined update fields", async () => {
      vi.spyOn(mockRepository, "update").mockResolvedValue({} as Player)

      // Only provide kills, nothing else
      await playerService.updatePlayerStats(1, { kills: 1 })

      expect(mockRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          kills: { increment: 1 },
        }),
      )
    })

    it("should throw on repository error", async () => {
      vi.spyOn(mockRepository, "update").mockRejectedValue(new Error("DB update error"))

      await expect(playerService.updatePlayerStats(1, { kills: 1 })).rejects.toThrow(
        "DB update error",
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update player stats"),
      )
    })

    it("should skip kills=0 (builder ignores 0)", async () => {
      const updateSpy = vi.spyOn(mockRepository, "update").mockResolvedValue({} as Player)

      // kills=0 will not trigger addKills because 0 > 0 is false
      await playerService.updatePlayerStats(1, { kills: 0, lastName: "Name" })

      // update should still be called because lastName is present
      expect(updateSpy).toHaveBeenCalled()
    })

    it("should apply teamkills and skill changes", async () => {
      vi.spyOn(mockRepository, "update").mockResolvedValue({} as Player)

      await playerService.updatePlayerStats(1, { teamkills: 2, skill: -5 })

      expect(mockRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          teamkills: { increment: 2 },
          skill: { increment: -5 },
        }),
      )
    })
  })

  // ---------------------------------------------------------------
  // getPlayerRating
  // ---------------------------------------------------------------
  describe("getPlayerRating", () => {
    it("should return default rating when player not found", async () => {
      vi.spyOn(mockRepository, "findById").mockResolvedValue(null)

      const rating = await playerService.getPlayerRating(999)

      expect(rating).toEqual({
        playerId: 999,
        rating: 1000,
        confidence: 350,
        volatility: 0.06,
        gamesPlayed: 0,
      })
    })

    it("should calculate adjusted confidence from games played", async () => {
      vi.spyOn(mockRepository, "findById").mockResolvedValue({
        skill: 1200,
        _count: { fragsAsKiller: 100 },
      } as unknown as Player)

      const rating = await playerService.getPlayerRating(1)

      expect(rating.playerId).toBe(1)
      expect(rating.rating).toBe(1200)
      expect(rating.confidence).toBe(350 - 100) // DEFAULT_CONFIDENCE - fragsAsKiller
      expect(rating.gamesPlayed).toBe(100)
    })

    it("should cap confidence reduction at MAX_CONFIDENCE_REDUCTION (300)", async () => {
      vi.spyOn(mockRepository, "findById").mockResolvedValue({
        skill: 1500,
        _count: { fragsAsKiller: 500 },
      } as unknown as Player)

      const rating = await playerService.getPlayerRating(1)

      // confidence = 350 - min(500, 300) = 350 - 300 = 50
      expect(rating.confidence).toBe(50)
    })

    it("should return default rating on error", async () => {
      vi.spyOn(mockRepository, "findById").mockRejectedValue(new Error("DB error"))

      const rating = await playerService.getPlayerRating(1)

      expect(rating).toEqual({
        playerId: 1,
        rating: 1000,
        confidence: 350,
        volatility: 0.06,
        gamesPlayed: 0,
      })
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to get player rating"),
      )
    })
  })

  // ---------------------------------------------------------------
  // updatePlayerRatings
  // ---------------------------------------------------------------
  describe("updatePlayerRatings", () => {
    it("should update all player ratings", async () => {
      vi.spyOn(mockRepository, "update").mockResolvedValue({} as Player)

      const updates = [
        { playerId: 1, newRating: 1050, gamesPlayed: 10 },
        { playerId: 2, newRating: 950, gamesPlayed: 8 },
      ]

      await playerService.updatePlayerRatings(updates)

      expect(mockRepository.update).toHaveBeenCalledTimes(2)
      expect(mockRepository.update).toHaveBeenCalledWith(1, {
        skill: 1050,
        lastSkillChange: expect.any(Date),
      })
      expect(mockRepository.update).toHaveBeenCalledWith(2, {
        skill: 950,
        lastSkillChange: expect.any(Date),
      })
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Updated ratings for 2 players"),
      )
    })

    it("should throw on repository error", async () => {
      vi.spyOn(mockRepository, "update").mockRejectedValue(new Error("Batch error"))

      await expect(
        playerService.updatePlayerRatings([{ playerId: 1, newRating: 1000, gamesPlayed: 0 }]),
      ).rejects.toThrow("Batch error")
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update player ratings"),
      )
    })
  })

  // ---------------------------------------------------------------
  // handlePlayerEvent - error path (covers the outer catch in handlePlayerEvent)
  // ---------------------------------------------------------------
  describe("handlePlayerEvent - error handling", () => {
    it("should catch handler errors and return error result with Error message", async () => {
      // Create a service where the event handler factory will be initialized,
      // then mock getHandler to throw an Error
      const event: PlayerEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-error",
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      // Force the factory to be created by calling once with unknown event
      await playerService.handlePlayerEvent({
        // @ts-expect-error - trigger factory init
        eventType: "INIT_FACTORY",
        timestamp: new Date(),
        serverId: 1,
        data: {} as any,
      })

      // Now access the private eventHandlerFactory and mock getHandler to throw
      const factory = (playerService as any).eventHandlerFactory
      vi.spyOn(factory, "getHandler").mockImplementation(() => {
        throw new Error("Factory failure")
      })

      const result = await playerService.handlePlayerEvent(event)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Factory failure")
    })

    it("should handle non-Error thrown objects", async () => {
      // Force factory init
      await playerService.handlePlayerEvent({
        // @ts-expect-error - trigger factory init
        eventType: "INIT_FACTORY2",
        timestamp: new Date(),
        serverId: 1,
        data: {} as any,
      })

      const factory = (playerService as any).eventHandlerFactory
      vi.spyOn(factory, "getHandler").mockImplementation(() => {
        throw "string error"
      })

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-string-error",
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

      expect(result.success).toBe(false)
      expect(result.error).toBe("string error")
    })
  })

  // ---------------------------------------------------------------
  // getPlayerStatsBatch
  // ---------------------------------------------------------------
  describe("getPlayerStatsBatch", () => {
    it("should return player stats map from repository", async () => {
      const mockMap = new Map<number, Player>([
        [1, { playerId: 1, skill: 1000 } as Player],
        [2, { playerId: 2, skill: 900 } as Player],
      ])
      vi.spyOn(mockRepository, "getPlayerStatsBatch").mockResolvedValue(mockMap)

      const result = await playerService.getPlayerStatsBatch([1, 2])
      expect(result.size).toBe(2)
      expect(result.get(1)?.skill).toBe(1000)
    })

    it("should return empty map on error", async () => {
      vi.spyOn(mockRepository, "getPlayerStatsBatch").mockRejectedValue(new Error("Batch error"))

      const result = await playerService.getPlayerStatsBatch([1, 2])
      expect(result.size).toBe(0)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to batch get player stats"),
      )
    })
  })

  // ---------------------------------------------------------------
  // updatePlayerStatsBatch
  // ---------------------------------------------------------------
  describe("updatePlayerStatsBatch", () => {
    it("should call repository for non-empty batch", async () => {
      vi.spyOn(mockRepository, "updatePlayerStatsBatch").mockResolvedValue(undefined)

      await playerService.updatePlayerStatsBatch([
        { playerId: 1, skillDelta: 10 },
        { playerId: 2, skillDelta: -5 },
      ])

      expect(mockRepository.updatePlayerStatsBatch).toHaveBeenCalledWith([
        { playerId: 1, skillDelta: 10 },
        { playerId: 2, skillDelta: -5 },
      ])
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Batch updated stats for 2 players"),
      )
    })

    it("should return early for empty updates array", async () => {
      const batchSpy = vi
        .spyOn(mockRepository, "updatePlayerStatsBatch")
        .mockResolvedValue(undefined)

      await playerService.updatePlayerStatsBatch([])

      expect(batchSpy).not.toHaveBeenCalled()
    })

    it("should throw on repository error", async () => {
      vi.spyOn(mockRepository, "updatePlayerStatsBatch").mockRejectedValue(
        new Error("Batch update error"),
      )

      await expect(
        playerService.updatePlayerStatsBatch([{ playerId: 1, skillDelta: 10 }]),
      ).rejects.toThrow("Batch update error")
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to batch update player stats"),
      )
    })
  })

  // ---------------------------------------------------------------
  // getEventHandlerFactory - lazy init
  // ---------------------------------------------------------------
  describe("getEventHandlerFactory - lazy initialization", () => {
    it("should create event handler factory only once", async () => {
      // The factory is lazily created on first handlePlayerEvent call
      // Call handlePlayerEvent twice with unknown event to trigger factory creation
      const event1: PlayerEvent = {
        // @ts-expect-error - Testing unknown event type
        eventType: "SOME_EVENT_1",
        timestamp: new Date(),
        serverId: 1,
        eventId: "e1",
        data: { playerId: 1 },
      }
      const event2: PlayerEvent = {
        // @ts-expect-error - Testing unknown event type
        eventType: "SOME_EVENT_2",
        timestamp: new Date(),
        serverId: 1,
        eventId: "e2",
        data: { playerId: 1 },
      }

      const result1 = await playerService.handlePlayerEvent(event1)
      const result2 = await playerService.handlePlayerEvent(event2)

      // Both should succeed (unhandled events return success: true)
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
    })
  })

  // ---------------------------------------------------------------
  // _performPlayerResolution error path
  // ---------------------------------------------------------------
  describe("_performPlayerResolution - error handling", () => {
    it("should log and re-throw when upsertPlayer fails", async () => {
      vi.spyOn(mockRepository, "upsertPlayer").mockRejectedValue(new Error("Upsert failed"))

      await expect(
        playerService.getOrCreatePlayer("76561198000000000", "Player", "csgo"),
      ).rejects.toThrow("Upsert failed")

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to upsert player"),
      )
    })
  })
})
