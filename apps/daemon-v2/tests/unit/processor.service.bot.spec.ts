import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventProcessorService } from "@/services/processor/processor.service";
import {
  EventType,
  PlayerConnectEvent,
  PlayerMeta,
} from "@/types/common/events";

describe("EventProcessorService – bot gating", () => {
  const upsertMock = vi.fn();
  const createFragMock = vi.fn();
  const mockDb = {
    prisma: {
      player: { upsert: upsertMock },
      eventFrag: { create: createFragMock },
    },
    getOrCreatePlayer: vi.fn().mockResolvedValue(1),
    createGameEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as import("@/database/client").DatabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores bot events when logBots=false", async () => {
    const service = new EventProcessorService(mockDb, { logBots: false });

    const event: import("@/types/common/events").PlayerConnectEvent & {
      meta: import("@/types/common/events").PlayerMeta;
    } = {
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

    const event: PlayerConnectEvent & {
      meta: PlayerMeta;
    } = {
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
      "cstrike"
    );
  });
});
