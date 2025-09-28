/**
 * Counter-Strike Parser Tests
 *
 * Comprehensive test suite for the CS parser covering all event types
 */

import { describe, it, expect, beforeEach } from "vitest"
import { CsParser } from "./cs.parser"
import { EventType } from "@/shared/types/events"
import type { BaseEvent, DualPlayerMeta } from "@/shared/types/events"

// Parser output types (before ID resolution)
interface RawDamageEventData {
  attackerGameUserId: number
  victimGameUserId: number
  weapon: string
  damage: number
  damageArmor: number
  healthRemaining: number
  armorRemaining: number
  hitgroup: string
  attackerTeam: string
  victimTeam: string
}

interface RawDamageEvent extends BaseEvent {
  eventType: EventType.PLAYER_DAMAGE
  data: RawDamageEventData
  meta?: DualPlayerMeta
}
import type { MapChangeEvent, RoundStartEvent } from "@/modules/match/match.types"
import { TestClock } from "@/shared/infrastructure/time/test-clock"
import { DeterministicUuidService } from "@/shared/infrastructure/identifiers/deterministic-uuid.service"
import { setUuidService } from "@/shared/infrastructure/messaging/queue/utils/message-utils"
import type { ServerStateManager, ServerState } from "@/modules/server/state/server-state-manager"

describe("CsParser", () => {
  const serverId = 1
  let parser: CsParser
  let clock: TestClock
  let mockStateManager: ServerStateManager

  beforeEach(() => {
    clock = new TestClock()
    // Initialize UUID service for tests
    setUuidService(new DeterministicUuidService(clock))

    // Create mock state manager
    const serverStates = new Map<number, ServerState>()

    mockStateManager = {
      getServerState: (serverId: number) => {
        if (!serverStates.has(serverId)) {
          serverStates.set(serverId, {
            currentMap: "",
            currentRound: 0,
            matchState: "waiting",
            teamCounts: { terrorists: 0, counterTerrorists: 0, spectators: 0 },
            maxPlayers: 32,
            lastActivity: new Date(),
          })
        }
        return serverStates.get(serverId)!
      },

      updateMap: (serverId: number, mapName: string) => {
        const state = mockStateManager.getServerState(serverId)
        const previousMap = state.currentMap === "" ? undefined : state.currentMap
        state.currentMap = mapName
        return { changed: true, previousMap }
      },

      setWinningTeam: (serverId: number, team: string) => {
        const state = mockStateManager.getServerState(serverId)
        state.lastWinningTeam = team
      },

      startRound: (serverId: number) => {
        const state = mockStateManager.getServerState(serverId)
        state.currentRound += 1
        state.roundStartTime = new Date()
        return { roundNumber: state.currentRound }
      },

      endRound: (serverId: number) => {
        const state = mockStateManager.getServerState(serverId)
        const winningTeam = state.lastWinningTeam
        state.lastWinningTeam = undefined // Clear after retrieving
        return { roundNumber: state.currentRound, winningTeam }
      },
    } as ServerStateManager

    parser = new CsParser("cstrike", clock, mockStateManager)
  })

  describe("parseKillEvent", () => {
    it("should parse a valid kill event", () => {
      const logLine =
        '"Player1<2><STEAM_123><CT>" killed "Player2<3><STEAM_456><TERRORIST>" with "ak47" (headshot)'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).not.toBeNull()
      expect(result.event?.eventType).toBe(EventType.PLAYER_KILL)
      expect(result.event?.data).toEqual({
        killerGameUserId: 2,
        victimGameUserId: 3,
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

  describe("parseDamageEvent", () => {
    it("should parse standard damage event", () => {
      const logLine = `"Player1<2><STEAM_0:1:12345><CT>" attacked "Player2<3><STEAM_0:1:67890><TERRORIST>" with "ak47" (damage "27") (damage_armor "0") (health "73") (armor "100") (hitgroup "chest")`

      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeDefined()
      expect(result.event?.eventType).toBe(EventType.PLAYER_DAMAGE)

      const damageEvent = result.event as RawDamageEvent
      const data = damageEvent.data
      expect(data.attackerGameUserId).toBe(2)
      expect(data.victimGameUserId).toBe(3)
      expect(data.weapon).toBe("ak47")
      expect(data.damage).toBe(27)
      expect(data.damageArmor).toBe(0)
      expect(data.healthRemaining).toBe(73)
      expect(data.armorRemaining).toBe(100)
      expect(data.hitgroup).toBe("chest")
      expect(data.attackerTeam).toBe("CT")
      expect(data.victimTeam).toBe("TERRORIST")
    })

    it("should parse headshot damage event", () => {
      const logLine = `"Sniper<5><STEAM_0:1:11111><CT>" attacked "Target<8><STEAM_0:1:22222><TERRORIST>" with "awp" (damage "448") (damage_armor "0") (health "0") (armor "0") (hitgroup "head")`

      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      const damageEvent = result.event as RawDamageEvent
      const data = damageEvent.data
      expect(data.weapon).toBe("awp")
      expect(data.damage).toBe(448)
      expect(data.hitgroup).toBe("head")
      expect(data.healthRemaining).toBe(0)
    })

    it("should parse damage event without hitgroup", () => {
      const logLine = `"Player1<2><STEAM_0:1:12345><CT>" attacked "Player2<3><STEAM_0:1:67890><TERRORIST>" with "glock" (damage "20") (damage_armor "5") (health "80") (armor "95")`

      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      const damageEvent = result.event as RawDamageEvent
      const data = damageEvent.data
      expect(data.hitgroup).toBe("generic")
      expect(data.damage).toBe(20)
      expect(data.damageArmor).toBe(5)
    })

    it("should handle bot damage events", () => {
      const logLine = `"Bot01<2><BOT><CT>" attacked "Player<3><STEAM_0:1:67890><TERRORIST>" with "m4a1" (damage "30") (damage_armor "10") (health "70") (armor "90") (hitgroup "stomach")`

      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      const damageEvent = result.event as RawDamageEvent
      const meta = damageEvent.meta
      expect(meta?.killer.isBot).toBe(true)
      expect(meta?.victim.isBot).toBe(false)
    })

    it("should handle team damage", () => {
      const logLine = `"Player1<2><STEAM_0:1:12345><CT>" attacked "Player2<3><STEAM_0:1:67890><CT>" with "he_grenade" (damage "50") (damage_armor "0") (health "50") (armor "100") (hitgroup "generic")`

      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      const damageEvent = result.event as RawDamageEvent
      const data = damageEvent.data
      expect(data.attackerTeam).toBe("CT")
      expect(data.victimTeam).toBe("CT")
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
        gameUserId: 2,
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
        gameUserId: 2,
        reason: "Disconnect",
      })
    })

    it("should parse legacy disconnect without reason and slot -1", () => {
      const logLine = '"Flying Martini<-1><><CT>" disconnected'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).not.toBeNull()
      expect(result.event?.eventType).toBe(EventType.PLAYER_DISCONNECT)
      expect(result.event?.data).toEqual({
        gameUserId: -1,
        reason: "",
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
        gameUserId: 2,
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
        gameUserId: 2,
        message: "team message",
        team: "CT",
        isDead: false,
      })
    })
  })

  describe("parseActionEvent", () => {
    it("should parse player action events", () => {
      const logLine = '"Player<2><STEAM_123><TERRORIST>" triggered "Spawned_With_The_Bomb"'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).not.toBeNull()
      expect(result.event?.eventType).toBe(EventType.ACTION_PLAYER)
      expect(result.event?.data).toEqual({
        gameUserId: 2,
        actionCode: "Spawned_With_The_Bomb",
        game: "cstrike",
        team: "TERRORIST",
      })
      expect(result.event?.meta).toEqual({
        steamId: "STEAM_123",
        playerName: "Player",
        isBot: false,
      })
    })

    it("should emit ACTION_PLAYER with canonical code for Planted_The_Bomb", () => {
      const logLine = '"Planter<7><STEAM_0:1:999><TERRORIST>" triggered "Planted_The_Bomb"'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event?.eventType).toBe(EventType.ACTION_PLAYER)
      expect(result.event?.data).toEqual({
        gameUserId: 7,
        actionCode: "Planted_The_Bomb",
        game: "cstrike",
        team: "TERRORIST",
      })
    })

    it("should emit ACTION_PLAYER with canonical code for Defused_The_Bomb", () => {
      const logLine = '"Defuser<12><STEAM_0:0:111><CT>" triggered "Defused_The_Bomb"'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event?.eventType).toBe(EventType.ACTION_PLAYER)
      expect(result.event?.data).toEqual({
        gameUserId: 12,
        actionCode: "Defused_The_Bomb",
        game: "cstrike",
        team: "CT",
      })
    })
  })

  describe("parseTeamActionEvent (non-win)", () => {
    it("should emit ACTION_TEAM with canonical code for Target_Bombed", () => {
      const logLine = 'Team "TERRORIST" triggered "Target_Bombed" (CT "4") (T "5")'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event?.eventType).toBe(EventType.ACTION_TEAM)
      expect(result.event?.data).toEqual({
        team: "TERRORIST",
        actionCode: "Target_Bombed",
        game: "cstrike",
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

    it("should use current map from parser state", () => {
      // Set a map first
      const mapChangeLine = "-------- Mapchange to cs_havana --------"
      parser.parseLine(mapChangeLine, serverId)

      // Now parse a round start
      const roundStartLine = 'World triggered "Round_Start"'
      const result = parser.parseLine(roundStartLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeDefined()
      expect(result.event?.eventType).toBe(EventType.ROUND_START)
      const roundEvent = result.event as RoundStartEvent
      expect(roundEvent.data.map).toBe("cs_havana")
    })

    it("should handle round start without previous map change", () => {
      const roundStartLine = 'World triggered "Round_Start"'
      const result = parser.parseLine(roundStartLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeDefined()
      expect(result.event?.eventType).toBe(EventType.ROUND_START)
      const roundEvent = result.event as RoundStartEvent
      expect(roundEvent.data.map).toBe("")
    })

    it("should persist map across multiple round starts", () => {
      // Set a map
      const mapChangeLine = 'Started map "de_dust2" (CRC "-1352213912")'
      parser.parseLine(mapChangeLine, serverId)

      // First round start
      const firstRoundLine = 'World triggered "Round_Start"'
      const firstResult = parser.parseLine(firstRoundLine, serverId)
      const firstRoundEvent = firstResult.event as RoundStartEvent
      expect(firstRoundEvent.data.map).toBe("de_dust2")

      // Second round start should still have the same map
      const secondResult = parser.parseLine(firstRoundLine, serverId)
      const secondRoundEvent = secondResult.event as RoundStartEvent
      expect(secondRoundEvent.data.map).toBe("de_dust2")
    })
  })

  describe("parseRoundEndEvent", () => {
    it("should parse a round end event", () => {
      const logLine = 'World triggered "Round_End"'
      const result = parser.parseLine(logLine, serverId)
      expect(result.success).toBe(true)
      expect(result.event?.eventType).toBe(EventType.ROUND_END)
    })

    it("should capture winning team from previous team win event", () => {
      // First parse a team win event
      const teamWinLine = 'Team "TERRORIST" triggered "Terrorists_Win" (CT "4") (T "5")'
      parser.parseLine(teamWinLine, serverId)

      // Then parse the round end
      const roundEndLine = 'World triggered "Round_End"'
      const result = parser.parseLine(roundEndLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event?.eventType).toBe(EventType.ROUND_END)
      expect(result.event?.data).toEqual({
        winningTeam: "TERRORIST",
        roundNumber: 0,
      })
    })
  })

  describe("parseTeamWinEvent", () => {
    it("should parse team win events with scores", () => {
      const logLine = 'Team "TERRORIST" triggered "Terrorists_Win" (CT "4") (T "5")'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event?.eventType).toBe(EventType.TEAM_WIN)
      expect(result.event?.data).toEqual({
        winningTeam: "TERRORIST",
        triggerName: "Terrorists_Win",
        score: {
          ct: 4,
          t: 5,
        },
      })
    })

    it("should parse CT win events", () => {
      const logLine = 'Team "CT" triggered "CTs_Win" (CT "6") (T "5")'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event?.eventType).toBe(EventType.TEAM_WIN)
      expect(result.event?.data).toEqual({
        winningTeam: "CT",
        triggerName: "CTs_Win",
        score: {
          ct: 6,
          t: 5,
        },
      })
    })
  })

  describe("parseMapChangeEvent", () => {
    it("should parse mapchange to pattern", () => {
      const logLine = "-------- Mapchange to cs_havana --------"
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeDefined()
      expect(result.event?.eventType).toBe(EventType.MAP_CHANGE)
      const mapEvent = result.event as MapChangeEvent
      expect(mapEvent.data.newMap).toBe("cs_havana")
      expect(mapEvent.data.previousMap).toBeUndefined()
    })

    it("should parse started map pattern", () => {
      const logLine = 'Started map "de_dust2" (CRC "-1352213912")'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeDefined()
      expect(result.event?.eventType).toBe(EventType.MAP_CHANGE)
      const mapEvent = result.event as MapChangeEvent
      expect(mapEvent.data.newMap).toBe("de_dust2")
    })

    it("should track previous map in subsequent changes", () => {
      // First map change
      const firstMapLine = "-------- Mapchange to cs_havana --------"
      const firstResult = parser.parseLine(firstMapLine, serverId)

      expect(firstResult.success).toBe(true)
      const firstMapEvent = firstResult.event as MapChangeEvent
      expect(firstMapEvent.data.newMap).toBe("cs_havana")
      expect(firstMapEvent.data.previousMap).toBeUndefined()

      // Second map change should have previous map
      const secondMapLine = 'Started map "de_dust2" (CRC "-1352213912")'
      const secondResult = parser.parseLine(secondMapLine, serverId)

      expect(secondResult.success).toBe(true)
      const secondMapEvent = secondResult.event as MapChangeEvent
      expect(secondMapEvent.data.newMap).toBe("de_dust2")
      expect(secondMapEvent.data.previousMap).toBe("cs_havana")
    })

    it("should handle changelevel command pattern", () => {
      const logLine = "changelevel: de_mirage"
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeDefined()
      expect(result.event?.eventType).toBe(EventType.MAP_CHANGE)
      const mapEvent = result.event as MapChangeEvent
      expect(mapEvent.data.newMap).toBe("de_mirage")
    })

    it("should handle malformed map change events", () => {
      const logLine = "-------- Mapchange to  --------"
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Could not extract map name")
    })

    it("should handle missing map name in started map pattern", () => {
      const logLine = 'Started map "" (CRC "-1352213912")'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Could not extract map name")
    })
  })

  describe("RCON and Admin Command Events", () => {
    it("should handle RCON command logs silently", () => {
      const logLine =
        'Rcon: "rcon 716044165 adminD5bIpFSQ amx_say [HLStatsNext]: pimpjuice (+1202) killed DevilScream (-1238) with m4a1 for +21 points"'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeNull()
    })

    it("should handle admin command logs silently", () => {
      const logLine =
        '"[0x1] Public CS 1.6 Clan Server<0><><>" triggered "amx_say" (text "[HLStatsNext]: pimpjuice (+1202) killed DevilScream (-1238) with m4a1 for +21 points")'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeNull()
    })

    it("should not confuse RCON logs with kill events", () => {
      // This should be handled by RCON parser, not kill parser
      const logLine = 'Rcon: "amx_say Player1 killed Player2 with ak47"'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeNull()
      // Should not try to parse as kill event
    })

    it("should not confuse admin command logs with kill events", () => {
      // This should be handled by admin command parser, not kill parser
      const logLine = '"Server<0><><>" triggered "amx_say" (text "Player1 killed Player2")'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeNull()
      // Should not try to parse as kill event
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

  describe("Error handling", () => {
    it("should handle exceptions gracefully", () => {
      // Test with a line that might cause internal errors
      const logLine = null as unknown as string
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(false)
      expect(result.event).toBeNull()
      expect(result.error).toBeDefined()
    })
  })
})
