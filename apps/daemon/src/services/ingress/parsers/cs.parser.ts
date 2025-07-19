import { BaseParser, ParseResult } from "./base.parser"
import {
  EventType,
  type PlayerConnectEvent,
  type PlayerDisconnectEvent,
  type PlayerKillEvent,
  type PlayerSuicideEvent,
  type PlayerTeamkillEvent,
  type PlayerChatEvent,
  type ActionPlayerEvent,
  type ActionTeamEvent,
  type WorldActionEvent,
  type MapChangeEvent,
} from "@/types/common/events"

export const IGNORED_PATTERNS = [
  /\[META\]/i,
  /^Server shutdown$/i,
  /^Log file (?:closed|started)/i,
  /^Loading map /i,
  /^Server cvar/i,
  /^Server cvars /i,
] as const

const RE_CONNECT =
  /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><.*?>" connected, address "(.+?)(?::\d+)?"/i
const RE_DISCONNECT =
  /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><.*?>" disconnected(?: \(reason\s+"(.+?)"\))?/i
const RE_KILL =
  /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>".*?killed "(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>".*?with "(\w+)"( \(headshot\))?/i
const RE_SUICIDE =
  /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>".*?committed suicide with "(\w+)"/i
const RE_CHAT =
  /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>"\s+say\s+"([^"]+)"(?:\s+\((dead)\))?/i
const RE_ACTION_PLAYER =
  /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>"(?: \[([+\-0-9\s]+)\])?\s+triggered\s+"([A-Za-z0-9_]+)"/i
const RE_ACTION_TEAM = /^(?:L .+?:\s)?Team "(\w+)" triggered "([A-Za-z0-9_]+)"/i
const RE_MAP_CHANGE = /^(?:L .+?:\s)?Started map "([A-Za-z0-9_]+)" \(CRC "[-0-9]+"\)/i
const RE_ACTION_WORLD = /^(?:L .+?:\s)?World triggered "([A-Za-z0-9_]+)"/i

/**
 * Counter-Strike (Source / GO) log parser with declarative parsing pipeline.
 *
 * Parses real-time game server logs into structured events for statistics tracking.
 * Uses a pre-compiled regex approach for performance and a declarative pipeline
 * for maintainability.
 *
 * Supported Events:
 * - PLAYER_CONNECT: Player joins server
 * - PLAYER_DISCONNECT: Player leaves server
 * - PLAYER_KILL: Player kills another player (different teams)
 * - PLAYER_SUICIDE: Player kills themselves
 * - PLAYER_TEAMKILL: Player kills teammate (same team)
 * - CHAT_MESSAGE: Player chat messages
 * - ACTION_PLAYER: Player-triggered game events (bomb defuse, etc.)
 * - ACTION_TEAM: Team-wide events (bomb planted, etc.)
 * - ACTION_WORLD: World/round events (round start/end)
 * - MAP_CHANGE: Server map changes
 *
 * Ignored Patterns:
 * - Meta-mod logs, server cvars, shutdown messages
 * - Log file open/close events
 * - Map loading messages
 *
 * @example
 * ```typescript
 * const parser = new CsParser("cstrike")
 * const result = await parser.parse(logLine, serverId)
 * if (result.success) {
 *   // Process structured event
 *   await eventProcessor.process(result.event)
 * }
 * ```
 */
export class CsParser extends BaseParser {
  constructor(game: string) {
    super(game)
  }

  /* Track the last known map per server so we can emit previousMap in MAP_CHANGE */
  private readonly currentMaps: Map<number, string> = new Map()

  canParse(rawLogLine: string): boolean {
    const logLine = this.normaliseLogLine(rawLogLine)

    if (logLine.startsWith("L ")) {
      return true
    }

    // Provide trimmed context for easier debugging
    console.warn(`Unsupported log line: ${logLine}`)
    return false
  }

  async parse(rawLogLine: string, serverId: number): Promise<ParseResult> {
    const logLine = this.normaliseLogLine(rawLogLine)

    // Fast-fail for intentionally ignored noise (keeps downstream logic clean)
    const payload = logLine.replace(/^L\s+[^:]+:\s*/, "")
    if (IGNORED_PATTERNS.some((pat) => pat.test(payload))) {
      return { success: false, error: "IGNORED" }
    }

    // Declarative parsing pipeline – the order of functions defines precedence.
    const pipeline: Array<
      (line: string, sid: number) => Promise<import("@/types/common/events").GameEvent | null>
    > = [
      this.parseTeamkill,
      this.parseKill,
      this.parseSuicide,
      this.parseTeamAction,
      this.parseMapChange,
      this.parseWorldOrRoundAction,
      this.parsePlayerAction,
      this.parseConnect,
      this.parseDisconnect,
      this.parseChat,
    ]

    for (const fn of pipeline) {
      // Bind to preserve `this` context for private methods
      const event = await fn.call(this, logLine, serverId)
      if (event) {
        return { success: true, event }
      }
    }

    return { success: false, error: "Unsupported log line" }
  }

  private async parseConnect(
    logLine: string,
    serverId: number,
  ): Promise<PlayerConnectEvent | null> {
    /*
      Example:
      L 07/15/2024 - 22:35:10: "PlayerName<1><STEAM_1:0:12345><CT>" STEAM USERID validated
      L 07/15/2024 - 22:35:10: "PlayerName<1><STEAM_1:0:12345><>" connected, address "192.168.1.100:27005"
    */
    const match = logLine.match(RE_CONNECT)
    if (!match) return null

    const playerName = match[1]!
    const steamId = match[2]!
    const ipAddress = match[3]!
    const isBot = steamId.toUpperCase() === "BOT"

    const timestamp = this.getCurrentTimestamp()

    const event: PlayerConnectEvent = {
      eventType: EventType.PLAYER_CONNECT,
      timestamp,
      serverId,
      data: {
        playerId: 0, // Will be resolved later by PlayerHandler
        steamId,
        playerName: this.sanitizeString(playerName),
        ipAddress,
      },
      meta: {
        steamId,
        playerName: this.sanitizeString(playerName),
        isBot,
      },
    }

    return event
  }

  private async parseDisconnect(
    logLine: string,
    serverId: number,
  ): Promise<PlayerDisconnectEvent | null> {
    /*
      Example:
      L 07/15/2024 - 22:35:10: "PlayerName<1><STEAM_1:0:12345><CT>" disconnected (reason "Client left game")
    */
    const match = logLine.match(RE_DISCONNECT)
    if (!match) return null

    const reason = match[3]

    const timestamp = this.getCurrentTimestamp()

    const event: PlayerDisconnectEvent = {
      eventType: EventType.PLAYER_DISCONNECT,
      timestamp,
      serverId,
      data: {
        playerId: 0, // Unknown until we correlate - optional in handler
        reason,
      },
    }

    return event
  }

  private async parseKill(logLine: string, serverId: number): Promise<PlayerKillEvent | null> {
    /*
      Example:
      L 07/15/2024 - 22:35:05: "Killer<2><STEAM_1:0:111><TERRORIST>" [93 303 73] killed "Victim<3><STEAM_1:0:222><CT>" [35 302 73] with "ak47" (headshot)
    */
    const match = logLine.match(RE_KILL)
    if (!match) return null

    const killerName = match[1]!
    const killerSteamId = match[2]!
    const killerTeam = match[3]!
    const victimName = match[4]!
    const victimSteamId = match[5]!
    const victimTeam = match[6]!
    const weapon = match[7]!
    const headshotGroup = match[8]

    // Skip if this is a teamkill (same team)
    if (killerTeam === victimTeam) return null

    const timestamp = this.getCurrentTimestamp()

    const event: PlayerKillEvent = {
      eventType: EventType.PLAYER_KILL,
      timestamp,
      serverId,
      data: {
        // player IDs will be resolved by PlayerHandler downstream
        killerId: 0,
        victimId: 0,
        weapon,
        headshot: Boolean(headshotGroup),
        killerTeam,
        victimTeam,
      },
      meta: {
        killer: {
          steamId: killerSteamId,
          playerName: this.sanitizeString(killerName),
          isBot: killerSteamId.toUpperCase() === "BOT",
        },
        victim: {
          steamId: victimSteamId,
          playerName: this.sanitizeString(victimName),
          isBot: victimSteamId.toUpperCase() === "BOT",
        },
      },
    }

    return event
  }

  private async parseSuicide(
    logLine: string,
    serverId: number,
  ): Promise<PlayerSuicideEvent | null> {
    /*
      Example:
      L 07/15/2024 - 22:35:05: "Player<2><STEAM_1:0:111><TERRORIST>" [93 303 73] committed suicide with "world"
    */
    const match = logLine.match(RE_SUICIDE)
    if (!match) return null

    const playerName = match[1]!
    const steamId = match[2]!
    const team = match[3]!
    const weapon = match[4]!

    const timestamp = this.getCurrentTimestamp()

    const event: PlayerSuicideEvent = {
      eventType: EventType.PLAYER_SUICIDE,
      timestamp,
      serverId,
      data: {
        playerId: 0, // Will be resolved by PlayerHandler
        weapon,
        team,
      },
      meta: {
        steamId,
        playerName: this.sanitizeString(playerName),
        isBot: steamId.toUpperCase() === "BOT",
      },
    }

    return event
  }

  private async parseTeamkill(
    logLine: string,
    serverId: number,
  ): Promise<PlayerTeamkillEvent | null> {
    /*
      Example:
      L 07/15/2024 - 22:35:05: "Killer<2><STEAM_1:0:111><TERRORIST>" [93 303 73] killed "Victim<3><STEAM_1:0:222><TERRORIST>" [35 302 73] with "ak47" (headshot)
      Note: Same team for both players
    */
    const match = logLine.match(RE_KILL)
    if (!match) return null

    const killerName = match[1]!
    const killerSteamId = match[2]!
    const killerTeam = match[3]!
    const victimName = match[4]!
    const victimSteamId = match[5]!
    const victimTeam = match[6]!
    const weapon = match[7]!
    const headshotGroup = match[8]

    // Only process if same team (teamkill)
    if (killerTeam !== victimTeam) return null

    const timestamp = this.getCurrentTimestamp()

    const event: PlayerTeamkillEvent = {
      eventType: EventType.PLAYER_TEAMKILL,
      timestamp,
      serverId,
      data: {
        killerId: 0, // Will be resolved by PlayerHandler
        victimId: 0, // Will be resolved by PlayerHandler
        weapon,
        headshot: Boolean(headshotGroup),
        team: killerTeam,
      },
      meta: {
        killer: {
          steamId: killerSteamId,
          playerName: this.sanitizeString(killerName),
          isBot: killerSteamId.toUpperCase() === "BOT",
        },
        victim: {
          steamId: victimSteamId,
          playerName: this.sanitizeString(victimName),
          isBot: victimSteamId.toUpperCase() === "BOT",
        },
      },
    }

    return event
  }

  /*
   * Parse player chat messages
   * Example:
   * L 06/28/2025 - 09:09:32: "goat<5><BOT><CT>" say "Too bad NNBot is discontinued..." (dead)
   */
  private async parseChat(logLine: string, serverId: number): Promise<PlayerChatEvent | null> {
    const match = logLine.match(RE_CHAT)
    if (!match) return null

    const playerName = match[1]!
    const steamId = match[2]!
    const team = match[3]!
    const message = match[4]!
    const isDead = Boolean(match[5])

    const isBot = steamId.toUpperCase() === "BOT"

    const timestamp = this.getCurrentTimestamp()

    const event: PlayerChatEvent = {
      eventType: EventType.CHAT_MESSAGE,
      timestamp,
      serverId,
      data: {
        playerId: 0,
        message,
        team,
        isDead,
        messageMode: isDead ? 1 : 0,
      },
      meta: {
        steamId,
        playerName: this.sanitizeString(playerName),
        isBot,
      },
    }

    return event
  }

  /**
   * Parse player-triggered action events e.g.
   * L 07/19/2025 - 15:17:36: "Player<28><STEAM_1:0:111><CT>" [93 303 73] triggered "Defused_The_Bomb"
   */
  private async parsePlayerAction(
    logLine: string,
    serverId: number,
  ): Promise<ActionPlayerEvent | null> {
    const match = logLine.match(RE_ACTION_PLAYER)
    if (!match) return null

    const playerName = match[1]!
    const steamId = match[2]!
    const team = match[3]!
    const positionStr = match[4]
    const actionCode = match[5]!

    const position = positionStr ? this.parsePosition(positionStr.trim()) : undefined
    const isBot = steamId.toUpperCase() === "BOT"

    const timestamp = this.getCurrentTimestamp()

    const event: ActionPlayerEvent = {
      eventType: EventType.ACTION_PLAYER,
      timestamp,
      serverId,
      data: {
        playerId: 0,
        actionCode,
        game: this.gameType,
        team,
        position,
      },
      meta: {
        steamId,
        playerName: this.sanitizeString(playerName),
        isBot,
      },
    }

    return event
  }

  /**
   * Parse team-wide action events e.g.
   * L 07/19/2025 - 15:17:36: Team "CT" triggered "Bomb_Defused" (CT "6") (T "3")
   */
  private async parseTeamAction(
    logLine: string,
    serverId: number,
  ): Promise<ActionTeamEvent | null> {
    const match = logLine.match(RE_ACTION_TEAM)
    if (!match) return null

    const team = match[1]!
    const actionCode = match[2]!

    const timestamp = this.getCurrentTimestamp()

    const event: ActionTeamEvent = {
      eventType: EventType.ACTION_TEAM,
      timestamp,
      serverId,
      data: {
        team,
        actionCode,
        game: this.gameType,
      },
    }

    return event
  }

  /**
   * Parse map change lines e.g.
   *  L 07/19/2025 - 15:37:41: Started map "de_dust" (CRC "-1641307065")
   */
  private async parseMapChange(logLine: string, serverId: number): Promise<MapChangeEvent | null> {
    const match = logLine.match(RE_MAP_CHANGE)
    if (!match) return null

    const newMap = match[1]!
    const previousMap = this.currentMaps.get(serverId)

    // Update cache
    this.currentMaps.set(serverId, newMap)

    const timestamp = this.getCurrentTimestamp()

    const event: MapChangeEvent = {
      eventType: EventType.MAP_CHANGE,
      timestamp,
      serverId,
      data: {
        previousMap,
        newMap,
        playerCount: 0, // Could be set later if we parse cvar/scoreboard lines
      },
    }

    return event
  }

  private async parseWorldOrRoundAction(
    logLine: string,
    serverId: number,
  ): Promise<
    | WorldActionEvent
    | import("@/types/common/events").RoundStartEvent
    | import("@/types/common/events").RoundEndEvent
    | null
  > {
    const match = logLine.match(RE_ACTION_WORLD)
    if (!match) return null

    const actionCode = match[1]!
    const timestamp = this.getCurrentTimestamp()

    switch (actionCode) {
      case "Round_Start":
      case "Game_Commencing": {
        return {
          eventType: EventType.ROUND_START,
          timestamp,
          serverId,
          data: {
            map: "", // can be filled by map-context parser later
            roundNumber: 0,
            maxPlayers: 0,
          },
        }
      }
      case "Round_End":
      case "Round_Draw": {
        return {
          eventType: EventType.ROUND_END,
          timestamp,
          serverId,
          data: {
            winningTeam: actionCode === "Round_Draw" ? "DRAW" : undefined,
          },
        }
      }
      default: {
        const event: WorldActionEvent = {
          eventType: EventType.ACTION_WORLD,
          timestamp,
          serverId,
          data: {
            actionCode,
            game: this.gameType,
          },
        }
        return event
      }
    }
  }
}
