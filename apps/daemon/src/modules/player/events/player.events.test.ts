/**
 * PlayerEventHandler Unit Tests
 */

import type { IServerService } from "@/modules/server/server.types"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { IPlayerService } from "../types/player.types"
import { PlayerEventHandler } from "./player.events"

// Create mock services
const createMockPlayerService = (): IPlayerService => ({
  getOrCreatePlayer: vi.fn().mockResolvedValue(123),
  getPlayerStats: vi.fn(),
  updatePlayerStats: vi.fn(),
  getPlayerRating: vi.fn(),
  updatePlayerRatings: vi.fn(),
  handlePlayerEvent: vi.fn(),
  getPlayerStatsBatch: vi.fn().mockResolvedValue(new Map()),
  updatePlayerStatsBatch: vi.fn().mockResolvedValue(undefined),
})

const createMockServerService = (): IServerService => ({
  findById: vi.fn(),
  getServer: vi.fn(),
  getServerByAddress: vi.fn(),
  getServerGame: vi.fn().mockResolvedValue("csgo"),
  getServerConfigBoolean: vi.fn().mockResolvedValue(false),
  hasRconCredentials: vi.fn().mockResolvedValue(false),
  findActiveServersWithRcon: vi.fn().mockResolvedValue([]),
  findServersByIds: vi.fn().mockResolvedValue([]),
  findAllServersWithRcon: vi.fn().mockResolvedValue([]),
  handleServerShutdown: vi.fn(),
  handleStatsUpdate: vi.fn(),
  handleAdminAction: vi.fn(),
  getServerConfig: vi.fn().mockResolvedValue(""),
  getServerModType: vi.fn().mockResolvedValue(""),
})

describe("PlayerEventHandler", () => {
  let handler: PlayerEventHandler
  let logger: ReturnType<typeof createMockLogger>
  let playerService: IPlayerService
  let serverService: IServerService

  beforeEach(() => {
    logger = createMockLogger()
    playerService = createMockPlayerService()
    serverService = createMockServerService()

    handler = new PlayerEventHandler(logger, playerService, serverService)
  })

  afterEach(() => {
    handler.destroy()
  })

  describe("Handler Instantiation", () => {
    it("should create handler instance successfully", () => {
      expect(handler).toBeDefined()
      expect(handler).toBeInstanceOf(PlayerEventHandler)
    })

    it("should extend BaseModuleEventHandler", () => {
      expect(handler).toBeDefined()
      expect(typeof handler.handleEvent).toBe("function")
      expect(typeof handler.destroy).toBe("function")
    })
  })

  describe("Queue Infrastructure Compatibility", () => {
    it("should be compatible with the new queue infrastructure", () => {
      // The handler should have the handleEvent method required by queue processors
      expect(typeof handler.handleEvent).toBe("function")
      expect(handler.handleEvent).toBeDefined()
    })

    it("should provide proper cleanup", () => {
      // Should not throw when destroyed
      expect(() => handler.destroy()).not.toThrow()

      expect(logger.debug).toHaveBeenCalledWith(
        "PlayerEventHandler cleanup completed (queue-only processing)",
      )
    })
  })

  describe("handleEvent method", () => {
    it("should handle CHAT_MESSAGE events", async () => {
      const event: BaseEvent = {
        eventType: EventType.CHAT_MESSAGE,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-event-id",
        data: {},
        meta: {
          steamId: "STEAM_1:0:123456",
          playerName: "TestPlayer",
        },
      }

      await handler.handleEvent(event)

      expect(playerService.getOrCreatePlayer).toHaveBeenCalledWith(
        "STEAM_1:0:123456",
        "TestPlayer",
        "csgo",
        1,
      )
      expect(playerService.handlePlayerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.CHAT_MESSAGE,
          data: expect.objectContaining({
            playerId: 123,
          }),
        }),
      )
    })

    it("should handle PLAYER_KILL events with dual player resolution", async () => {
      const mockGetOrCreatePlayer = vi.mocked(playerService.getOrCreatePlayer)
      mockGetOrCreatePlayer.mockResolvedValueOnce(456) // killer
      mockGetOrCreatePlayer.mockResolvedValueOnce(789) // victim

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-kill-event",
        data: {
          killerId: 10, // raw slot ID
          victimId: 20, // raw slot ID
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
        meta: {
          killer: {
            steamId: "STEAM_1:0:111111",
            playerName: "KillerPlayer",
            isBot: false,
          },
          victim: {
            steamId: "STEAM_1:0:222222",
            playerName: "VictimPlayer",
            isBot: false,
          },
        },
      }

      await handler.handleEvent(event)

      // Should resolve both killer and victim
      expect(playerService.getOrCreatePlayer).toHaveBeenCalledTimes(2)
      expect(playerService.getOrCreatePlayer).toHaveBeenNthCalledWith(
        1,
        "STEAM_1:0:111111",
        "KillerPlayer",
        "csgo",
        1,
      )
      expect(playerService.getOrCreatePlayer).toHaveBeenNthCalledWith(
        2,
        "STEAM_1:0:222222",
        "VictimPlayer",
        "csgo",
        1,
      )

      // Should call handlePlayerEvent with resolved database IDs
      expect(playerService.handlePlayerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_KILL,
          data: expect.objectContaining({
            killerId: 456, // resolved DB ID
            victimId: 789, // resolved DB ID
            weapon: "ak47",
            headshot: false,
          }),
        }),
      )
    })

    it("should handle BOT players in PLAYER_KILL events", async () => {
      const mockGetOrCreatePlayer = vi.mocked(playerService.getOrCreatePlayer)
      mockGetOrCreatePlayer.mockResolvedValueOnce(100) // bot killer
      mockGetOrCreatePlayer.mockResolvedValueOnce(200) // bot victim

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-bot-kill",
        data: {
          killerId: 5,
          victimId: 15,
          weapon: "m4a1",
          headshot: true,
          killerTeam: "CT",
          victimTeam: "TERRORIST",
        },
        meta: {
          killer: {
            steamId: "BOT",
            playerName: "Bot Mike",
            isBot: true,
          },
          victim: {
            steamId: "BOT",
            playerName: "Bot Alice",
            isBot: true,
          },
        },
      }

      await handler.handleEvent(event)

      expect(playerService.getOrCreatePlayer).toHaveBeenCalledWith("BOT", "Bot Mike", "csgo", 1)
      expect(playerService.getOrCreatePlayer).toHaveBeenCalledWith("BOT", "Bot Alice", "csgo", 1)
      expect(playerService.handlePlayerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            killerId: 100,
            victimId: 200,
            headshot: true,
          }),
        }),
      )
    })

    it("should handle PLAYER_KILL events with missing meta gracefully", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-missing-meta",
        data: {
          killerId: 10,
          victimId: 20,
          weapon: "ak47",
          headshot: false,
        },
        // missing meta
      }

      await handler.handleEvent(event)

      // Should not try to resolve players
      expect(playerService.getOrCreatePlayer).not.toHaveBeenCalled()

      // Should still call handlePlayerEvent with original data
      expect(playerService.handlePlayerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_KILL,
          data: expect.objectContaining({
            killerId: 10, // unchanged raw ID
            victimId: 20, // unchanged raw ID
          }),
        }),
      )

      expect(logger.error).toHaveBeenCalledWith(
        "Missing meta data for PLAYER_KILL event",
        expect.objectContaining({ eventId: "test-missing-meta" }),
      )
    })

    it("should handle events without meta gracefully", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-no-meta",
        data: {},
        // no meta
      }

      await handler.handleEvent(event)

      expect(playerService.handlePlayerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            playerId: 0,
          }),
        }),
      )
    })

    it("should ignore bot PLAYER_CONNECT when IgnoreBots is enabled", async () => {
      vi.mocked(serverService.getServerConfigBoolean).mockResolvedValue(true)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        eventId: "bot-connect",
        data: {},
        meta: {
          steamId: "BOT",
          playerName: "Bot Mike",
          isBot: true,
        },
      }

      await handler.handleEvent(event)

      expect(serverService.getServerConfigBoolean).toHaveBeenCalledWith(1, "IgnoreBots", true)
      expect(playerService.handlePlayerEvent).not.toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("Ignoring bot"))
    })

    it("should process bot PLAYER_CONNECT when IgnoreBots is disabled", async () => {
      vi.mocked(serverService.getServerConfigBoolean).mockResolvedValue(false)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        eventId: "bot-connect-allowed",
        data: {},
        meta: {
          steamId: "BOT",
          playerName: "Bot Mike",
          isBot: true,
        },
      }

      await handler.handleEvent(event)

      expect(playerService.handlePlayerEvent).toHaveBeenCalled()
    })

    it("should ignore bot PLAYER_DISCONNECT when IgnoreBots is enabled", async () => {
      vi.mocked(serverService.getServerConfigBoolean).mockResolvedValue(true)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 1,
        eventId: "bot-disconnect",
        data: {},
        meta: { steamId: "BOT", playerName: "Bot Alice", isBot: true },
      }

      await handler.handleEvent(event)
      expect(playerService.handlePlayerEvent).not.toHaveBeenCalled()
    })

    it("should ignore bot PLAYER_ENTRY when IgnoreBots is enabled", async () => {
      vi.mocked(serverService.getServerConfigBoolean).mockResolvedValue(true)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_ENTRY,
        timestamp: new Date(),
        serverId: 1,
        eventId: "bot-entry",
        data: {},
        meta: { steamId: "BOT", playerName: "Bot Alice", isBot: true },
      }

      await handler.handleEvent(event)
      expect(playerService.handlePlayerEvent).not.toHaveBeenCalled()
    })

    it("should not check IgnoreBots for non-lifecycle events (like CHAT_MESSAGE)", async () => {
      const event: BaseEvent = {
        eventType: EventType.CHAT_MESSAGE,
        timestamp: new Date(),
        serverId: 1,
        eventId: "bot-chat",
        data: {},
        meta: { steamId: "BOT", playerName: "Bot Mike", isBot: true },
      }

      await handler.handleEvent(event)

      expect(serverService.getServerConfigBoolean).not.toHaveBeenCalled()
      expect(playerService.handlePlayerEvent).toHaveBeenCalled()
    })

    it("should not check IgnoreBots for non-bot players", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        eventId: "real-player-connect",
        data: {},
        meta: { steamId: "STEAM_1:0:123456", playerName: "RealPlayer", isBot: false },
      }

      await handler.handleEvent(event)

      expect(serverService.getServerConfigBoolean).not.toHaveBeenCalled()
      expect(playerService.handlePlayerEvent).toHaveBeenCalled()
    })

    it("should handle PLAYER_DAMAGE events with dual player resolution", async () => {
      vi.mocked(playerService.getOrCreatePlayer)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(200)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_DAMAGE,
        timestamp: new Date(),
        serverId: 1,
        eventId: "damage-event",
        data: { damage: 50, weapon: "ak47" },
        meta: {
          killer: { steamId: "STEAM_1:0:111", playerName: "Attacker", isBot: false },
          victim: { steamId: "STEAM_1:0:222", playerName: "Victim", isBot: false },
        },
      }

      await handler.handleEvent(event)

      expect(playerService.handlePlayerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attackerId: 100,
            victimId: 200,
          }),
        }),
      )
    })

    it("should handle PLAYER_TEAMKILL events with dual player resolution", async () => {
      vi.mocked(playerService.getOrCreatePlayer)
        .mockResolvedValueOnce(300)
        .mockResolvedValueOnce(400)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_TEAMKILL,
        timestamp: new Date(),
        serverId: 1,
        eventId: "teamkill-event",
        data: { weapon: "awp" },
        meta: {
          killer: { steamId: "STEAM_1:0:333", playerName: "TKer", isBot: false },
          victim: { steamId: "STEAM_1:0:444", playerName: "Teammate", isBot: false },
        },
      }

      await handler.handleEvent(event)

      expect(playerService.handlePlayerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attackerId: 300,
            victimId: 400,
          }),
        }),
      )
    })

    it("should handle PLAYER_DAMAGE with missing meta gracefully", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_DAMAGE,
        timestamp: new Date(),
        serverId: 1,
        eventId: "damage-no-meta",
        data: { damage: 50 },
        meta: { killer: null, victim: null } as any,
      }

      await handler.handleEvent(event)

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Missing meta data"),
        expect.any(Object),
      )
      expect(playerService.handlePlayerEvent).toHaveBeenCalled()
    })

    it("should handle resolution errors in single player events", async () => {
      vi.mocked(playerService.getOrCreatePlayer).mockRejectedValue(new Error("DB error"))

      const event: BaseEvent = {
        eventType: EventType.CHAT_MESSAGE,
        timestamp: new Date(),
        serverId: 1,
        eventId: "error-event",
        data: {},
        meta: { steamId: "STEAM_1:0:123", playerName: "TestPlayer" },
      }

      await handler.handleEvent(event)

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to resolve player IDs"),
      )
      expect(playerService.handlePlayerEvent).toHaveBeenCalled()
    })

    it("should handle resolution errors in kill events", async () => {
      vi.mocked(playerService.getOrCreatePlayer).mockRejectedValue(new Error("DB error"))

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        eventId: "kill-error",
        data: { weapon: "ak47" },
        meta: {
          killer: { steamId: "STEAM_1:0:111", playerName: "K", isBot: false },
          victim: { steamId: "STEAM_1:0:222", playerName: "V", isBot: false },
        },
      }

      await handler.handleEvent(event)

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to resolve PLAYER_KILL"),
      )
    })

    it("should handle resolution errors in dual player events", async () => {
      vi.mocked(playerService.getOrCreatePlayer).mockRejectedValue(new Error("DB error"))

      const event: BaseEvent = {
        eventType: EventType.PLAYER_DAMAGE,
        timestamp: new Date(),
        serverId: 1,
        eventId: "damage-error",
        data: { damage: 50 },
        meta: {
          killer: { steamId: "STEAM_1:0:111", playerName: "A", isBot: false },
          victim: { steamId: "STEAM_1:0:222", playerName: "V", isBot: false },
        },
      }

      await handler.handleEvent(event)

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to resolve PLAYER_DAMAGE"),
      )
    })

    it("should handle single player event with meta but no steamId", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        eventId: "no-steamid",
        data: {},
        meta: { playerName: "Test" }, // no steamId
      }

      await handler.handleEvent(event)

      // Should not call getOrCreatePlayer without steamId
      expect(playerService.getOrCreatePlayer).not.toHaveBeenCalled()
      expect(playerService.handlePlayerEvent).toHaveBeenCalled()
    })
  })
})
