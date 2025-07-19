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
} from "@/types/common/events"

/**
 * Minimal Counter-Strike (Source / GO) log parser.
 *
 * ✅ PLAYER_CONNECT
 * ✅ PLAYER_DISCONNECT
 * ✅ PLAYER_KILL
 * ✅ PLAYER_SUICIDE
 * ✅ PLAYER_TEAMKILL
 *
 * This is intentionally lightweight - regexes are crude but good enough for a
 * phase-1 prototype. They can be hardened later.
 */
export class CsParser extends BaseParser {
  constructor(game: string) {
    super(game)
  }

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

    // Order matters - check for teamkill first (most specific), then kill, then suicide
    const teamkill = await this.parseTeamkill(logLine, serverId)
    if (teamkill) return { success: true, event: teamkill }

    const kill = await this.parseKill(logLine, serverId)
    if (kill) return { success: true, event: kill }

    const suicide = await this.parseSuicide(logLine, serverId)
    if (suicide) return { success: true, event: suicide }

    // Action events
    const teamAction = await this.parseTeamAction(logLine, serverId)
    if (teamAction) return { success: true, event: teamAction }

    const worldAction = await this.parseWorldAction(logLine, serverId)
    if (worldAction) return { success: true, event: worldAction }

    const playerAction = await this.parsePlayerAction(logLine, serverId)
    if (playerAction) return { success: true, event: playerAction }

    const connect = await this.parseConnect(logLine, serverId)
    if (connect) return { success: true, event: connect }

    const disconnect = await this.parseDisconnect(logLine, serverId)
    if (disconnect) return { success: true, event: disconnect }

    const chat = await this.parseChat(logLine, serverId)
    if (chat) return { success: true, event: chat }

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
    const regex =
      /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><.*?>" connected, address "(.+?)(?::\d+)?"/i
    const match = logLine.match(regex)
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
    const regex =
      /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><.*?>" disconnected(?: \(reason\s+"(.+?)"\))?/i
    const match = logLine.match(regex)
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
    const regex =
      /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>".*?killed "(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>".*?with "(\w+)"( \(headshot\))?/i
    const match = logLine.match(regex)
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
    const regex =
      /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>".*?committed suicide with "(\w+)"/i
    const match = logLine.match(regex)
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
    const regex =
      /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>".*?killed "(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>".*?with "(\w+)"( \(headshot\))?/i
    const match = logLine.match(regex)
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
    const regex =
      /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>"\s+say\s+"([^"]+)"(?:\s+\((dead)\))?/i

    const match = logLine.match(regex)
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
    const regex =
      /^(?:L .+?:\s)?"(.+?)<\d+><(STEAM_[0-9A-Za-z:_]+|BOT)><(\w+)>"(?: \[([+\-0-9\s]+)\])?\s+triggered\s+"([A-Za-z0-9_]+)"/i

    const match = logLine.match(regex)
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
    const regex = /^(?:L .+?:\s)?Team "(\w+)" triggered "([A-Za-z0-9_]+)"/i
    const match = logLine.match(regex)
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
   * Parse world action events e.g.
   * L 07/19/2025 - 15:17:36: World triggered "Round_End"
   */
  private async parseWorldAction(
    logLine: string,
    serverId: number,
  ): Promise<WorldActionEvent | null> {
    const regex = /^(?:L .+?:\s)?World triggered "([A-Za-z0-9_]+)"/i
    const match = logLine.match(regex)
    if (!match) return null

    const actionCode = match[1]!

    const timestamp = this.getCurrentTimestamp()

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
