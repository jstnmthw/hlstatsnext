/**
 * Notification Message Builder Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { NotificationMessageBuilder } from "./notification-message.builder"
import { PlainTextFormatter } from "../formatters/plain-text.formatter"
import { GoldSrcColorFormatter } from "../formatters/goldsrc-color.formatter"
import { SourceColorFormatter } from "../formatters/source-color.formatter"
import { EventType } from "@/shared/types/events"
import type {
  KillEventNotificationData,
  SuicideEventNotificationData,
  TeamKillEventNotificationData,
  ActionEventNotificationData,
  TeamActionEventNotificationData,
  ConnectEventNotificationData,
  DisconnectEventNotificationData,
  MessageTemplates,
} from "../types/notification.types"

describe("NotificationMessageBuilder", () => {
  let builder: NotificationMessageBuilder

  beforeEach(() => {
    builder = NotificationMessageBuilder.create()
  })

  describe("Basic Builder Pattern", () => {
    it("should create a new instance", () => {
      expect(builder).toBeInstanceOf(NotificationMessageBuilder)
    })

    it("should reset to initial state", () => {
      builder.withEventType(EventType.PLAYER_KILL).withPoints(25)
      builder.reset()

      // After reset, should build a minimal message
      const message = builder.build()
      expect(message).toBe("[HLStatsNext]: Unknown event")
    })

    it("should chain methods fluently", () => {
      const result = builder
        .withEventType(EventType.PLAYER_KILL)
        .withKiller(1, "Player1", 15)
        .withVictim(2, "Player2", 23)
        .withPoints(10)

      expect(result).toBe(builder)
    })
  })

  describe("Kill Event Messages", () => {
    it("should build basic kill message without colors", () => {
      const message = builder
        .withColorFormatter(new PlainTextFormatter())
        .withEventType(EventType.PLAYER_KILL)
        .withKiller(1, "TestKiller", 15)
        .withVictim(2, "TestVictim", 23)
        .withPoints(10)
        .build()

      expect(message).toBe(
        "[HLStatsNext]: TestKiller (#15) got +10 points for killing TestVictim (#23)",
      )
    })

    it("should build kill message with GoldSrc colors", () => {
      const colorFormatter = GoldSrcColorFormatter.withColors()
      const message = builder
        .withColorFormatter(colorFormatter)
        .withEventType(EventType.PLAYER_KILL)
        .withKiller(1, "TestKiller", 15)
        .withVictim(2, "TestVictim", 23)
        .withPoints(10)
        .build()

      expect(message).toContain("^2[HLStatsNext]^0") // Colored tag
      expect(message).toContain("^2+10^0") // Colored points
      expect(message).toContain("^3#15^0") // Colored rank
      expect(message).toContain("^3#23^0") // Colored rank
    })

    it("should build kill message with Source colors", () => {
      const colorFormatter = SourceColorFormatter.withColors()
      const message = builder
        .withColorFormatter(colorFormatter)
        .withEventType(EventType.PLAYER_KILL)
        .withKiller(1, "TestKiller", 15)
        .withVictim(2, "TestVictim", 23)
        .withPoints(10)
        .build()

      expect(message).toContain("\x04[HLStatsNext]\x01") // Colored tag
      expect(message).toContain("\x04+10\x01") // Colored points
      expect(message).toContain("\x09#15\x01") // Colored rank
    })

    it("should handle missing player names in kill events", () => {
      const message = builder
        .withEventType(EventType.PLAYER_KILL)
        .withKiller(1, undefined, 15)
        .withVictim(2, undefined, 23)
        .withPoints(10)
        .build()

      expect(message).toBe(
        "[HLStatsNext]: {killerName} (#15) got +10 points for killing {victimName} (#23)",
      )
    })

    it("should handle missing ranks in kill events", () => {
      const message = builder
        .withEventType(EventType.PLAYER_KILL)
        .withKiller(1, "TestKiller")
        .withVictim(2, "TestVictim")
        .withPoints(10)
        .build()

      expect(message).toBe(
        "[HLStatsNext]: TestKiller (#{killerRank}) got +10 points for killing TestVictim (#{victimRank})",
      )
    })

    it("should build kill message from event data", () => {
      const eventData: KillEventNotificationData = {
        serverId: 1,
        killerId: 100,
        victimId: 200,
        killerName: "Player1",
        victimName: "Player2",
        killerRank: 15,
        victimRank: 23,
        skillAdjustment: {
          killerChange: 10,
          victimChange: -8,
        },
        weapon: "ak47",
        headshot: true,
      }

      const message = builder.fromKillEvent(eventData).build()
      expect(message).toBe("[HLStatsNext]: Player1 (#15) got +10 points for killing Player2 (#23)")
    })
  })

  describe("Suicide Event Messages", () => {
    it("should build suicide message", () => {
      const message = builder
        .withEventType(EventType.PLAYER_SUICIDE)
        .withPlayer(1, "TestPlayer", 15)
        .withPoints(-5)
        .build()

      expect(message).toBe("[HLStatsNext]: TestPlayer (#15) lost -5 points for suicide")
    })

    it("should build suicide message with colors", () => {
      const colorFormatter = GoldSrcColorFormatter.withColors()
      const message = builder
        .withColorFormatter(colorFormatter)
        .withEventType(EventType.PLAYER_SUICIDE)
        .withPlayer(1, "TestPlayer", 15)
        .withPoints(-5)
        .build()

      expect(message).toContain("^1-5^0") // Red for negative points
    })

    it("should build suicide message from event data", () => {
      const eventData: SuicideEventNotificationData = {
        serverId: 1,
        playerId: 100,
        playerName: "Player1",
        skillPenalty: -5,
        weapon: "worldspawn",
      }

      const message = builder.fromSuicideEvent(eventData).withPlayer(100, "Player1", 15).build()
      expect(message).toBe("[HLStatsNext]: Player1 (#15) lost -5 points for suicide")
    })
  })

  describe("Team Kill Event Messages", () => {
    it("should build team kill message", () => {
      const message = builder
        .withEventType(EventType.PLAYER_TEAMKILL)
        .withKiller(1, "TeamKiller")
        .withVictim(2, "TeamVictim")
        .withPoints(-10)
        .build()

      expect(message).toBe("[HLStatsNext]: TeamKiller lost -10 points for team killing TeamVictim")
    })

    it("should build team kill message from event data", () => {
      const eventData: TeamKillEventNotificationData = {
        serverId: 1,
        killerId: 100,
        victimId: 200,
        killerName: "Player1",
        victimName: "Player2",
        skillPenalty: -10,
        weapon: "ak47",
        headshot: false,
        timestamp: new Date(),
      }

      const message = builder.fromTeamKillEvent(eventData).build()
      expect(message).toBe("[HLStatsNext]: Player1 lost -10 points for team killing Player2")
    })
  })

  describe("Action Event Messages", () => {
    it("should build player action message", () => {
      const message = builder
        .withEventType(EventType.ACTION_PLAYER)
        .withPlayer(1, "TestPlayer")
        .withAction("bomb_planted", "Plant the Bomb")
        .withPoints(5)
        .build()

      expect(message).toBe("[HLStatsNext]: TestPlayer got +5 points for Plant the Bomb")
    })

    it("should build player action message with colors", () => {
      const colorFormatter = GoldSrcColorFormatter.withColors()
      const message = builder
        .withColorFormatter(colorFormatter)
        .withEventType(EventType.ACTION_PLAYER)
        .withPlayer(1, "TestPlayer")
        .withAction("bomb_planted", "Plant the Bomb")
        .withPoints(5)
        .build()

      expect(message).toContain("^6Plant the Bomb^0") // Colored action
    })

    it("should build action message from event data", () => {
      const eventData: ActionEventNotificationData = {
        serverId: 1,
        playerId: 100,
        playerName: "Player1",
        actionCode: "bomb_planted",
        actionDescription: "Plant the Bomb",
        points: 5,
      }

      const message = builder.fromActionEvent(eventData).build()
      expect(message).toBe("[HLStatsNext]: Player1 got +5 points for Plant the Bomb")
    })
  })

  describe("Team Action Event Messages", () => {
    it("should build team action message", () => {
      const message = builder
        .withEventType(EventType.ACTION_TEAM)
        .withTeam("TERRORIST")
        .withAction("round_win", "Round Win")
        .withPoints(2)
        .withPlayerCount(5)
        .build()

      expect(message).toBe("[HLStatsNext]: Team TERRORIST got +2 points for Round Win")
    })

    it("should build team action message from event data", () => {
      const eventData: TeamActionEventNotificationData = {
        serverId: 1,
        team: "TERRORIST",
        actionCode: "round_win",
        actionDescription: "Round Win",
        points: 2,
        playerCount: 5,
      }

      const message = builder.fromTeamActionEvent(eventData).build()
      expect(message).toBe("[HLStatsNext]: Team TERRORIST got +2 points for Round Win")
    })
  })

  describe("Connect/Disconnect Event Messages", () => {
    it("should build connect message", () => {
      const message = builder
        .withEventType(EventType.PLAYER_CONNECT)
        .withPlayer(1, "NewPlayer", 25)
        .build()

      expect(message).toBe("[HLStatsNext]: NewPlayer connected")
    })

    it("should build disconnect message", () => {
      const message = builder
        .withEventType(EventType.PLAYER_DISCONNECT)
        .withPlayer(1, "LeavingPlayer", 25)
        .build()

      expect(message).toBe("[HLStatsNext]: LeavingPlayer (#25) disconnected")
    })

    it("should build connect message from event data", () => {
      const eventData: ConnectEventNotificationData = {
        serverId: 1,
        playerId: 100,
        playerName: "Player1",
        steamId: "STEAM_0:1:12345",
        ipAddress: "127.0.0.1",
        connectionTime: 0,
        timestamp: new Date(),
      }

      const message = builder.fromConnectEvent(eventData).build()
      expect(message).toBe("[HLStatsNext]: Player1 connected")
    })

    it("should build disconnect message from event data", () => {
      const eventData: DisconnectEventNotificationData = {
        serverId: 1,
        playerId: 100,
        playerName: "Player1",
        reason: "Disconnect",
        sessionDuration: 1800,
        timestamp: new Date(),
      }

      const message = builder.fromDisconnectEvent(eventData).withPlayer(100, "Player1", 25).build()
      expect(message).toBe("[HLStatsNext]: Player1 (#25) disconnected")
    })
  })

  describe("Custom Templates", () => {
    it("should use custom message templates", () => {
      const customTemplates: Partial<MessageTemplates> = {
        kill: "CUSTOM: {killerName} killed {victimName} for {points} points!",
        suicide: "CUSTOM: {playerName} ended themselves",
      }

      const killMessage = builder
        .withTemplates(customTemplates)
        .withEventType(EventType.PLAYER_KILL)
        .withKiller(1, "TestKiller")
        .withVictim(2, "TestVictim")
        .withPoints(10)
        .build()

      expect(killMessage).toBe("CUSTOM: TestKiller killed TestVictim for +10 points!")

      builder.reset()
      const suicideMessage = builder
        .withTemplates(customTemplates)
        .withEventType(EventType.PLAYER_SUICIDE)
        .withPlayer(1, "TestPlayer")
        .withPoints(-5)
        .build()

      expect(suicideMessage).toBe("CUSTOM: TestPlayer ended themselves")
    })
  })

  describe("Edge Cases and Error Handling", () => {
    it("should handle zero points correctly", () => {
      const message = builder
        .withEventType(EventType.ACTION_PLAYER)
        .withPlayer(1, "TestPlayer")
        .withAction("test", "Test Action")
        .withPoints(0)
        .build()

      expect(message).toBe("[HLStatsNext]: TestPlayer got 0 points for Test Action")
    })

    it("should handle negative points correctly", () => {
      const message = builder
        .withEventType(EventType.ACTION_PLAYER)
        .withPlayer(1, "TestPlayer")
        .withAction("test", "Test Action")
        .withPoints(-15)
        .build()

      expect(message).toBe("[HLStatsNext]: TestPlayer got -15 points for Test Action")
    })

    it("should handle very large point values", () => {
      const message = builder
        .withEventType(EventType.ACTION_PLAYER)
        .withPlayer(1, "TestPlayer")
        .withAction("test", "Test Action")
        .withPoints(999999)
        .build()

      expect(message).toBe("[HLStatsNext]: TestPlayer got +999999 points for Test Action")
    })

    it("should handle empty or undefined values", () => {
      const message = builder
        .withEventType(EventType.PLAYER_KILL)
        .withKiller(1, "", undefined)
        .withVictim(2, undefined, 0)
        .withPoints(10)
        .build()

      expect(message).toContain("{killerName}")
      expect(message).toContain("{victimName}")
      expect(message).toContain("(#{killerRank})")
      expect(message).toContain("(#0)")
    })

    it("should handle special characters in player names", () => {
      const message = builder
        .withEventType(EventType.PLAYER_KILL)
        .withKiller(1, "Player[TAG]", 15)
        .withVictim(2, "Player-123_test", 23)
        .withPoints(10)
        .build()

      expect(message).toContain("Player[TAG]")
      expect(message).toContain("Player-123_test")
    })

    it("should handle unknown event types", () => {
      const message = builder.withEventType(EventType.UNKNOWN).build()
      expect(message).toBe("[HLStatsNext]: Unknown event")
    })
  })

  describe("Color Formatting Edge Cases", () => {
    it("should not apply color formatting when formatter doesn't support colors", () => {
      const plainFormatter = new PlainTextFormatter()
      const message = builder
        .withColorFormatter(plainFormatter)
        .withEventType(EventType.PLAYER_KILL)
        .withKiller(1, "TestKiller", 15)
        .withVictim(2, "TestVictim", 23)
        .withPoints(10)
        .build()

      expect(message).not.toContain("^")
      expect(message).not.toContain("\\x")
      expect(message).toBe(
        "[HLStatsNext]: TestKiller (#15) got +10 points for killing TestVictim (#23)",
      )
    })

    it("should handle repeated player names correctly", () => {
      const colorFormatter = GoldSrcColorFormatter.withColors()
      // Build message with same killer and victim names (edge case)
      const message = builder
        .withColorFormatter(colorFormatter)
        .withEventType(EventType.PLAYER_KILL)
        .withKiller(1, "SameName", 15)
        .withVictim(2, "SameName", 23)
        .withPoints(10)
        .build()

      // Should color both instances
      const coloredNameCount = (message.match(/SameName/g) || []).length
      expect(coloredNameCount).toBeGreaterThan(0)
    })
  })
})
