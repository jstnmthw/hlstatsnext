import { describe, it, expect } from "vitest"
import { StructuredCommandBuilder } from "./structured-command.builder"
import type {
  KillEventNotificationData,
  SuicideEventNotificationData,
  TeamKillEventNotificationData,
  ActionEventNotificationData,
  TeamActionEventNotificationData,
  ConnectEventNotificationData,
  DisconnectEventNotificationData,
} from "../types/notification.types"

describe("StructuredCommandBuilder", () => {
  describe("escapeString", () => {
    it("should escape quotes in strings", () => {
      // Access private method through type assertion for testing
      const escaped = (
        StructuredCommandBuilder as unknown as {
          escapeString: (value: string | undefined) => string
        }
      ).escapeString('Player"Name')
      expect(escaped).toBe('"Player\\"Name"')
    })

    it("should return empty quotes for undefined", () => {
      const escaped = (
        StructuredCommandBuilder as unknown as {
          escapeString: (value: string | undefined) => string
        }
      ).escapeString(undefined)
      expect(escaped).toBe('""')
    })

    it("should return empty quotes for empty string", () => {
      const escaped = (
        StructuredCommandBuilder as unknown as {
          escapeString: (value: string | undefined) => string
        }
      ).escapeString("")
      expect(escaped).toBe('""')
    })

    it("should wrap normal strings in quotes", () => {
      const escaped = (
        StructuredCommandBuilder as unknown as {
          escapeString: (value: string | undefined) => string
        }
      ).escapeString("PlayerName")
      expect(escaped).toBe('"PlayerName"')
    })
  })

  describe("buildKillCommand", () => {
    it("should build kill command for broadcast", () => {
      const data: KillEventNotificationData = {
        serverId: 1,
        killerId: 5,
        victimId: 12,
        killerName: "ProPlayer",
        victimName: "NoobPlayer",
        killerSkill: 1500,
        victimSkill: 1450,
        skillAdjustment: {
          killerChange: 15,
          victimChange: -15,
        },
        weapon: "ak47",
        headshot: false,
      }

      const command = StructuredCommandBuilder.buildKillCommand(data)
      expect(command).toBe('hlx_event 0 KILL 5 "ProPlayer" 1500 12 "NoobPlayer" 1450 15 ak47 0')
    })

    it("should build kill command with headshot", () => {
      const data: KillEventNotificationData = {
        serverId: 1,
        killerId: 5,
        victimId: 12,
        killerName: "HeadshotKing",
        victimName: "Victim",
        killerSkill: 2000,
        victimSkill: 1800,
        skillAdjustment: {
          killerChange: 20,
          victimChange: -20,
        },
        weapon: "deagle",
        headshot: true,
      }

      const command = StructuredCommandBuilder.buildKillCommand(data)
      expect(command).toBe('hlx_event 0 KILL 5 "HeadshotKing" 2000 12 "Victim" 1800 20 deagle 1')
    })

    it("should build kill command for specific target", () => {
      const data: KillEventNotificationData = {
        serverId: 1,
        killerId: 5,
        victimId: 12,
        killerName: "Player1",
        victimName: "Player2",
        skillAdjustment: {
          killerChange: 10,
          victimChange: -10,
        },
      }

      const command = StructuredCommandBuilder.buildKillCommand(data, 5)
      expect(command).toBe('hlx_event 5 KILL 5 "Player1" 0 12 "Player2" 0 10 unknown 0')
    })

    it("should handle missing optional fields", () => {
      const data: KillEventNotificationData = {
        serverId: 1,
        killerId: 5,
        victimId: 12,
        skillAdjustment: {
          killerChange: 15,
          victimChange: -15,
        },
      }

      const command = StructuredCommandBuilder.buildKillCommand(data)
      expect(command).toBe('hlx_event 0 KILL 5 "" 0 12 "" 0 15 unknown 0')
    })
  })

  describe("buildSuicideCommand", () => {
    it("should build suicide command for broadcast", () => {
      const data: SuicideEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "DepressedPlayer",
        playerSkill: 1500,
        skillPenalty: 5,
      }

      const command = StructuredCommandBuilder.buildSuicideCommand(data)
      expect(command).toBe('hlx_event 0 SUICIDE 5 "DepressedPlayer" 1500 5')
    })

    it("should build suicide command for specific target", () => {
      const data: SuicideEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "Player",
        playerSkill: 1000,
        skillPenalty: 2,
      }

      const command = StructuredCommandBuilder.buildSuicideCommand(data, 10)
      expect(command).toBe('hlx_event 10 SUICIDE 5 "Player" 1000 2')
    })
  })

  describe("buildTeamKillCommand", () => {
    it("should build teamkill command", () => {
      const data: TeamKillEventNotificationData = {
        serverId: 1,
        killerId: 5,
        victimId: 12,
        killerName: "TeamKiller",
        victimName: "TeamMate",
        weapon: "m4a1",
        headshot: false,
        skillPenalty: 10,
      }

      const command = StructuredCommandBuilder.buildTeamKillCommand(data)
      expect(command).toBe('hlx_event 0 TEAMKILL 5 "TeamKiller" 12 "TeamMate" 10')
    })
  })

  describe("buildActionCommand", () => {
    it("should build action command", () => {
      const data: ActionEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "Bomber",
        playerSkill: 1500,
        actionCode: "bomb_planted",
        actionDescription: "Planted the bomb",
        points: 5,
      }

      const command = StructuredCommandBuilder.buildActionCommand(data)
      expect(command).toBe('hlx_event 0 ACTION 5 "Bomber" 1500 "bomb_planted" "Planted the bomb" 5')
    })

    it("should handle special characters in action description", () => {
      const data: ActionEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "Player",
        playerSkill: 1000,
        actionCode: "special_action",
        actionDescription: 'Action with "quotes"',
        points: 10,
      }

      const command = StructuredCommandBuilder.buildActionCommand(data)
      expect(command).toBe(
        'hlx_event 0 ACTION 5 "Player" 1000 "special_action" "Action with \\"quotes\\"" 10',
      )
    })
  })

  describe("buildTeamActionCommand", () => {
    it("should build team action command", () => {
      const data: TeamActionEventNotificationData = {
        serverId: 1,
        team: "TERRORIST",
        actionCode: "round_win",
        actionDescription: "Won the round",
        points: 5,
        playerCount: 4,
      }

      const command = StructuredCommandBuilder.buildTeamActionCommand(data)
      expect(command).toBe('hlx_event 0 TEAM_ACTION "TERRORIST" "round_win" "Won the round" 5 4')
    })

    it("should handle missing player count", () => {
      const data: TeamActionEventNotificationData = {
        serverId: 1,
        team: "CT",
        actionCode: "objective",
        actionDescription: "Completed objective",
        points: 10,
      }

      const command = StructuredCommandBuilder.buildTeamActionCommand(data)
      expect(command).toBe('hlx_event 0 TEAM_ACTION "CT" "objective" "Completed objective" 10 0')
    })
  })

  describe("buildConnectCommand", () => {
    it("should build connect command", () => {
      const data: ConnectEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "NewPlayer",
        playerCountry: "United States",
        ipAddress: "192.168.1.1",
        connectionTime: 1234567890,
      }

      const command = StructuredCommandBuilder.buildConnectCommand(data)
      expect(command).toBe('hlx_event 0 CONNECT 5 "NewPlayer" "United States"')
    })

    it("should handle missing country", () => {
      const data: ConnectEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "Player",
        ipAddress: "192.168.1.1",
        connectionTime: 1234567890,
      }

      const command = StructuredCommandBuilder.buildConnectCommand(data)
      expect(command).toBe('hlx_event 0 CONNECT 5 "Player" ""')
    })
  })

  describe("buildDisconnectCommand", () => {
    it("should build disconnect command", () => {
      const data: DisconnectEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "LeavingPlayer",
        reason: "Quit",
        sessionDuration: 3600,
      }

      const command = StructuredCommandBuilder.buildDisconnectCommand(data)
      expect(command).toBe('hlx_event 0 DISCONNECT 5 "LeavingPlayer" 3600')
    })

    it("should handle specific target", () => {
      const data: DisconnectEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "Player",
        reason: "Timeout",
        sessionDuration: 1800,
      }

      const command = StructuredCommandBuilder.buildDisconnectCommand(data, 10)
      expect(command).toBe('hlx_event 10 DISCONNECT 5 "Player" 1800')
    })
  })

  describe("buildRankCommand", () => {
    it("should build rank command", () => {
      const command = StructuredCommandBuilder.buildRankCommand(5, 42, 1243, 1850, 5)
      expect(command).toBe("hlx_event 5 RANK 5 42 1243 1850")
    })

    it("should build rank command for broadcast", () => {
      const command = StructuredCommandBuilder.buildRankCommand(10, 1, 100, 2500, 0)
      expect(command).toBe("hlx_event 0 RANK 10 1 100 2500")
    })
  })

  describe("buildStatsCommand", () => {
    it("should build stats command", () => {
      const command = StructuredCommandBuilder.buildStatsCommand(
        5,
        42,
        1243,
        1850,
        150,
        60,
        2.5,
        75,
        25,
        5,
      )
      expect(command).toBe("hlx_event 5 STATS 5 42 1243 1850 150 60 2.50 75 25")
    })

    it("should format KDR to 2 decimal places", () => {
      const command = StructuredCommandBuilder.buildStatsCommand(
        5,
        10,
        100,
        2000,
        100,
        33,
        3.030303,
        80,
        30,
        5,
      )
      expect(command).toBe("hlx_event 5 STATS 5 10 100 2000 100 33 3.03 80 30")
    })

    it("should handle zero deaths (infinite KDR)", () => {
      const command = StructuredCommandBuilder.buildStatsCommand(
        5,
        1,
        100,
        3000,
        50,
        0,
        Infinity,
        90,
        40,
        5,
      )
      expect(command).toBe("hlx_event 5 STATS 5 1 100 3000 50 0 Infinity 90 40")
    })
  })

  describe("buildMessageCommand", () => {
    it("should build message command for broadcast", () => {
      const command = StructuredCommandBuilder.buildMessageCommand(
        "Server will restart in 5 minutes",
      )
      expect(command).toBe('hlx_event 0 MESSAGE "Server will restart in 5 minutes"')
    })

    it("should build message command for specific target", () => {
      const command = StructuredCommandBuilder.buildMessageCommand("Welcome to the server!", 5)
      expect(command).toBe('hlx_event 5 MESSAGE "Welcome to the server!"')
    })

    it("should escape quotes in message", () => {
      const command = StructuredCommandBuilder.buildMessageCommand('Message with "quotes"')
      expect(command).toBe('hlx_event 0 MESSAGE "Message with \\"quotes\\""')
    })
  })

  describe("buildAnnouncementCommand", () => {
    it("should build announcement command", () => {
      const command = StructuredCommandBuilder.buildAnnouncementCommand(
        "Welcome to HLStatsNext Server!",
      )
      expect(command).toBe("hlx_announce Welcome to HLStatsNext Server!")
    })

    it("should handle long announcements", () => {
      const longMessage =
        "This is a very long announcement that contains a lot of text and information"
      const command = StructuredCommandBuilder.buildAnnouncementCommand(longMessage)
      expect(command).toBe(`hlx_announce ${longMessage}`)
    })
  })
})
