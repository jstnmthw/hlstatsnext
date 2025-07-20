import { describe, it, expect } from "vitest"
import { CsParser } from "./cs.parser"
import { EventType } from "@/shared/types/events"

describe("CsParser", () => {
  const parser = new CsParser()
  const serverId = 1

  describe("parseKillEvent", () => {
    it("should parse a valid kill event", () => {
      const logLine =
        '"Player1<2><STEAM_123><CT>" killed "Player2<3><STEAM_456><TERRORIST>" with "ak47" (headshot)'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).not.toBeNull()
      expect(result.event?.eventType).toBe(EventType.PLAYER_KILL)
      expect(result.event?.data).toEqual({
        killerId: 2,
        victimId: 3,
        weapon: "ak47",
        headshot: true,
        killerTeam: "CT",
        victimTeam: "TERRORIST",
      })
      expect(result.event?.meta).toEqual({
        killer: {
          steamId: "STEAM_123",
          playerName: "Player1",
          isBot: false,
        },
        victim: {
          steamId: "STEAM_456",
          playerName: "Player2",
          isBot: false,
        },
      })
    })

    it("should return an error for a malformed kill event", () => {
      const logLine = '"Player1<2><STEAM_123><CT>" killed "Player2<3><STEAM_456><TERRORIST>"'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(false)
      expect(result.event).toBeNull()
      expect(result.error).toBe("Could not parse kill event")
    })
  })

  describe("parseConnectEvent", () => {
    it("should parse a valid connect event", () => {
      const logLine = '"Player<2><STEAM_789><>" connected, address "192.168.1.1:27005"'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).not.toBeNull()
      expect(result.event?.eventType).toBe(EventType.PLAYER_CONNECT)
      expect(result.event?.data).toEqual({
        playerId: 2,
        steamId: "STEAM_789",
        playerName: "Player",
        ipAddress: "192.168.1.1:27005",
      })
    })
  })

  describe("parseDisconnectEvent", () => {
    it("should parse a valid disconnect event", () => {
      const logLine = '"Player<2><STEAM_123><CT>" disconnected (reason "Disconnect")'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).not.toBeNull()
      expect(result.event?.eventType).toBe(EventType.PLAYER_DISCONNECT)
      expect(result.event?.data).toEqual({
        playerId: 2,
        reason: "Disconnect",
      })
    })
  })

  describe("parseChatEvent", () => {
    it("should parse a valid chat event", () => {
      const logLine = '"Player<2><STEAM_123><CT>" say "hello world"'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).not.toBeNull()
      expect(result.event?.eventType).toBe(EventType.CHAT_MESSAGE)
      expect(result.event?.data).toEqual({
        playerId: 2,
        message: "hello world",
        team: "CT",
        isDead: false,
      })
    })

    it("should parse a valid team chat event", () => {
      const logLine = '"Player<2><STEAM_123><CT>" say_team "team message"'
      const result = parser.parseLine(logLine, serverId)
      expect(result.success).toBe(true)
      expect(result.event?.data).toEqual({
        playerId: 2,
        message: "team message",
        team: "CT",
        isDead: false,
      })
    })
  })

  describe("parseRoundStartEvent", () => {
    it("should parse a round start event", () => {
      const logLine = 'World triggered "Round_Start"'
      const result = parser.parseLine(logLine, serverId)
      expect(result.success).toBe(true)
      expect(result.event?.eventType).toBe(EventType.ROUND_START)
    })
  })

  describe("parseRoundEndEvent", () => {
    it("should parse a round end event", () => {
      const logLine = 'World triggered "Round_End"'
      const result = parser.parseLine(logLine, serverId)
      expect(result.success).toBe(true)
      expect(result.event?.eventType).toBe(EventType.ROUND_END)
    })
  })

  describe("Unhandled events", () => {
    it("should return a successful result with a null event for unhandled lines", () => {
      const logLine = "This is some random log line that we do not handle"
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeNull()
    })
  })
})
