import { describe, it, expect, vi } from "vitest";
import { WeaponHandler } from "../../src/services/processor/handlers/weapon.handler";
import { EventType, type PlayerKillEvent } from "../../src/types/common/events";
import type { DatabaseClient } from "../../src/database/client";

// Mock the weapon config
vi.mock("../../src/config/weapon-config", () => ({
  getWeaponAttributes: vi.fn((weapon) => {
    if (weapon === "ak47") {
      return {
        baseDamage: 36,
        headshotMultiplier: 4,
        shotsFired: 100,
        shotsHit: 50,
      };
    }
    return {
      baseDamage: 20,
      headshotMultiplier: 3,
      shotsFired: 0,
      shotsHit: 0,
    };
  }),
}));

describe("WeaponHandler", () => {
  const mockDb = {} as DatabaseClient;
  const handler = new WeaponHandler(mockDb);

  describe("handleEvent", () => {
    it("should call handleWeaponKill for PLAYER_KILL events", async () => {
      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: true,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      };

      const result = await handler.handleEvent(killEvent);
      expect(result.success).toBe(true);
      expect(result.weaponsAffected).toEqual(["ak47"]);
    });

    it("should ignore events other than PLAYER_KILL", async () => {
      const otherEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      } as any;

      const result = await handler.handleEvent(otherEvent);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.weaponsAffected).toBeUndefined();
    });
  });

  describe("getWeaponDamageMultiplier", () => {
    it("should return base damage for a body shot", async () => {
      // Accessing private method for testing purposes
      const multiplier = await (handler as any).getWeaponDamageMultiplier(
        "glock",
        false
      );
      expect(multiplier).toBe(20);
    });

    it("should return multiplied damage for a headshot", async () => {
      // Accessing private method for testing purposes
      const multiplier = await (handler as any).getWeaponDamageMultiplier(
        "ak47",
        true
      );
      expect(multiplier).toBe(144); // 36 * 4
    });
  });
});
