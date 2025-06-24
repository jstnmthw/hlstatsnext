import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the DatabaseClient module before importing the service
vi.mock("../../src/database/client", () => {
  return {
    DatabaseClient: vi.fn().mockImplementation(() => ({
      testConnection: vi.fn().mockResolvedValue(true),
      createGameEvent: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

import { EventProcessorService } from "../../src/services/processor/processor.service";
import { EventType, type GameEvent } from "../../src/types/common/events";

// Because DatabaseClient is mocked above, importing EventProcessorService now
// will get the mock injected.

describe("EventProcessorService", () => {
  let processor: EventProcessorService;

  beforeEach(() => {
    processor = new EventProcessorService();
  });

  it("testDatabaseConnection returns true when DB is healthy", async () => {
    const result = await processor.testDatabaseConnection();
    expect(result).toBe(true);
  });

  it("processEvent routes events without throwing", async () => {
    const event: GameEvent = {
      eventType: EventType.PLAYER_CONNECT,
      timestamp: new Date(),
      serverId: 1,
      data: {
        playerId: 0,
        steamId: "STEAM_1:0:12345",
        playerName: "Tester",
        ipAddress: "127.0.0.1",
      },
    };

    await expect(processor.processEvent(event)).resolves.toBeUndefined();
  });
});
