import { describe, it, expect, beforeEach } from "vitest";
import { PlayerHandler } from "../../src/services/processor/handlers/player.handler.js";
import { EventType } from "../../src/types/common/events.types.js";

describe("PlayerHandler", () => {
  let handler: PlayerHandler;

  beforeEach(() => {
    handler = new PlayerHandler();
  });

  describe("handleEvent", () => {
    it("should handle PLAYER_CONNECT events", async () => {
      const event = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 123,
          steamId: "76561198000000000",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.100",
          country: "US",
        },
      };

      const result = await handler.handleEvent(event);

      expect(result.success).toBe(true);
      expect(result.playersAffected).toEqual([123]);
      expect(result.error).toBeUndefined();
    });

    it("should handle PLAYER_DISCONNECT events", async () => {
      const event = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 123,
          reason: "Disconnect by user",
          sessionDuration: 1800,
        },
      };

      const result = await handler.handleEvent(event);

      expect(result.success).toBe(true);
      expect(result.playersAffected).toEqual([123]);
    });

    it("should handle PLAYER_KILL events", async () => {
      const event = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 123,
          victimId: 456,
          weapon: "ak47",
          headshot: true,
          killerTeam: "CT",
          victimTeam: "T",
        },
      };

      const result = await handler.handleEvent(event);

      expect(result.success).toBe(true);
      expect(result.playersAffected).toEqual([123, 456]);
    });

    it("should return success for unhandled event types", async () => {
      const event = {
        eventType: EventType.MAP_CHANGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          previousMap: "de_dust2",
          newMap: "de_inferno",
          playerCount: 10,
        },
      };

      const result = await handler.handleEvent(event);

      expect(result.success).toBe(true);
      expect(result.playersAffected).toBeUndefined();
    });

    it("should handle errors gracefully", async () => {
      // Mock console.log to throw an error
      const originalLog = console.log;
      console.log = () => {
        throw new Error("Test error");
      };

      const event = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 123,
          steamId: "76561198000000000",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.100",
        },
      };

      const result = await handler.handleEvent(event);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Test error");

      // Restore original console.log
      console.log = originalLog;
    });
  });
});
