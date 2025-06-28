import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventProcessorService } from "../../src/services/processor/processor.service";
import { PlayerHandler } from "../../src/services/processor/handlers/player.handler";
import { WeaponHandler } from "../../src/services/processor/handlers/weapon.handler";
import { MatchHandler } from "../../src/services/processor/handlers/match.handler";
import { RankingHandler } from "../../src/services/processor/handlers/ranking.handler";
import { DatabaseClient } from "../../src/database/client";
import {
  EventType,
  PlayerKillEvent,
  PlayerConnectEvent,
  PlayerMeta,
} from "../../src/types/common/events";

// Mock all dependencies
vi.mock("../../src/database/client");
vi.mock("../../src/services/processor/handlers/player.handler");
vi.mock("../../src/services/processor/handlers/weapon.handler");
vi.mock("../../src/services/processor/handlers/match.handler");
vi.mock("../../src/services/processor/handlers/ranking.handler");

const MockedPlayerHandler = vi.mocked(PlayerHandler);
const MockedWeaponHandler = vi.mocked(WeaponHandler);
const MockedMatchHandler = vi.mocked(MatchHandler);
const MockedRankingHandler = vi.mocked(RankingHandler);
const MockedDatabaseClient = vi.mocked(DatabaseClient);

describe("EventProcessorService", () => {
  let processor: EventProcessorService;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new EventProcessorService();
  });

  it("should instantiate all handlers in the constructor", () => {
    expect(MockedDatabaseClient).toHaveBeenCalledTimes(1);
    expect(MockedPlayerHandler).toHaveBeenCalledTimes(1);
    expect(MockedWeaponHandler).toHaveBeenCalledTimes(1);
    expect(MockedMatchHandler).toHaveBeenCalledTimes(1);
    expect(MockedRankingHandler).toHaveBeenCalledTimes(1);
  });

  describe("processEvent", () => {
    const mockEvent: PlayerKillEvent = {
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
    };

    it("should persist event via DatabaseClient", async () => {
      await processor.processEvent(mockEvent);

      const dbInstance = MockedDatabaseClient.mock.instances[0]!;
      expect(dbInstance.createGameEvent).toHaveBeenCalledWith(mockEvent);

      // No handler invocations expected in minimal path
      expect(
        MockedPlayerHandler.mock.instances[0]!.handleEvent,
      ).not.toHaveBeenCalled();
    });

    it("should throw if the database call fails", async () => {
      const dbInstance = MockedDatabaseClient.mock.instances[0]!;
      const dbError = new Error("DB Error");
      vi.mocked(dbInstance.createGameEvent).mockRejectedValue(dbError);

      await expect(processor.processEvent(mockEvent)).rejects.toThrow(dbError);
    });
  });

  describe("Database Methods", () => {
    it("should call testConnection on the db instance", async () => {
      const dbInstance = MockedDatabaseClient.mock.instances[0]!;
      await processor.testDatabaseConnection();
      expect(dbInstance.testConnection).toHaveBeenCalled();
    });

    it("should call disconnect on the db instance", async () => {
      const dbInstance = MockedDatabaseClient.mock.instances[0]!;
      await processor.disconnect();
      expect(dbInstance.disconnect).toHaveBeenCalled();
    });
  });

  describe("EventProcessorService - bot gating", () => {
    const upsertMock = vi.fn();
    const createFragMock = vi.fn();
    const mockDb = {
      prisma: {
        player: { upsert: upsertMock },
        eventFrag: { create: createFragMock },
      },
      getOrCreatePlayer: vi.fn().mockResolvedValue(1),
      createGameEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as DatabaseClient;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("ignores bot events when logBots=false", async () => {
      const service = new EventProcessorService(mockDb, { logBots: false });

      const event: PlayerConnectEvent & { meta: PlayerMeta } = {
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
      };

      await service.processEvent(event);

      expect(upsertMock).not.toHaveBeenCalled();
      expect(createFragMock).not.toHaveBeenCalled();
    });

    it("processes bot events when logBots=true", async () => {
      const service = new EventProcessorService(mockDb, { logBots: true });

      const event: PlayerConnectEvent & { meta: PlayerMeta } = {
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
      };

      await service.processEvent(event);

      expect(mockDb.getOrCreatePlayer).toHaveBeenCalledWith(
        "BOT",
        "BotPlayer",
        "cstrike",
      );
    });
  });
});
