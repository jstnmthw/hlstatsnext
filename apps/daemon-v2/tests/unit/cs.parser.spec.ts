import { describe, it, expect } from "vitest";
import { CsParser } from "../../src/services/ingress/parsers/cs.parser";
import { EventType } from "../../src/types/common/events";

describe("CsParser", () => {
  const parser = new CsParser("csgo");
  const serverId = 1;

  describe("canParse", () => {
    it("should return true for valid log lines", () => {
      const logLine = "L 07/15/2024 - 22:33:10: log message";
      expect(parser.canParse(logLine)).toBe(true);
    });

    it("should return false for invalid log lines", () => {
      const logLine = "Some other log format";
      expect(parser.canParse(logLine)).toBe(false);
    });
  });

  describe("parse", () => {
    it("should parse a connect event", async () => {
      const logLine =
        'L 07/15/2024 - 22:33:10: "PlayerName<1><STEAM_1:0:12345><CT>" connected, address "1.2.3.4:27005"';
      const result = await parser.parse(logLine, serverId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.eventType).toBe(EventType.PLAYER_CONNECT);
        expect(result.event.data.playerName).toBe("PlayerName");
        expect(result.event.data.steamId).toBe("STEAM_1:0:12345");
        expect(result.event.data.ipAddress).toBe("1.2.3.4");
      }
    });

    it("should parse a disconnect event with a reason", async () => {
      const logLine =
        'L 07/15/2024 - 22:35:10: "PlayerName<1><STEAM_1:0:12345><CT>" disconnected (reason "Client left game")';
      const result = await parser.parse(logLine, serverId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.eventType).toBe(EventType.PLAYER_DISCONNECT);
        expect(result.event.data.reason).toBe("Client left game");
      }
    });

    it("should parse a disconnect event without a reason", async () => {
      const logLine =
        'L 07/15/2024 - 22:35:10: "PlayerName<1><STEAM_1:0:12345><CT>" disconnected';
      const result = await parser.parse(logLine, serverId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.eventType).toBe(EventType.PLAYER_DISCONNECT);
        expect(result.event.data.reason).toBeUndefined();
      }
    });

    it("should parse a kill event with a headshot", async () => {
      const logLine =
        'L 07/15/2024 - 22:35:05: "Killer<2><STEAM_1:0:111><TERRORIST>" [93 303 73] killed "Victim<3><STEAM_1:0:222><CT>" [35 302 73] with "ak47" (headshot)';
      const result = await parser.parse(logLine, serverId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.eventType).toBe(EventType.PLAYER_KILL);
        expect(result.event.data.weapon).toBe("ak47");
        expect(result.event.data.headshot).toBe(true);
        expect(result.event.data.killerTeam).toBe("TERRORIST");
        expect(result.event.data.victimTeam).toBe("CT");
      }
    });

    it("should parse a kill event without a headshot", async () => {
      const logLine =
        'L 07/15/2024 - 22:35:05: "Killer<2><STEAM_1:0:111><TERRORIST>" [93 303 73] killed "Victim<3><STEAM_1:0:222><CT>" [35 302 73] with "deagle"';
      const result = await parser.parse(logLine, serverId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.eventType).toBe(EventType.PLAYER_KILL);
        expect(result.event.data.weapon).toBe("deagle");
        expect(result.event.data.headshot).toBe(false);
      }
    });

    it("should return success:false for unhandled log lines", async () => {
      const logLine = 'L 07/15/2024 - 22:33:10: "Server" say "Hello"';
      const result = await parser.parse(logLine, serverId);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Unsupported log line");
    });
  });
});
