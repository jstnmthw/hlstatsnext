import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventProcessorService } from "../../src/services/processor/processor.service";
import { PlayerHandler } from "../../src/services/processor/handlers/player.handler";
import { WeaponHandler } from "../../src/services/processor/handlers/weapon.handler";
import { MatchHandler } from "../../src/services/processor/handlers/match.handler";
import { RankingHandler } from "../../src/services/processor/handlers/ranking.handler";
import { DatabaseClient } from "../../src/database/client";
import { EventType, type GameEvent } from "../../src/types/common/events";

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
    // Reset mocks before each test
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
    const mockEvent: GameEvent = {
      eventType: EventType.PLAYER_KILL,
      serverId: 1,
      timestamp: new Date(),
      data: {},
    } as any;

    it("should call all handlers and the database", async () => {
      await processor.processEvent(mockEvent);

      const dbInstance = MockedDatabaseClient.mock.instances[0]!;
      expect(dbInstance.createGameEvent).toHaveBeenCalledWith(mockEvent);

      const playerHandlerInstance = MockedPlayerHandler.mock.instances[0]!;
      expect(playerHandlerInstance.handleEvent).toHaveBeenCalledWith(mockEvent);

      const weaponHandlerInstance = MockedWeaponHandler.mock.instances[0]!;
      expect(weaponHandlerInstance.handleEvent).toHaveBeenCalledWith(mockEvent);

      const matchHandlerInstance = MockedMatchHandler.mock.instances[0]!;
      expect(matchHandlerInstance.handleEvent).toHaveBeenCalledWith(mockEvent);

      const rankingHandlerInstance = MockedRankingHandler.mock.instances[0]!;
      expect(rankingHandlerInstance.handleEvent).toHaveBeenCalledWith(
        mockEvent
      );
    });

    it("should throw if the database call fails", async () => {
      const dbInstance = MockedDatabaseClient.mock.instances[0]!;
      const dbError = new Error("DB Error");
      vi.mocked(dbInstance.createGameEvent).mockRejectedValue(dbError);

      await expect(processor.processEvent(mockEvent)).rejects.toThrow(dbError);
    });

    it("should throw if a handler fails", async () => {
      const playerHandlerInstance = MockedPlayerHandler.mock.instances[0]!;
      const handlerError = new Error("Handler Error");
      vi.mocked(playerHandlerInstance.handleEvent).mockRejectedValue(
        handlerError
      );

      await expect(processor.processEvent(mockEvent)).rejects.toThrow(
        handlerError
      );
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
});
