import { describe, it, expect, vi, beforeEach } from "vitest";
import { MatchHandler } from "../../src/services/processor/handlers/match.handler";
import {
  EventType,
  type RoundEndEvent,
  type MapChangeEvent,
  type BaseEvent,
} from "../../src/types/common/events";
import type { DatabaseClient } from "../../src/database/client";

describe("MatchHandler", () => {
  const mockDb = {} as DatabaseClient;
  let handler: MatchHandler;

  beforeEach(() => {
    handler = new MatchHandler(mockDb);
  });

  describe("handleEvent", () => {
    it("should handle ROUND_START and initialize stats", async () => {
      const event: BaseEvent = {
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
      };
      const result = await handler.handleEvent(event);

      expect(result.success).toBe(true);
      const stats = handler.getMatchStats(1);
      expect(stats).toBeDefined();
      expect(stats?.totalRounds).toBe(0);
    });

    it("should handle ROUND_END and update stats", async () => {
      // First, start a round to initialize
      await handler.handleEvent({
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
      } as BaseEvent);

      const roundEndEvent: RoundEndEvent = {
        eventType: EventType.ROUND_END,
        serverId: 1,
        timestamp: new Date(),
        data: {
          winningTeam: "TERRORIST",
          duration: 120,
          score: { team1: 1, team2: 0 },
        },
      };

      const result = await handler.handleEvent(roundEndEvent);
      expect(result.success).toBe(true);

      const stats = handler.getMatchStats(1);
      expect(stats?.totalRounds).toBe(1);
      expect(stats?.duration).toBe(120);
      expect(stats?.teamScores["TERRORIST"]).toBe(1);
    });

    it("should handle MAP_CHANGE and finalize/reset stats", async () => {
      // Start a round and end it to create stats
      await handler.handleEvent({
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
      } as BaseEvent);
      await handler.handleEvent({
        eventType: EventType.ROUND_END,
        serverId: 1,
        timestamp: new Date(),
        data: {
          winningTeam: "CT",
          duration: 100,
          score: { team1: 0, team2: 1 },
        },
      } as RoundEndEvent);

      const mapChangeEvent: MapChangeEvent = {
        eventType: EventType.MAP_CHANGE,
        serverId: 1,
        timestamp: new Date(),
        data: {
          previousMap: "de_dust2",
          newMap: "de_inferno",
          playerCount: 10,
        },
      };

      // @ts-expect-error - Testing private method
      const finalizeSpy = vi.spyOn(handler, "finalizeMatch");
      await handler.handleEvent(mapChangeEvent);

      expect(finalizeSpy).toHaveBeenCalledWith(
        1,
        "de_dust2",
        expect.any(Object)
      );

      const stats = handler.getMatchStats(1);
      expect(stats).toBeUndefined();
    });

    it("should ignore unhandled events", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
      };
      const result = await handler.handleEvent(event);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should not throw on ROUND_END if no match stats exist", async () => {
      const roundEndEvent: RoundEndEvent = {
        eventType: EventType.ROUND_END,
        serverId: 99, // A server with no stats
        timestamp: new Date(),
        data: {
          winningTeam: "TERRORIST",
          duration: 120,
          score: { team1: 1, team2: 0 },
        },
      };
      const result = await handler.handleEvent(roundEndEvent);
      expect(result.success).toBe(true);
    });
  });
});
