import { describe, it, expect } from "vitest";
import { CsParser } from "@/services/ingress/parsers/cs.parser";

// Counter-Strike parser – BOT detection

describe("CsParser BOT detection", () => {
  const parser = new CsParser("cstrike");

  it("flags meta.isBot when the Steam ID token is BOT", async () => {
    const line =
      'L 01/01/2025 - 12:00:00: "BotPlayer<1><BOT><CT>" connected, address "7.7.7.7:27005"';

    const result = await parser.parse(line, 99);
    if (!result.success) {
      throw new Error("Expected parse to succeed");
    }

    const { event } = result;
    expect(event.eventType).toBe("PLAYER_CONNECT");
    expect(event.meta?.isBot).toBe(true);
    expect(event.meta?.steamId).toBe("BOT");
    expect(event.meta?.playerName).toBe("BotPlayer");
  });
});
