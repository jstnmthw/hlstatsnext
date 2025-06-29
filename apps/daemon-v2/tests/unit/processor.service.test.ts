import { describe, it, expect, vi, beforeEach } from "vitest"
import { EventProcessorService } from "../../src/services/processor/processor.service"
import { PlayerHandler } from "../../src/services/processor/handlers/player.handler"
import { WeaponHandler } from "../../src/services/processor/handlers/weapon.handler"
import { MatchHandler } from "../../src/services/processor/handlers/match.handler"
import { RankingHandler } from "../../src/services/processor/handlers/ranking.handler"
import { DatabaseClient } from "../../src/database/client"
import { EventService } from "../../src/services/event/event.service"
import { PlayerService } from "../../src/services/player/player.service"
import { WeaponService } from "../../src/services/weapon/weapon.service"
import { EventType, PlayerConnectEvent, PlayerKillEvent } from "../../src/types/common/events"

// Mock all dependencies
vi.mock("../../src/database/client")
vi.mock("../../src/services/event/event.service")
vi.mock("../../src/services/player/player.service")
vi.mock("../../src/services/weapon/weapon.service")
vi.mock("../../src/services/processor/handlers/player.handler")
vi.mock("../../src/services/processor/handlers/weapon.handler")
vi.mock("../../src/services/processor/handlers/match.handler")
vi.mock("../../src/services/processor/handlers/ranking.handler")

const MockedPlayerHandler = vi.mocked(PlayerHandler)
const MockedWeaponHandler = vi.mocked(WeaponHandler)
const MockedMatchHandler = vi.mocked(MatchHandler)
const MockedRankingHandler = vi.mocked(RankingHandler)
const MockedDatabaseClient = vi.mocked(DatabaseClient)
const MockedEventService = vi.mocked(EventService)
const MockedPlayerService = vi.mocked(PlayerService)
const MockedWeaponService = vi.mocked(WeaponService)

describe("EventProcessorService", () => {
  let processor: EventProcessorService

  beforeEach(() => {
    vi.clearAllMocks()
    processor = new EventProcessorService()
  })

  it("should instantiate all handlers in the constructor", () => {
    expect(MockedDatabaseClient).toHaveBeenCalledTimes(1)
    expect(MockedEventService).toHaveBeenCalledTimes(1)
    expect(MockedPlayerService).toHaveBeenCalledTimes(1)
    expect(MockedWeaponService).toHaveBeenCalledTimes(1)
    expect(MockedPlayerHandler).toHaveBeenCalledTimes(1)
    expect(MockedWeaponHandler).toHaveBeenCalledTimes(1)
    expect(MockedMatchHandler).toHaveBeenCalledTimes(1)
    expect(MockedRankingHandler).toHaveBeenCalledTimes(1)
  })

  describe("processEvent", () => {
    const mockKillEvent: PlayerKillEvent = {
      eventType: EventType.PLAYER_KILL,
      serverId: 1,
      timestamp: new Date(),
      data: {
        killerId: 1,
        victimId: 2,
        weapon: "ak47",
        headshot: false,
        killerTeam: "TERRORIST",
        victimTeam: "CT",
      },
      meta: {
        killer: {
          steamId: "STEAM_1:0:111",
          playerName: "Killer",
          isBot: false,
        },
        victim: {
          steamId: "STEAM_1:0:222",
          playerName: "Victim",
          isBot: false,
        },
      },
    }

    it("should persist event via EventService", async () => {
      const eventServiceInstance = MockedEventService.mock.instances[0]!
      const playerServiceInstance = MockedPlayerService.mock.instances[0]!

      vi.mocked(playerServiceInstance.getOrCreatePlayer)
        .mockResolvedValueOnce(1) // killer
        .mockResolvedValueOnce(2) // victim

      await processor.processEvent(mockKillEvent)

      expect(eventServiceInstance.createGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_KILL,
          data: expect.objectContaining({
            killerId: 1,
            victimId: 2,
          }),
        }),
      )

      // Handler invocations expected
      expect(MockedPlayerHandler.mock.instances[0]!.handleEvent).toHaveBeenCalledWith(mockKillEvent)
      expect(MockedWeaponHandler.mock.instances[0]!.handleEvent).toHaveBeenCalledWith(mockKillEvent)
      expect(MockedRankingHandler.mock.instances[0]!.handleEvent).toHaveBeenCalledWith(mockKillEvent)
    })

    it("should throw if the player service call fails", async () => {
      const playerServiceInstance = MockedPlayerService.mock.instances[0]!
      const dbError = new Error("DB Error")
      vi.mocked(playerServiceInstance.getOrCreatePlayer).mockRejectedValue(dbError)

      await expect(processor.processEvent(mockKillEvent)).rejects.toThrow(dbError)
    })
  })

  describe("Database Methods", () => {
    it("should call testConnection on the db instance", async () => {
      const dbInstance = MockedDatabaseClient.mock.instances[0]!
      await processor.testDatabaseConnection()
      expect(dbInstance.testConnection).toHaveBeenCalled()
    })

    it("should call disconnect on the db instance", async () => {
      const dbInstance = MockedDatabaseClient.mock.instances[0]!
      await processor.disconnect()
      expect(dbInstance.disconnect).toHaveBeenCalled()
    })
  })

  describe("EventProcessorService - bot gating", () => {
    const mockDb = {
      testConnection: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(undefined),
    } as unknown as DatabaseClient

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it("ignores bot events when logBots=false", async () => {
      const service = new EventProcessorService(mockDb, { logBots: false })

      const event: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        meta: { steamId: "BOT", playerName: "BotPlayer", isBot: true },
        data: {
          playerId: 0,
          steamId: "BOT",
          playerName: "BotPlayer",
          ipAddress: "0.0.0.0",
        },
      }

      await service.processEvent(event)

      // Should not call any service methods for bot events when logBots=false
      expect(MockedPlayerService.mock.instances[0]?.getOrCreatePlayer).not.toHaveBeenCalled()
      expect(MockedEventService.mock.instances[0]?.createGameEvent).not.toHaveBeenCalled()
    })

    it("processes bot events when logBots=true", async () => {
      const service = new EventProcessorService(mockDb, { logBots: true })

      const event: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        meta: { steamId: "BOT", playerName: "BotPlayer", isBot: true },
        data: {
          playerId: 0,
          steamId: "BOT",
          playerName: "BotPlayer",
          ipAddress: "0.0.0.0",
        },
      }

      await service.processEvent(event)

      expect(MockedPlayerService.mock.instances[0]?.getOrCreatePlayer).toHaveBeenCalledWith(
        "BOT",
        "BotPlayer",
        "cstrike",
      )
      expect(MockedEventService.mock.instances[0]?.createGameEvent).toHaveBeenCalled()
    })
  })
})
