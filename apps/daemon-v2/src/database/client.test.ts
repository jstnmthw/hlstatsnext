import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { DatabaseClient } from "./client";

// Mock the @repo/database/client Prisma instance
vi.mock("@repo/database/client", () => {
  const fakeDb = {
    playerUniqueId: {
      findUnique: vi.fn(),
    },
    player: {
      create: vi.fn(({ data }) => Promise.resolve({ playerId: 42, ...data })),
    },
  };

  return {
    db: fakeDb,
    Player: {},
  };
});

const dbClient = new DatabaseClient();

describe("DatabaseClient - getOrCreatePlayer (bots)", () => {
  beforeEach(() => {
    // Reset all mocks between tests
    vi.clearAllMocks();
  });

  it("creates unique player per bot name", async () => {
    const playerId = await dbClient.getOrCreatePlayer(
      "BOT",
      "RAGE OF THE BOY",
      "cstrike",
    );

    // Should return mocked id from create
    expect(playerId).toBe(42);

    // The create call should receive a uniqueId starting with BOT_ and containing name
    const { db: mockedDb } = await import("@repo/database/client");
    const createMock = (mockedDb as unknown as { player: { create: Mock } })
      .player.create;
    expect(createMock).toHaveBeenCalled();

    type CreateArgs = {
      data: {
        uniqueIds: { create: { uniqueId: string } };
      };
    };
    const args = createMock.mock.calls[0]![0]! as CreateArgs;
    expect(args.data.uniqueIds.create.uniqueId).toBe("BOT_RAGE_OF_THE_BOY");
  });
});
