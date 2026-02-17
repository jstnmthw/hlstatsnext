/**
 * Player Session Service Tests
 *
 * Tests for player session management including bot handling
 * and ID conversion functionality.
 */

import type { PlayerInfo, ServerStatus } from "@/modules/rcon/types/rcon.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockPlayerRepository } from "@/tests/mocks/player.repository.mock"
import { createMockPlayerResolver } from "@/tests/mocks/player.service.mock"
import { createMockRconService } from "@/tests/mocks/rcon.service.mock"
import { createMockServerService } from "@/tests/mocks/server.service.mock"
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest"
import { PlayerSessionService } from "./player-session.service"

// Mock dependencies
const mockSessionRepository = {
  createSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  deleteServerSessions: vi.fn(),
  getSessionByGameUserId: vi.fn(),
  getSessionByPlayerId: vi.fn(),
  getSessionBySteamId: vi.fn(),
  getServerSessions: vi.fn().mockResolvedValue([]), // Return empty array by default
  getAllSessions: vi.fn().mockResolvedValue([]),
}

let mockRconService: ReturnType<typeof createMockRconService>
let mockServerService: ReturnType<typeof createMockServerService>
let mockPlayerResolver: ReturnType<typeof createMockPlayerResolver>
let mockPlayerRepository: ReturnType<typeof createMockPlayerRepository>
let mockLogger: ReturnType<typeof createMockLogger>

describe("PlayerSessionService", () => {
  let service: PlayerSessionService

  beforeEach(() => {
    vi.clearAllMocks()

    // Create fresh mocks for each test
    mockRconService = createMockRconService()
    mockServerService = createMockServerService()
    mockPlayerResolver = createMockPlayerResolver()
    mockPlayerRepository = createMockPlayerRepository()
    mockLogger = createMockLogger()

    service = new PlayerSessionService(
      mockSessionRepository,
      mockRconService,
      mockServerService,
      mockPlayerResolver,
      mockPlayerRepository,
      mockLogger,
    )
  })

  describe("createSession", () => {
    it("should create a session successfully", async () => {
      const sessionData = {
        serverId: 1,
        gameUserId: 2,
        databasePlayerId: 100,
        steamId: "STEAM_0:1:12345",
        playerName: "TestPlayer",
        isBot: false,
      }

      const expectedSession = {
        ...sessionData,
        connectedAt: expect.any(Date),
        lastSeen: expect.any(Date),
      }

      mockSessionRepository.createSession.mockResolvedValue(expectedSession)

      const result = await service.createSession(sessionData)

      expect(mockSessionRepository.createSession).toHaveBeenCalledWith(sessionData)
      expect(result).toEqual(expectedSession)
    })
  })

  describe("synchronizeServerSessions", () => {
    it("should synchronize sessions with IgnoreBots=true (skip bots)", async () => {
      const serverId = 1
      const mockPlayerList: PlayerInfo[] = [
        {
          name: "RealPlayer",
          userid: 2,
          uniqueid: "STEAM_0:1:12345",
          isBot: false,
          frag: 10,
          time: "05:30",
          ping: 50,
          loss: 0,
        },
        {
          name: "BotPlayer",
          userid: 3,
          uniqueid: "BOT",
          isBot: true,
          frag: 5,
          time: "03:15",
          ping: 0,
          loss: 0,
        },
      ]

      const mockStatus: ServerStatus = {
        map: "de_dust2",
        players: 2,
        maxPlayers: 32,
        uptime: 3600,
        fps: 100,
        timestamp: new Date(),
        playerList: mockPlayerList,
      }

      // Configure IgnoreBots=true
      ;(
        mockServerService.getServerConfigBoolean as MockedFunction<
          typeof mockServerService.getServerConfigBoolean
        >
      ).mockResolvedValue(true)
      ;(
        mockRconService.isConnected as MockedFunction<typeof mockRconService.isConnected>
      ).mockReturnValue(false)
      ;(
        mockRconService.connect as MockedFunction<typeof mockRconService.connect>
      ).mockResolvedValue(undefined)
      ;(
        mockRconService.getStatus as MockedFunction<typeof mockRconService.getStatus>
      ).mockResolvedValue(mockStatus)
      ;(
        mockPlayerResolver.getOrCreatePlayer as MockedFunction<
          typeof mockPlayerResolver.getOrCreatePlayer
        >
      ).mockResolvedValue(100)
      mockSessionRepository.createSession.mockResolvedValue({})
      mockSessionRepository.deleteServerSessions.mockResolvedValue(0)

      const result = await service.synchronizeServerSessions(serverId)

      // Should only create session for real player, not bot
      expect(mockSessionRepository.createSession).toHaveBeenCalledTimes(1)
      expect(mockSessionRepository.createSession).toHaveBeenCalledWith({
        serverId,
        gameUserId: 2,
        databasePlayerId: 100,
        steamId: "STEAM_0:1:12345",
        playerName: "RealPlayer",
        isBot: false,
      })

      expect(result).toBe(1) // Only 1 session created
    })

    it("should synchronize sessions with IgnoreBots=false (include bots)", async () => {
      const serverId = 1
      const mockPlayerList: PlayerInfo[] = [
        {
          name: "RealPlayer",
          userid: 2,
          uniqueid: "STEAM_0:1:12345",
          isBot: false,
          frag: 10,
          time: "05:30",
          ping: 50,
          loss: 0,
        },
        {
          name: "BotPlayer",
          userid: 3,
          uniqueid: "BOT",
          isBot: true,
          frag: 5,
          time: "03:15",
          ping: 0,
          loss: 0,
        },
      ]

      const mockStatus: ServerStatus = {
        map: "de_dust2",
        players: 2,
        maxPlayers: 32,
        uptime: 3600,
        fps: 100,
        timestamp: new Date(),
        playerList: mockPlayerList,
      }

      // Configure IgnoreBots=false
      ;(
        mockServerService.getServerConfigBoolean as MockedFunction<
          typeof mockServerService.getServerConfigBoolean
        >
      ).mockResolvedValue(false)
      ;(
        mockRconService.isConnected as MockedFunction<typeof mockRconService.isConnected>
      ).mockReturnValue(false)
      ;(
        mockRconService.connect as MockedFunction<typeof mockRconService.connect>
      ).mockResolvedValue(undefined)
      ;(
        mockRconService.getStatus as MockedFunction<typeof mockRconService.getStatus>
      ).mockResolvedValue(mockStatus)
      ;(
        mockPlayerResolver.getOrCreatePlayer as MockedFunction<
          typeof mockPlayerResolver.getOrCreatePlayer
        >
      )
        .mockResolvedValueOnce(100) // Real player
        .mockResolvedValueOnce(101) // Bot player
      mockSessionRepository.createSession.mockResolvedValue({})
      mockSessionRepository.deleteServerSessions.mockResolvedValue(0)

      const result = await service.synchronizeServerSessions(serverId)

      // Should create sessions for both real player and bot
      expect(mockSessionRepository.createSession).toHaveBeenCalledTimes(2)

      expect(mockSessionRepository.createSession).toHaveBeenNthCalledWith(1, {
        serverId,
        gameUserId: 2,
        databasePlayerId: 100,
        steamId: "STEAM_0:1:12345",
        playerName: "RealPlayer",
        isBot: false,
      })

      expect(mockSessionRepository.createSession).toHaveBeenNthCalledWith(2, {
        serverId,
        gameUserId: 3,
        databasePlayerId: 101,
        steamId: "BOT",
        playerName: "BotPlayer",
        isBot: true,
      })

      expect(result).toBe(2) // Both sessions created
    })
  })

  describe("convertToGameUserIds", () => {
    it("should convert database IDs to game user IDs and filter bots", async () => {
      const serverId = 1
      const playerIds = [100, 101, 102]

      // Mock server sessions for batch lookup
      mockSessionRepository.getServerSessions.mockResolvedValue([
        {
          gameUserId: 2,
          databasePlayerId: 100,
          isBot: false,
          playerName: "RealPlayer1",
          serverId: 1,
          steamId: "STEAM_0:1:100",
          connectedAt: new Date(),
          lastSeen: new Date(),
        },
        {
          gameUserId: 3,
          databasePlayerId: 101,
          isBot: true, // This should be filtered out
          playerName: "BotPlayer",
          serverId: 1,
          steamId: "BOT",
          connectedAt: new Date(),
          lastSeen: new Date(),
        },
        {
          gameUserId: 4,
          databasePlayerId: 102,
          isBot: false,
          playerName: "RealPlayer2",
          serverId: 1,
          steamId: "STEAM_0:1:102",
          connectedAt: new Date(),
          lastSeen: new Date(),
        },
      ])

      const result = await service.convertToGameUserIds(serverId, playerIds)

      expect(result).toEqual([2, 4]) // Bot filtered out
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Skipping bot BotPlayer (database ID: 101) for private message",
      )
    })

    it("should handle missing sessions gracefully", async () => {
      const serverId = 1
      const playerIds = [100, 999] // 999 doesn't exist

      // Mock server sessions with only one player
      mockSessionRepository.getServerSessions.mockResolvedValue([
        {
          gameUserId: 2,
          databasePlayerId: 100,
          isBot: false,
          playerName: "RealPlayer",
          serverId: 1,
          steamId: "STEAM_0:1:100",
          connectedAt: new Date(),
          lastSeen: new Date(),
        },
        // Player 999 is missing from sessions
      ])

      const result = await service.convertToGameUserIds(serverId, playerIds)

      expect(result).toEqual([2])
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "No session found for database player ID 999 on server 1 - attempting fallback session creation",
      )
    })
  })

  describe("canSendPrivateMessage", () => {
    it("should return true for real players", async () => {
      const serverId = 1
      const playerId = 100

      mockSessionRepository.getSessionByPlayerId.mockResolvedValue({
        gameUserId: 2,
        databasePlayerId: 100,
        isBot: false,
        playerName: "RealPlayer",
      })

      const result = await service.canSendPrivateMessage(serverId, playerId)

      expect(result).toBe(true)
    })

    it("should return false for bots", async () => {
      const serverId = 1
      const playerId = 101

      mockSessionRepository.getSessionByPlayerId.mockResolvedValue({
        gameUserId: 3,
        databasePlayerId: 101,
        isBot: true,
        playerName: "BotPlayer",
      })

      const result = await service.canSendPrivateMessage(serverId, playerId)

      expect(result).toBe(false)
      expect(mockLogger.debug).toHaveBeenCalledWith("Cannot send private message to bot BotPlayer")
    })

    it("should return false for missing sessions", async () => {
      const serverId = 1
      const playerId = 999

      mockSessionRepository.getSessionByPlayerId.mockResolvedValue(null)
      // Mock the fallback session creation to return null (no fallback available)
      ;(
        mockPlayerRepository.findById as MockedFunction<typeof mockPlayerRepository.findById>
      ).mockResolvedValue(null)

      const result = await service.canSendPrivateMessage(serverId, playerId)

      expect(result).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `No session found for database player ID ${playerId} on server ${serverId}`,
      )
    })

    it("should return true when fallback session creation succeeds for a non-bot", async () => {
      const serverId = 1
      const playerId = 200

      mockSessionRepository.getSessionByPlayerId.mockResolvedValue(null)
      mockSessionRepository.getServerSessions.mockResolvedValue([])

      // Fallback path: player found in DB with uniqueIds
      ;(
        mockPlayerRepository.findById as MockedFunction<typeof mockPlayerRepository.findById>
      ).mockResolvedValue({
        playerId: 200,
        lastName: "FallbackPlayer",
        uniqueIds: [{ uniqueId: "STEAM_0:1:99999", game: "cstrike" }],
      } as unknown as ReturnType<typeof mockPlayerRepository.findById> extends Promise<infer U>
        ? U
        : never)
      ;(
        mockRconService.isConnected as MockedFunction<typeof mockRconService.isConnected>
      ).mockReturnValue(false)
      ;(
        mockRconService.connect as MockedFunction<typeof mockRconService.connect>
      ).mockResolvedValue(undefined)
      ;(
        mockRconService.getStatus as MockedFunction<typeof mockRconService.getStatus>
      ).mockResolvedValue({
        map: "de_dust2",
        players: 1,
        maxPlayers: 32,
        uptime: 3600,
        fps: 100,
        timestamp: new Date(),
        playerList: [
          {
            name: "FallbackPlayer",
            userid: 5,
            uniqueid: "STEAM_0:1:99999",
            isBot: false,
            frag: 0,
            time: "01:00",
            ping: 40,
            loss: 0,
          },
        ],
      })

      const fallbackSession = {
        serverId,
        gameUserId: 5,
        databasePlayerId: 200,
        steamId: "STEAM_0:1:99999",
        playerName: "FallbackPlayer",
        isBot: false,
        connectedAt: new Date(),
        lastSeen: new Date(),
      }
      mockSessionRepository.createSession.mockResolvedValue(fallbackSession)

      const result = await service.canSendPrivateMessage(serverId, playerId)

      expect(result).toBe(true)
    })

    it("should return false when fallback session creation succeeds but player is a bot", async () => {
      const serverId = 1
      const playerId = 201

      mockSessionRepository.getSessionByPlayerId.mockResolvedValue(null)
      mockSessionRepository.getServerSessions.mockResolvedValue([])
      ;(
        mockPlayerRepository.findById as MockedFunction<typeof mockPlayerRepository.findById>
      ).mockResolvedValue({
        playerId: 201,
        lastName: "BotFallback",
        uniqueIds: [{ uniqueId: "BOT_1_BotFallback", game: "cstrike" }],
      } as unknown as ReturnType<typeof mockPlayerRepository.findById> extends Promise<infer U>
        ? U
        : never)
      ;(
        mockRconService.isConnected as MockedFunction<typeof mockRconService.isConnected>
      ).mockReturnValue(true) // Already connected – no connect call
      ;(
        mockRconService.getStatus as MockedFunction<typeof mockRconService.getStatus>
      ).mockResolvedValue({
        map: "de_dust2",
        players: 1,
        maxPlayers: 32,
        uptime: 3600,
        fps: 100,
        timestamp: new Date(),
        playerList: [
          {
            name: "BotFallback",
            userid: 6,
            uniqueid: "BOT_1_BotFallback",
            isBot: true,
            frag: 0,
            time: "00:30",
            ping: 0,
            loss: 0,
          },
        ],
      })

      const fallbackBotSession = {
        serverId,
        gameUserId: 6,
        databasePlayerId: 201,
        steamId: "BOT_1_BotFallback",
        playerName: "BotFallback",
        isBot: true,
        connectedAt: new Date(),
        lastSeen: new Date(),
      }
      mockSessionRepository.createSession.mockResolvedValue(fallbackBotSession)

      const result = await service.canSendPrivateMessage(serverId, playerId)

      expect(result).toBe(false)
    })
  })

  describe("synchronizeServerSessions – additional branches", () => {
    it("should NOT call clearServerSessions when clearExisting is false", async () => {
      const serverId = 1

      ;(
        mockServerService.getServerConfigBoolean as MockedFunction<
          typeof mockServerService.getServerConfigBoolean
        >
      ).mockResolvedValue(false)
      ;(
        mockRconService.isConnected as MockedFunction<typeof mockRconService.isConnected>
      ).mockReturnValue(true)
      ;(
        mockRconService.getStatus as MockedFunction<typeof mockRconService.getStatus>
      ).mockResolvedValue({
        map: "de_dust2",
        players: 0,
        maxPlayers: 32,
        uptime: 3600,
        fps: 100,
        timestamp: new Date(),
        playerList: [],
      })

      await service.synchronizeServerSessions(serverId, { clearExisting: false })

      expect(mockSessionRepository.deleteServerSessions).not.toHaveBeenCalled()
    })

    it("should force ignoreBots=false when respectIgnoreBots is false", async () => {
      const serverId = 1
      const mockPlayerList: PlayerInfo[] = [
        {
          name: "BotPlayer",
          userid: 3,
          uniqueid: "BOT",
          isBot: true,
          frag: 5,
          time: "03:15",
          ping: 0,
          loss: 0,
        },
      ]

      ;(
        mockRconService.isConnected as MockedFunction<typeof mockRconService.isConnected>
      ).mockReturnValue(true)
      ;(
        mockRconService.getStatus as MockedFunction<typeof mockRconService.getStatus>
      ).mockResolvedValue({
        map: "de_dust2",
        players: 1,
        maxPlayers: 32,
        uptime: 3600,
        fps: 100,
        timestamp: new Date(),
        playerList: mockPlayerList,
      })
      ;(
        mockPlayerResolver.getOrCreatePlayer as MockedFunction<
          typeof mockPlayerResolver.getOrCreatePlayer
        >
      ).mockResolvedValue(101)
      mockSessionRepository.createSession.mockResolvedValue({})
      mockSessionRepository.deleteServerSessions.mockResolvedValue(0)

      // respectIgnoreBots=false means getServerConfigBoolean should NOT be called
      const result = await service.synchronizeServerSessions(serverId, { respectIgnoreBots: false })

      // Bot must be included because ignoreBots is forced to false
      expect(mockServerService.getServerConfigBoolean).not.toHaveBeenCalled()
      expect(mockSessionRepository.createSession).toHaveBeenCalledTimes(1)
      expect(result).toBe(1)
    })

    it("should NOT call connect when RCON is already connected", async () => {
      const serverId = 1

      ;(
        mockServerService.getServerConfigBoolean as MockedFunction<
          typeof mockServerService.getServerConfigBoolean
        >
      ).mockResolvedValue(false)
      ;(
        mockRconService.isConnected as MockedFunction<typeof mockRconService.isConnected>
      ).mockReturnValue(true)
      ;(
        mockRconService.getStatus as MockedFunction<typeof mockRconService.getStatus>
      ).mockResolvedValue({
        map: "de_dust2",
        players: 0,
        maxPlayers: 32,
        uptime: 3600,
        fps: 100,
        timestamp: new Date(),
        playerList: [],
      })
      mockSessionRepository.deleteServerSessions.mockResolvedValue(0)

      await service.synchronizeServerSessions(serverId)

      expect(mockRconService.connect).not.toHaveBeenCalled()
    })

    it("should increment errors count, log error, and continue when getOrCreatePlayer throws", async () => {
      const serverId = 1
      const mockPlayerList: PlayerInfo[] = [
        {
          name: "ErrorPlayer",
          userid: 2,
          uniqueid: "STEAM_0:1:11111",
          isBot: false,
          frag: 0,
          time: "01:00",
          ping: 50,
          loss: 0,
        },
        {
          name: "GoodPlayer",
          userid: 3,
          uniqueid: "STEAM_0:1:22222",
          isBot: false,
          frag: 0,
          time: "01:00",
          ping: 50,
          loss: 0,
        },
      ]

      ;(
        mockServerService.getServerConfigBoolean as MockedFunction<
          typeof mockServerService.getServerConfigBoolean
        >
      ).mockResolvedValue(false)
      ;(
        mockRconService.isConnected as MockedFunction<typeof mockRconService.isConnected>
      ).mockReturnValue(true)
      ;(
        mockRconService.getStatus as MockedFunction<typeof mockRconService.getStatus>
      ).mockResolvedValue({
        map: "de_dust2",
        players: 2,
        maxPlayers: 32,
        uptime: 3600,
        fps: 100,
        timestamp: new Date(),
        playerList: mockPlayerList,
      })
      ;(
        mockPlayerResolver.getOrCreatePlayer as MockedFunction<
          typeof mockPlayerResolver.getOrCreatePlayer
        >
      )
        .mockRejectedValueOnce(new Error("DB connection failed")) // First player throws
        .mockResolvedValueOnce(102) // Second player succeeds
      mockSessionRepository.createSession.mockResolvedValue({})
      mockSessionRepository.deleteServerSessions.mockResolvedValue(0)

      const result = await service.synchronizeServerSessions(serverId)

      // Only the second player's session created; first one errored
      expect(result).toBe(1)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create session for player ErrorPlayer"),
      )
    })

    it("should generate a unique BOT steamId when IgnoreBots=false and uniqueid is BOT", async () => {
      const serverId = 1
      const mockPlayerList: PlayerInfo[] = [
        {
          name: "AutoBot",
          userid: 7,
          uniqueid: "BOT",
          isBot: true,
          frag: 3,
          time: "02:00",
          ping: 0,
          loss: 0,
        },
      ]

      ;(
        mockServerService.getServerConfigBoolean as MockedFunction<
          typeof mockServerService.getServerConfigBoolean
        >
      ).mockResolvedValue(false)
      ;(
        mockRconService.isConnected as MockedFunction<typeof mockRconService.isConnected>
      ).mockReturnValue(true)
      ;(
        mockRconService.getStatus as MockedFunction<typeof mockRconService.getStatus>
      ).mockResolvedValue({
        map: "de_dust2",
        players: 1,
        maxPlayers: 32,
        uptime: 3600,
        fps: 100,
        timestamp: new Date(),
        playerList: mockPlayerList,
      })
      ;(
        mockPlayerResolver.getOrCreatePlayer as MockedFunction<
          typeof mockPlayerResolver.getOrCreatePlayer
        >
      ).mockResolvedValue(103)
      mockSessionRepository.createSession.mockResolvedValue({})
      mockSessionRepository.deleteServerSessions.mockResolvedValue(0)

      await service.synchronizeServerSessions(serverId)

      // getOrCreatePlayer should be called with a sanitized unique ID, not raw "BOT"
      expect(mockPlayerResolver.getOrCreatePlayer).toHaveBeenCalledWith(
        expect.stringMatching(/^BOT_1_/),
        "AutoBot",
        expect.any(String),
        serverId,
      )

      // createSession should still use the original "BOT" as steamId (stored as-is from playerInfo.uniqueid)
      expect(mockSessionRepository.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          isBot: true,
          gameUserId: 7,
          playerName: "AutoBot",
          serverId,
        }),
      )
    })
  })

  describe("convertToGameUserIds – fallback session branch", () => {
    it("should include gameUserId from a successful fallback session for a non-bot", async () => {
      const serverId = 1
      const playerIds = [300]

      // No sessions in store → triggers fallback
      mockSessionRepository.getServerSessions.mockResolvedValue([])

      // Fallback: player found in DB
      ;(
        mockPlayerRepository.findById as MockedFunction<typeof mockPlayerRepository.findById>
      ).mockResolvedValue({
        playerId: 300,
        lastName: "FallbackUser",
        uniqueIds: [{ uniqueId: "STEAM_0:1:55555", game: "cstrike" }],
      } as unknown as ReturnType<typeof mockPlayerRepository.findById> extends Promise<infer U>
        ? U
        : never)
      ;(
        mockRconService.isConnected as MockedFunction<typeof mockRconService.isConnected>
      ).mockReturnValue(false)
      ;(
        mockRconService.connect as MockedFunction<typeof mockRconService.connect>
      ).mockResolvedValue(undefined)
      ;(
        mockRconService.getStatus as MockedFunction<typeof mockRconService.getStatus>
      ).mockResolvedValue({
        map: "de_dust2",
        players: 1,
        maxPlayers: 32,
        uptime: 3600,
        fps: 100,
        timestamp: new Date(),
        playerList: [
          {
            name: "FallbackUser",
            userid: 8,
            uniqueid: "STEAM_0:1:55555",
            isBot: false,
            frag: 0,
            time: "00:30",
            ping: 30,
            loss: 0,
          },
        ],
      })

      mockSessionRepository.createSession.mockResolvedValue({
        serverId,
        gameUserId: 8,
        databasePlayerId: 300,
        steamId: "STEAM_0:1:55555",
        playerName: "FallbackUser",
        isBot: false,
        connectedAt: new Date(),
        lastSeen: new Date(),
      })

      const result = await service.convertToGameUserIds(serverId, playerIds)

      expect(result).toContain(8)
    })

    it("should NOT include gameUserId from a fallback session when the player is a bot", async () => {
      const serverId = 1
      const playerIds = [301]

      mockSessionRepository.getServerSessions.mockResolvedValue([])
      ;(
        mockPlayerRepository.findById as MockedFunction<typeof mockPlayerRepository.findById>
      ).mockResolvedValue({
        playerId: 301,
        lastName: "BotFallback2",
        uniqueIds: [{ uniqueId: "BOT_1_BotFallback2", game: "cstrike" }],
      } as unknown as ReturnType<typeof mockPlayerRepository.findById> extends Promise<infer U>
        ? U
        : never)
      ;(
        mockRconService.isConnected as MockedFunction<typeof mockRconService.isConnected>
      ).mockReturnValue(true)
      ;(
        mockRconService.getStatus as MockedFunction<typeof mockRconService.getStatus>
      ).mockResolvedValue({
        map: "de_dust2",
        players: 1,
        maxPlayers: 32,
        uptime: 3600,
        fps: 100,
        timestamp: new Date(),
        playerList: [
          {
            name: "BotFallback2",
            userid: 9,
            uniqueid: "BOT_1_BotFallback2",
            isBot: true,
            frag: 0,
            time: "00:15",
            ping: 0,
            loss: 0,
          },
        ],
      })

      mockSessionRepository.createSession.mockResolvedValue({
        serverId,
        gameUserId: 9,
        databasePlayerId: 301,
        steamId: "BOT_1_BotFallback2",
        playerName: "BotFallback2",
        isBot: true,
        connectedAt: new Date(),
        lastSeen: new Date(),
      })

      const result = await service.convertToGameUserIds(serverId, playerIds)

      expect(result).not.toContain(9)
      expect(result).toHaveLength(0)
    })
  })

  describe("getSessionStats", () => {
    it("should return default empty stats when repository does not have getStats", async () => {
      // The default mockSessionRepository does not have getStats
      const result = await service.getSessionStats()

      expect(result).toEqual({
        totalSessions: 0,
        serverSessions: {},
        botSessions: 0,
        realPlayerSessions: 0,
      })
    })

    it("should return stats from repository when getStats is available", async () => {
      const mockStats = {
        totalSessions: 5,
        serverSessions: { 1: 3, 2: 2 },
        botSessions: 1,
        realPlayerSessions: 4,
      }

      const sessionRepoWithStats = {
        ...mockSessionRepository,
        getStats: vi.fn().mockResolvedValue(mockStats),
      }

      const serviceWithStats = new PlayerSessionService(
        sessionRepoWithStats,
        mockRconService,
        mockServerService,
        mockPlayerResolver,
        mockPlayerRepository,
        mockLogger,
      )

      const result = await serviceWithStats.getSessionStats()

      expect(result).toEqual(mockStats)
      expect(sessionRepoWithStats.getStats).toHaveBeenCalledTimes(1)
    })
  })

  describe("createFallbackSession – edge cases", () => {
    it("should return null and log when player not found in database", async () => {
      ;(
        mockPlayerRepository.findById as MockedFunction<typeof mockPlayerRepository.findById>
      ).mockResolvedValue(null)

      // Access via canSendPrivateMessage which internally calls createFallbackSession
      mockSessionRepository.getSessionByPlayerId.mockResolvedValue(null)
      mockSessionRepository.getServerSessions.mockResolvedValue([])

      const result = await service.canSendPrivateMessage(1, 404)

      expect(result).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Cannot create fallback session - player 404 not found"),
      )
    })

    it("should return null when RCON status has an empty player list", async () => {
      ;(
        mockPlayerRepository.findById as MockedFunction<typeof mockPlayerRepository.findById>
      ).mockResolvedValue({
        playerId: 405,
        lastName: "GhostPlayer",
        uniqueIds: [{ uniqueId: "STEAM_0:1:40500", game: "cstrike" }],
      } as unknown as ReturnType<typeof mockPlayerRepository.findById> extends Promise<infer U>
        ? U
        : never)
      ;(
        mockRconService.isConnected as MockedFunction<typeof mockRconService.isConnected>
      ).mockReturnValue(true)
      ;(
        mockRconService.getStatus as MockedFunction<typeof mockRconService.getStatus>
      ).mockResolvedValue({
        map: "de_dust2",
        players: 0,
        maxPlayers: 32,
        uptime: 3600,
        fps: 100,
        timestamp: new Date(),
        playerList: [],
      })

      mockSessionRepository.getSessionByPlayerId.mockResolvedValue(null)
      mockSessionRepository.getServerSessions.mockResolvedValue([])

      const result = await service.canSendPrivateMessage(1, 405)

      expect(result).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "No players in RCON status for fallback session creation",
      )
    })

    it("should return null when no matching player in RCON status", async () => {
      ;(
        mockPlayerRepository.findById as MockedFunction<typeof mockPlayerRepository.findById>
      ).mockResolvedValue({
        playerId: 406,
        lastName: "NoMatchPlayer",
        uniqueIds: [{ uniqueId: "STEAM_0:1:40600", game: "cstrike" }],
      } as unknown as ReturnType<typeof mockPlayerRepository.findById> extends Promise<infer U>
        ? U
        : never)
      ;(
        mockRconService.isConnected as MockedFunction<typeof mockRconService.isConnected>
      ).mockReturnValue(true)
      ;(
        mockRconService.getStatus as MockedFunction<typeof mockRconService.getStatus>
      ).mockResolvedValue({
        map: "de_dust2",
        players: 1,
        maxPlayers: 32,
        uptime: 3600,
        fps: 100,
        timestamp: new Date(),
        playerList: [
          {
            name: "SomeOtherPlayer",
            userid: 10,
            uniqueid: "STEAM_0:1:99999",
            isBot: false,
            frag: 0,
            time: "01:00",
            ping: 20,
            loss: 0,
          },
        ],
      })

      mockSessionRepository.getSessionByPlayerId.mockResolvedValue(null)
      mockSessionRepository.getServerSessions.mockResolvedValue([])

      const result = await service.canSendPrivateMessage(1, 406)

      expect(result).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("not found in RCON status"),
      )
    })

    it("should return null and log error when an exception is thrown during fallback creation", async () => {
      ;(
        mockPlayerRepository.findById as MockedFunction<typeof mockPlayerRepository.findById>
      ).mockRejectedValue(new Error("Unexpected DB error"))

      mockSessionRepository.getSessionByPlayerId.mockResolvedValue(null)
      mockSessionRepository.getServerSessions.mockResolvedValue([])

      const result = await service.canSendPrivateMessage(1, 407)

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create fallback session for player 407"),
        expect.any(Object),
      )
    })
  })

  describe("simple pass-through methods", () => {
    it("updateSession should delegate to repository", async () => {
      const expected = {
        serverId: 1,
        gameUserId: 2,
        databasePlayerId: 100,
        steamId: "STEAM_0:1:12345",
        playerName: "UpdatedName",
        isBot: false,
        connectedAt: new Date(),
        lastSeen: new Date(),
      }
      mockSessionRepository.updateSession.mockResolvedValue(expected)

      const result = await service.updateSession(1, 2, { playerName: "UpdatedName" })

      expect(mockSessionRepository.updateSession).toHaveBeenCalledWith(1, 2, {
        playerName: "UpdatedName",
      })
      expect(result).toBe(expected)
    })

    it("removeSession should delegate to repository", async () => {
      mockSessionRepository.deleteSession.mockResolvedValue(true)

      const result = await service.removeSession(1, 2)

      expect(mockSessionRepository.deleteSession).toHaveBeenCalledWith(1, 2)
      expect(result).toBe(true)
    })

    it("clearServerSessions should delegate to repository", async () => {
      mockSessionRepository.deleteServerSessions.mockResolvedValue(3)

      const result = await service.clearServerSessions(1)

      expect(mockSessionRepository.deleteServerSessions).toHaveBeenCalledWith(1)
      expect(result).toBe(3)
    })

    it("getSessionByGameUserId should delegate to repository", async () => {
      const session = {
        serverId: 1,
        gameUserId: 2,
        databasePlayerId: 100,
        steamId: "STEAM_0:1:12345",
        playerName: "TestPlayer",
        isBot: false,
        connectedAt: new Date(),
        lastSeen: new Date(),
      }
      mockSessionRepository.getSessionByGameUserId.mockResolvedValue(session)

      const result = await service.getSessionByGameUserId(1, 2)

      expect(mockSessionRepository.getSessionByGameUserId).toHaveBeenCalledWith(1, 2)
      expect(result).toBe(session)
    })

    it("getSessionByPlayerId should delegate to repository", async () => {
      const session = {
        serverId: 1,
        gameUserId: 2,
        databasePlayerId: 100,
        steamId: "STEAM_0:1:12345",
        playerName: "TestPlayer",
        isBot: false,
        connectedAt: new Date(),
        lastSeen: new Date(),
      }
      mockSessionRepository.getSessionByPlayerId.mockResolvedValue(session)

      const result = await service.getSessionByPlayerId(1, 100)

      expect(mockSessionRepository.getSessionByPlayerId).toHaveBeenCalledWith(1, 100)
      expect(result).toBe(session)
    })

    it("getSessionBySteamId should delegate to repository", async () => {
      const session = {
        serverId: 1,
        gameUserId: 2,
        databasePlayerId: 100,
        steamId: "STEAM_0:1:12345",
        playerName: "TestPlayer",
        isBot: false,
        connectedAt: new Date(),
        lastSeen: new Date(),
      }
      mockSessionRepository.getSessionBySteamId.mockResolvedValue(session)

      const result = await service.getSessionBySteamId(1, "STEAM_0:1:12345")

      expect(mockSessionRepository.getSessionBySteamId).toHaveBeenCalledWith(1, "STEAM_0:1:12345")
      expect(result).toBe(session)
    })

    it("getServerSessions should delegate to repository", async () => {
      const sessions = [
        {
          serverId: 1,
          gameUserId: 2,
          databasePlayerId: 100,
          steamId: "STEAM_0:1:12345",
          playerName: "TestPlayer",
          isBot: false,
          connectedAt: new Date(),
          lastSeen: new Date(),
        },
      ]
      mockSessionRepository.getServerSessions.mockResolvedValue(sessions)

      const result = await service.getServerSessions(1)

      expect(mockSessionRepository.getServerSessions).toHaveBeenCalledWith(1)
      expect(result).toBe(sessions)
    })
  })
})
