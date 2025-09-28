/**
 * Player Session Service Tests
 *
 * Tests for player session management including bot handling
 * and ID conversion functionality.
 */

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest"
import { PlayerSessionService } from "./player-session.service"
import type { PlayerInfo, ServerStatus } from "@/modules/rcon/types/rcon.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockServerService } from "@/tests/mocks/server.service.mock"
import { createMockRconService } from "@/tests/mocks/rcon.service.mock"
import { createMockPlayerResolver } from "@/tests/mocks/player.service.mock"
import { createMockPlayerRepository } from "@/tests/mocks/player.repository.mock"

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
  })
})
