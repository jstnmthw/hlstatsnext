import { describe, it, expect } from "vitest"
import { CsParser } from "../../src/services/ingress/parsers/cs.parser"
import {
  EventType,
  PlayerChatEvent,
  type PlayerConnectEvent,
  type PlayerDisconnectEvent,
  type PlayerKillEvent,
  type PlayerSuicideEvent,
  type PlayerTeamkillEvent,
} from "../../src/types/common/events"

describe("Counster Strike Parser", () => {
  const parser = new CsParser("csgo")
  const serverId = 1

  describe("canParse", () => {
    it("should return true for valid log lines", () => {
      const logLine = "L 07/15/2024 - 22:33:10: log message"
      expect(parser.canParse(logLine)).toBe(true)
    })

    it("should return false for invalid log lines", () => {
      const logLine = "Some other log format"
      expect(parser.canParse(logLine)).toBe(false)
    })
  })

  describe("parse", () => {
    it("should parse a connect event", async () => {
      const logLine = 'L 07/15/2024 - 22:33:10: "PlayerName<1><STEAM_1:0:12345><CT>" connected, address "1.2.3.4:27005"'
      const result = await parser.parse(logLine, serverId)
      expect(result.success).toBe(true)
      if (result.success) {
        const event = result.event as PlayerConnectEvent
        expect(event.eventType).toBe(EventType.PLAYER_CONNECT)
        expect(event.data.playerName).toBe("PlayerName")
        expect(event.data.steamId).toBe("STEAM_1:0:12345")
        expect(event.data.ipAddress).toBe("1.2.3.4")
      }
    })

    it("should parse a disconnect event with a reason", async () => {
      const logLine =
        'L 07/15/2024 - 22:35:10: "PlayerName<1><STEAM_1:0:12345><CT>" disconnected (reason "Client left game")'
      const result = await parser.parse(logLine, serverId)
      expect(result.success).toBe(true)
      if (result.success) {
        const event = result.event as PlayerDisconnectEvent
        expect(event.eventType).toBe(EventType.PLAYER_DISCONNECT)
        expect(event.data.reason).toBe("Client left game")
      }
    })

    it("should parse a disconnect event without a reason", async () => {
      const logLine = 'L 07/15/2024 - 22:35:10: "PlayerName<1><STEAM_1:0:12345><CT>" disconnected'
      const result = await parser.parse(logLine, serverId)
      expect(result.success).toBe(true)
      if (result.success) {
        const event = result.event as PlayerDisconnectEvent
        expect(event.eventType).toBe(EventType.PLAYER_DISCONNECT)
        expect(event.data.reason).toBeUndefined()
      }
    })

    it("should parse a kill event with a headshot", async () => {
      const logLine =
        'L 07/15/2024 - 22:35:05: "Killer<2><STEAM_1:0:111><TERRORIST>" [93 303 73] killed "Victim<3><STEAM_1:0:222><CT>" [35 302 73] with "ak47" (headshot)'
      const result = await parser.parse(logLine, serverId)
      expect(result.success).toBe(true)
      if (result.success) {
        const event = result.event as PlayerKillEvent
        expect(event.eventType).toBe(EventType.PLAYER_KILL)
        expect(event.data.weapon).toBe("ak47")
        expect(event.data.headshot).toBe(true)
        expect(event.data.killerTeam).toBe("TERRORIST")
        expect(event.data.victimTeam).toBe("CT")
      }
    })

    it("should parse a kill event without a headshot", async () => {
      const logLine =
        'L 07/15/2024 - 22:35:05: "Killer<2><STEAM_1:0:111><TERRORIST>" [93 303 73] killed "Victim<3><STEAM_1:0:222><CT>" [35 302 73] with "deagle"'
      const result = await parser.parse(logLine, serverId)
      expect(result.success).toBe(true)
      if (result.success) {
        const event = result.event as PlayerKillEvent
        expect(event.eventType).toBe(EventType.PLAYER_KILL)
        expect(event.data.weapon).toBe("deagle")
        expect(event.data.headshot).toBe(false)
      }
    })

    it("should parse a suicide event", async () => {
      const logLine =
        'L 07/15/2024 - 22:35:05: "Player<2><STEAM_1:0:111><TERRORIST>" [93 303 73] committed suicide with "world"'
      const result = await parser.parse(logLine, serverId)
      expect(result.success).toBe(true)
      if (result.success) {
        const event = result.event as PlayerSuicideEvent
        expect(event.eventType).toBe(EventType.PLAYER_SUICIDE)
        expect(event.data.weapon).toBe("world")
        expect(event.data.team).toBe("TERRORIST")
        if (event.meta && "steamId" in event.meta) {
          expect(event.meta.steamId).toBe("STEAM_1:0:111")
          expect(event.meta.playerName).toBe("Player")
          expect(event.meta.isBot).toBe(false)
        }
      }
    })

    it("should parse a teamkill event", async () => {
      const logLine =
        'L 07/15/2024 - 22:35:05: "TeamKiller<2><STEAM_1:0:111><CT>" [93 303 73] killed "TeamMate<3><STEAM_1:0:222><CT>" [35 302 73] with "m4a1"'
      const result = await parser.parse(logLine, serverId)
      expect(result.success).toBe(true)
      if (result.success) {
        const event = result.event as PlayerTeamkillEvent
        expect(event.eventType).toBe(EventType.PLAYER_TEAMKILL)
        expect(event.data.weapon).toBe("m4a1")
        expect(event.data.headshot).toBe(false)
        expect(event.data.team).toBe("CT")
        expect(event.meta?.killer.steamId).toBe("STEAM_1:0:111")
        expect(event.meta?.killer.playerName).toBe("TeamKiller")
        expect(event.meta?.victim.steamId).toBe("STEAM_1:0:222")
        expect(event.meta?.victim.playerName).toBe("TeamMate")
      }
    })

    it("should not parse a regular kill as teamkill", async () => {
      const logLine =
        'L 07/15/2024 - 22:35:05: "Killer<2><STEAM_1:0:111><TERRORIST>" [93 303 73] killed "Victim<3><STEAM_1:0:222><CT>" [35 302 73] with "ak47"'
      const result = await parser.parse(logLine, serverId)
      expect(result.success).toBe(true)
      if (result.success) {
        const event = result.event
        expect(event.eventType).toBe(EventType.PLAYER_KILL) // Not PLAYER_TEAMKILL
      }
    })

    it("should parse a bot suicide event", async () => {
      const logLine = 'L 07/15/2024 - 22:35:05: "BotName<2><BOT><CT>" [93 303 73] committed suicide with "hegrenade"'
      const result = await parser.parse(logLine, serverId)
      expect(result.success).toBe(true)
      if (result.success) {
        const event = result.event as PlayerSuicideEvent
        expect(event.eventType).toBe(EventType.PLAYER_SUICIDE)
        expect(event.data.weapon).toBe("hegrenade")
        expect(event.data.team).toBe("CT")
        if (event.meta && "steamId" in event.meta) {
          expect(event.meta.isBot).toBe(true)
        }
      }
    })

    it("should parse a bot teamkill event", async () => {
      const logLine =
        'L 07/15/2024 - 22:35:05: "BotKiller<2><BOT><TERRORIST>" [93 303 73] killed "BotVictim<3><BOT><TERRORIST>" [35 302 73] with "glock" (headshot)'
      const result = await parser.parse(logLine, serverId)
      expect(result.success).toBe(true)
      if (result.success) {
        const event = result.event as PlayerTeamkillEvent
        expect(event.eventType).toBe(EventType.PLAYER_TEAMKILL)
        expect(event.data.weapon).toBe("glock")
        expect(event.data.headshot).toBe(true)
        expect(event.data.team).toBe("TERRORIST")
        expect(event.meta?.killer.isBot).toBe(true)
        expect(event.meta?.victim.isBot).toBe(true)
      }
    })

    it("should return success:false for unhandled log lines", async () => {
      const logLine = 'L 07/15/2024 - 22:33:10: "Server" say "Hello"'
      const result = await parser.parse(logLine, serverId)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("Unsupported log line")
      }
    })

    it("should parse standard chat line", async () => {
      const logLine = 'L 06/28/2025 - 09:09:32: "goat<5><BOT><CT>" say "Too bad NNBot is discontinued..."'

      const result = await parser.parse(logLine, 1)

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.event.eventType).toBe(EventType.CHAT_MESSAGE)
      // meta assertions
      const chatEvent = result.event as PlayerChatEvent
      if (chatEvent.meta && "steamId" in chatEvent.meta) {
        expect(chatEvent.meta.steamId).toBe("BOT")
        expect(chatEvent.meta.playerName).toBe("goat")
        expect(chatEvent.meta.isBot).toBe(true)
      }

      const data = chatEvent.data
      expect(data.message).toBe("Too bad NNBot is discontinued...")
      expect(data.team).toBe("CT")
      expect(data.isDead).toBe(false)
    })

    it("should parse dead chat line", async () => {
      const logLine = 'L 06/28/2025 - 09:09:32: "Brandon<2><BOT><TERRORIST>" say "hello" (dead)'

      const result = await parser.parse(logLine, 1)

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.event.eventType).toBe(EventType.CHAT_MESSAGE)
      const deadEvent = result.event as PlayerChatEvent
      expect(deadEvent.data.isDead).toBe(true)
    })
  })

  describe("BOT detection", () => {
    const parser = new CsParser("cstrike")

    it("flags meta.isBot when the Steam ID token is BOT", async () => {
      const line = 'L 01/01/2025 - 12:00:00: "BotPlayer<1><BOT><CT>" connected, address "7.7.7.7:27005"'

      const result = await parser.parse(line, 99)
      if (!result.success) {
        throw new Error("Expected parse to succeed")
      }

      const { event } = result
      expect(event.eventType).toBe("PLAYER_CONNECT")
      const eventWithMeta = event as { meta?: { steamId: string; playerName: string; isBot: boolean } }
      if (eventWithMeta.meta && "steamId" in eventWithMeta.meta) {
        expect(eventWithMeta.meta.isBot).toBe(true)
        expect(eventWithMeta.meta.steamId).toBe("BOT")
        expect(eventWithMeta.meta.playerName).toBe("BotPlayer")
      }
    })
  })
})
