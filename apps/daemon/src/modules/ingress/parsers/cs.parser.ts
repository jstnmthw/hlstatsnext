/**
 * Counter-Strike Parser
 *
 * Parses Counter-Strike game server logs into structured events.
 */

import type { ParseResult } from "./base.parser"
import type { BaseEvent } from "@/shared/types/events"
import type { IClock } from "@/shared/infrastructure/time/clock.interface"
import { BaseParser } from "./base.parser"
import { EventType } from "@/shared/types/events"
import { GameConfig } from "@/config/game.config"
import {
  generateMessageId,
  generateCorrelationId,
} from "@/shared/infrastructure/messaging/queue/utils/message-utils"

export class CsParser extends BaseParser {
  // Track the last winning team for Round_End events
  private lastWinningTeam: string | undefined

  // Track the current map for Round_Start events
  private currentMap: string = ""

  // Parser strategy map for different log line patterns
  private readonly parserStrategies: Array<{
    patterns: string[]
    handler: (line: string, serverId: number) => ParseResult
  }> = [
    {
      patterns: [" killed "],
      handler: (line, serverId) => this.parseKillEvent(line, serverId),
    },
    {
      patterns: [" attacked "],
      handler: (line, serverId) => this.parseDamageEvent(line, serverId),
    },
    {
      patterns: [" committed suicide with ", " killed self "],
      handler: (line, serverId) => this.parseSuicideEvent(line, serverId),
    },
    {
      patterns: [" connected, address "],
      handler: (line, serverId) => this.parseConnectEvent(line, serverId),
    },
    {
      patterns: [" entered the game"],
      handler: (line, serverId) => this.parseEnterEvent(line, serverId),
    },
    {
      patterns: [" disconnected (reason ", " disconnected"],
      handler: (line, serverId) => this.parseDisconnectEvent(line, serverId),
    },
    {
      patterns: [" joined team ", " changed team to "],
      handler: (line, serverId) => this.parseChangeTeamEvent(line, serverId),
    },
    {
      patterns: [" changed role to ", " changed role "],
      handler: (line, serverId) => this.parseChangeRoleEvent(line, serverId),
    },
    {
      patterns: [" changed name to "],
      handler: (line, serverId) => this.parseChangeNameEvent(line, serverId),
    },
    {
      patterns: [" say ", " say_team "],
      handler: (line, serverId) => this.parseChatEvent(line, serverId),
    },
    {
      patterns: ["Mapchange to ", "Started map ", "changelevel:"],
      handler: (line, serverId) => this.parseMapChangeEvent(line, serverId),
    },
    {
      patterns: ['World triggered "Round_Start"'],
      handler: (line, serverId) => this.parseRoundStartEvent(line, serverId),
    },
    {
      patterns: ['triggered "Terrorists_Win"', 'triggered "CTs_Win"'],
      handler: (line, serverId) => this.parseTeamWinEvent(line, serverId),
    },
    {
      patterns: ['World triggered "Round_End"'],
      handler: (line, serverId) => this.parseRoundEndEvent(line, serverId),
    },
  ]

  constructor(game: string = GameConfig.getDefaultGame(), clock: IClock) {
    super(game, clock)
  }

  parseLine(logLine: string, serverId: number): ParseResult {
    try {
      // Remove timestamp prefix if present
      const cleanLine = logLine.replace(/^L \d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}:\d{2}: /, "")

      // Try pattern-based parsing first
      const strategyResult = this.tryParseWithStrategies(cleanLine, serverId)
      if (strategyResult) {
        return strategyResult
      }

      // Handle special cases that need custom logic
      const specialResult = this.tryParseSpecialCases(cleanLine, serverId)
      if (specialResult) {
        return specialResult
      }

      // Default: unhandled event type
      return { event: null, success: true }
    } catch (error) {
      return {
        event: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private tryParseWithStrategies(cleanLine: string, serverId: number): ParseResult | null {
    for (const strategy of this.parserStrategies) {
      if (strategy.patterns.some((pattern) => cleanLine.includes(pattern))) {
        return strategy.handler(cleanLine, serverId)
      }
    }
    return null
  }

  private tryParseSpecialCases(cleanLine: string, serverId: number): ParseResult | null {
    // Player action triggers (exclude world events) - needs custom logic
    if (cleanLine.includes('triggered "') && !cleanLine.includes("World triggered")) {
      // Player-triggered ACTION_PLAYER
      const actionResult = this.parseActionEvent(cleanLine, serverId)
      if (actionResult.success && actionResult.event) {
        return actionResult
      }

      // Team-triggered non-win ACTION_TEAM
      const teamActionResult = this.parseTeamActionEvent(cleanLine, serverId)
      if (teamActionResult.success && teamActionResult.event) {
        return teamActionResult
      }
      // Fall through to other event parsing if not an action
    }

    return null
  }

  private parseKillEvent(logLine: string, serverId: number): ParseResult {
    // Example: "Player1<2><STEAM_ID><CT>" killed "Player2<3><STEAM_ID><TERRORIST>" with "ak47" (headshot)
    const killRegex =
      /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" killed "([^"]+)<(\d+)><([^>]+)><([^>]*)>" with "([^"]+)"( \(headshot\))?/
    const match = logLine.match(killRegex)

    if (!match) {
      return { event: null, success: false, error: "Could not parse kill event" }
    }

    const [
      ,
      killerName,
      killerIdStr,
      killerSteamId,
      killerTeam,
      victimName,
      victimIdStr,
      victimSteamId,
      victimTeam,
      weapon,
      headshot,
    ] = match

    if (
      !killerName ||
      !killerIdStr ||
      !killerSteamId ||
      killerTeam === undefined ||
      !victimName ||
      !victimIdStr ||
      !victimSteamId ||
      victimTeam === undefined ||
      !weapon
    ) {
      return { event: null, success: false, error: "Missing required fields in kill event" }
    }

    const killerId = parseInt(killerIdStr)
    const victimId = parseInt(victimIdStr)

    if (isNaN(killerId) || isNaN(victimId)) {
      return { event: null, success: false, error: "Invalid player ID in kill event" }
    }

    const event: BaseEvent = {
      eventType: EventType.PLAYER_KILL,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      eventId: generateMessageId(),
      correlationId: generateCorrelationId(),
      data: {
        killerId,
        victimId,
        weapon,
        headshot: !!headshot,
        killerTeam,
        victimTeam,
      },
      meta: {
        killer: {
          steamId: killerSteamId,
          playerName: killerName,
          isBot: killerSteamId === "BOT",
        },
        victim: {
          steamId: victimSteamId,
          playerName: victimName,
          isBot: victimSteamId === "BOT",
        },
      },
    }

    return { event, success: true }
  }

  private parseDamageEvent(logLine: string, serverId: number): ParseResult {
    // Example: "Player1<2><STEAM_ID><CT>" attacked "Player2<3><STEAM_ID><TERRORIST>" with "ak47" (damage "27") (damage_armor "0") (health "73") (armor "100") (hitgroup "chest")
    const damageRegex =
      /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" attacked "([^"]+)<(\d+)><([^>]+)><([^>]*)>" with "([^"]+)" \(damage "(\d+)"\) \(damage_armor "(\d+)"\) \(health "(\d+)"\) \(armor "(\d+)"\)(?:\s+\(hitgroup "([^"]+)"\))?/
    let match = logLine.match(damageRegex)

    // Fallback tolerant regex for variant spacing/order
    if (!match) {
      const tolerant =
        /"([^"]+)<(\d+)>[^"]*" attacked "([^"]+)<(\d+)>[^"]*" with "([^"]+)" .*?\(damage "(\d+)"\).*?\(damage_armor "(\d+)"\).*?\(health "(\d+)"\).*?\(armor "(\d+)"\)(?:.*?\(hitgroup "([^"]+)"\))?/
      match = logLine.match(tolerant)
    }

    if (!match) {
      return { event: null, success: false, error: "Could not parse damage event" }
    }

    const [
      ,
      attackerName,
      attackerIdStr,
      attackerSteamId,
      attackerTeam,
      victimName,
      victimIdStr,
      victimSteamId,
      victimTeam,
      weapon,
      damage,
      damageArmor,
      healthRemaining,
      armorRemaining,
      hitgroup,
    ] = match

    if (
      !attackerName ||
      !attackerIdStr ||
      !attackerSteamId ||
      !victimName ||
      !victimIdStr ||
      !victimSteamId
    ) {
      return { event: null, success: false, error: "Missing required fields in damage event" }
    }

    const attackerId = parseInt(attackerIdStr)
    const victimId = parseInt(victimIdStr)

    if (isNaN(attackerId) || isNaN(victimId)) {
      return { event: null, success: false, error: "Invalid player ID in damage event" }
    }

    const event: BaseEvent = {
      eventType: EventType.PLAYER_DAMAGE,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      eventId: generateMessageId(),
      correlationId: generateCorrelationId(),
      data: {
        attackerId,
        victimId,
        weapon,
        damage: parseInt(damage || "0") || 0,
        damageArmor: parseInt(damageArmor || "0") || 0,
        healthRemaining: parseInt(healthRemaining || "0") || 0,
        armorRemaining: parseInt(armorRemaining || "0") || 0,
        hitgroup: hitgroup || "generic",
        attackerTeam,
        victimTeam,
      },
      meta: {
        killer: {
          steamId: attackerSteamId,
          playerName: attackerName,
          isBot: attackerSteamId === "BOT",
        },
        victim: {
          steamId: victimSteamId,
          playerName: victimName,
          isBot: victimSteamId === "BOT",
        },
      },
    }

    return { event, success: true }
  }

  private parseSuicideEvent(logLine: string, serverId: number): ParseResult {
    // Example: "Player<2><STEAM_ID><CT>" committed suicide with "worldspawn"
    const regex = /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" committed suicide with "([^"]+)"/i
    const match = logLine.match(regex)

    if (!match) {
      return { event: null, success: false }
    }

    const [, playerName, playerIdStr, steamId, team, weapon] = match
    const playerId = parseInt(playerIdStr || "")

    if (!playerName || !playerIdStr || !steamId || Number.isNaN(playerId)) {
      return { event: null, success: false, error: "Missing required fields in suicide event" }
    }

    const event: BaseEvent = {
      eventType: EventType.PLAYER_SUICIDE,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      eventId: generateMessageId(),
      correlationId: generateCorrelationId(),
      data: {
        playerId,
        team: team || "UNKNOWN",
        weapon: weapon || "world",
      },
      meta: {
        steamId: steamId || "",
        playerName,
        isBot: (steamId || "") === "BOT",
      },
    }

    return { event, success: true }
  }

  private parseConnectEvent(logLine: string, serverId: number): ParseResult {
    // Example: "Player<2><STEAM_ID><>" connected, address "192.168.1.1:27005"
    const connectRegex = /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" connected, address "([^"]+)"/
    const match = logLine.match(connectRegex)

    if (!match) {
      return { event: null, success: false, error: "Could not parse connect event" }
    }

    const [, playerName, playerIdStr, steamId, , ipAddress] = match

    if (!playerName || !playerIdStr || !steamId || !ipAddress) {
      return { event: null, success: false, error: "Missing required fields in connect event" }
    }

    const playerId = parseInt(playerIdStr || "")
    if (isNaN(playerId)) {
      return { event: null, success: false, error: "Invalid player ID in connect event" }
    }

    const event: BaseEvent = {
      eventType: EventType.PLAYER_CONNECT,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      eventId: generateMessageId(),
      correlationId: generateCorrelationId(),
      data: {
        playerId,
        steamId,
        playerName,
        ipAddress,
      },
      meta: {
        steamId,
        playerName,
        isBot: steamId === "BOT",
      },
    }

    return { event, success: true }
  }

  private parseEnterEvent(logLine: string, serverId: number): ParseResult {
    // Example: "Player<2><STEAM_ID><>" entered the game
    const enterRegex = /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" entered the game/
    const match = logLine.match(enterRegex)

    if (!match) {
      return { event: null, success: false, error: "Could not parse enter/connect event" }
    }

    const [, playerName, playerIdStr, steamId] = match

    if (!playerName || !playerIdStr || !steamId) {
      return {
        event: null,
        success: false,
        error: "Missing required fields in enter/connect event",
      }
    }

    const playerId = parseInt(playerIdStr || "")
    if (isNaN(playerId)) {
      return { event: null, success: false, error: "Invalid player ID in enter/connect event" }
    }

    const event: BaseEvent = {
      eventType: EventType.PLAYER_ENTRY,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      eventId: generateMessageId(),
      correlationId: generateCorrelationId(),
      data: {
        playerId,
      },
      meta: {
        steamId,
        playerName,
        isBot: steamId === "BOT",
      },
    }

    return { event, success: true }
  }

  private parseChangeTeamEvent(logLine: string, serverId: number): ParseResult {
    // Examples:
    // "Player<2><STEAM_ID><>" joined team "CT"
    // "Player<2><STEAM_ID><TERRORIST>" changed team to "CT"
    const joinedRegex = /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" joined team "([^"]+)"/
    const changedRegex = /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" changed team to "([^"]+)"/
    const match = logLine.match(joinedRegex) || logLine.match(changedRegex)

    if (!match) {
      return { event: null, success: false }
    }

    const playerName = match[1]
    const playerIdStr = match[2]
    const steamId = match[3]
    const newTeam = match[5]

    if (!playerName || !playerIdStr || !steamId || !newTeam) {
      return { event: null, success: false, error: "Missing required fields in team change" }
    }

    const playerId = parseInt(playerIdStr)
    if (Number.isNaN(playerId)) {
      return { event: null, success: false, error: "Invalid player ID in team change" }
    }

    const event: BaseEvent = {
      eventType: EventType.PLAYER_CHANGE_TEAM,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      eventId: generateMessageId(),
      correlationId: generateCorrelationId(),
      data: {
        playerId,
        team: newTeam,
      },
      meta: {
        steamId,
        playerName,
        isBot: steamId === "BOT",
      },
    }

    return { event, success: true }
  }

  private parseChangeRoleEvent(logLine: string, serverId: number): ParseResult {
    // Example variants are mod dependent; attempt a tolerant parse if present
    const regex = /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" changed role to "([^"]+)"/i

    const match = logLine.match(regex)
    if (!match) {
      return { event: null, success: false }
    }

    const [, playerName, playerIdStr, steamId, , roleRaw] = match
    const safePlayerIdStr = playerIdStr || "-1"
    const playerId = parseInt(safePlayerIdStr)
    const role = roleRaw || ""

    if (!playerName || !playerIdStr || !steamId || Number.isNaN(playerId) || role === undefined) {
      return { event: null, success: false, error: "Missing required fields in role change" }
    }

    const event: BaseEvent = {
      eventType: EventType.PLAYER_CHANGE_ROLE,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      eventId: generateMessageId(),
      correlationId: generateCorrelationId(),
      data: {
        playerId,
        role,
      },
      meta: {
        steamId: steamId || "",
        playerName,
        isBot: (steamId || "") === "BOT",
      },
    }

    return { event, success: true }
  }

  private parseChangeNameEvent(logLine: string, serverId: number): ParseResult {
    // Example: "OldName<2><STEAM_ID><CT>" changed name to "NewName"
    const regex = /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" changed name to "([^"]+)"/i

    const match = logLine.match(regex)
    if (!match) {
      return { event: null, success: false }
    }

    const [, oldName, playerIdStr, steamId, , newNameRaw] = match
    const safePlayerIdStr2 = playerIdStr || "-1"
    const playerId = parseInt(safePlayerIdStr2)
    const newName = newNameRaw || ""

    if (!oldName || !playerIdStr || !steamId || Number.isNaN(playerId) || newName === undefined) {
      return { event: null, success: false, error: "Missing required fields in name change" }
    }

    const event: BaseEvent = {
      eventType: EventType.PLAYER_CHANGE_NAME,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      eventId: generateMessageId(),
      correlationId: generateCorrelationId(),
      data: {
        playerId,
        oldName,
        newName,
      },
      meta: {
        steamId: steamId || "",
        playerName: newName,
        isBot: (steamId || "") === "BOT",
      },
    }

    return { event, success: true }
  }

  private parseDisconnectEvent(logLine: string, serverId: number): ParseResult {
    // Newer format with explicit reason: "Player<2><STEAM_ID><CT>" disconnected (reason "Disconnect")
    const disconnectWithReason =
      /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" disconnected \(reason "([^"]*)"\)/

    // Legacy/simple format without reason: "Player<-1><><CT>" disconnected
    const disconnectSimple = /"([^"]+)<(-?\d+)><([^>]*)><([^>]*)>" disconnected/

    let match = logLine.match(disconnectWithReason)

    if (match) {
      const [, playerName, playerIdStr, steamId, , reason] = match

      if (!playerName || !playerIdStr || !steamId) {
        return { event: null, success: false, error: "Missing required fields in disconnect event" }
      }

      const parsedId = parseInt(playerIdStr)
      const playerId = Number.isNaN(parsedId) ? -1 : parsedId
      const event: BaseEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: this.createTimestamp(),
        serverId,
        raw: logLine,
        eventId: generateMessageId(),
        correlationId: generateCorrelationId(),
        data: {
          playerId,
          reason: reason ?? "",
        },
        meta: {
          steamId,
          playerName,
          isBot: steamId === "BOT",
        },
      }

      return { event, success: true }
    }

    match = logLine.match(disconnectSimple)
    if (match) {
      const [, playerName, playerIdStr, steamId] = match

      if (!playerName || playerIdStr == null) {
        return { event: null, success: false, error: "Missing required fields in disconnect event" }
      }

      const parsedId = parseInt(playerIdStr)
      const playerId = Number.isNaN(parsedId) ? -1 : parsedId
      const event: BaseEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: this.createTimestamp(),
        serverId,
        raw: logLine,
        eventId: generateMessageId(),
        correlationId: generateCorrelationId(),
        data: {
          playerId,
          reason: "",
        },
        meta: {
          steamId: steamId || "",
          playerName,
          isBot: (steamId || "") === "BOT",
        },
      }

      return { event, success: true }
    }

    // Some engines drop fakeclients on level change without a parseable line; ignore silently
    return { event: null, success: false }
  }

  private parseChatEvent(logLine: string, serverId: number): ParseResult {
    // Example: "Player<2><STEAM_ID><CT>" say "hello world"
    const chatRegex = /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" say(?:_team)? "([^"]*)"/
    const match = logLine.match(chatRegex)

    if (!match) {
      return { event: null, success: false, error: "Could not parse chat event" }
    }

    const [, playerName, playerIdStr, steamId, team, message] = match

    if (!playerName || !playerIdStr || !steamId || team === undefined || message === undefined) {
      return { event: null, success: false, error: "Missing required fields in chat event" }
    }

    const playerId = parseInt(playerIdStr)
    if (isNaN(playerId)) {
      return { event: null, success: false, error: "Invalid player ID in chat event" }
    }

    const event: BaseEvent = {
      eventType: EventType.CHAT_MESSAGE,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      eventId: generateMessageId(),
      correlationId: generateCorrelationId(),
      data: {
        playerId,
        message,
        team,
        isDead: false, // Would need additional parsing to determine
      },
      meta: {
        steamId,
        playerName,
        isBot: steamId === "BOT",
      },
    }

    return { event, success: true }
  }

  private parseActionEvent(logLine: string, serverId: number): ParseResult {
    // Parse player action events like:
    // "Player<2><STEAM_ID><TERRORIST>" triggered "Spawned_With_The_Bomb"
    const playerActionRegex = /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" triggered "([^"]+)"/
    const playerMatch = logLine.match(playerActionRegex)

    if (playerMatch) {
      const [, playerName, playerIdStr, steamId, team, actionCode] = playerMatch

      if (!playerName || !playerIdStr || !steamId || !actionCode) {
        return {
          event: null,
          success: false,
          error: "Missing required fields in player action event",
        }
      }

      const playerId = parseInt(playerIdStr)
      if (isNaN(playerId)) {
        return { event: null, success: false, error: "Invalid player ID in action event" }
      }

      const event: BaseEvent = {
        eventType: EventType.ACTION_PLAYER,
        timestamp: this.createTimestamp(),
        serverId,
        raw: logLine,
        eventId: generateMessageId(),
        correlationId: generateCorrelationId(),
        data: {
          playerId,
          actionCode,
          game: this.game,
          team: team || undefined,
        },
        meta: {
          steamId,
          playerName,
          isBot: steamId === "BOT",
        },
      }

      return { event, success: true }
    }

    // Parse team action events like:
    // Team "TERRORIST" triggered "Terrorists_Win"
    // (Already handled by parseTeamWinEvent, but could add other team actions here)

    // Not an action event we handle
    return { event: null, success: false }
  }

  private parseTeamActionEvent(logLine: string, serverId: number): ParseResult {
    // Team "TERRORIST" triggered "Target_Bombed" (CT "4") (T "5")
    const teamTriggerMatch = logLine.match(/Team "([^"]+)" triggered "([^"]+)"/i)
    if (!teamTriggerMatch) {
      return { event: null, success: false }
    }

    const [, team, triggerName] = teamTriggerMatch

    // If it's a team win, this is handled elsewhere
    if (triggerName === "Terrorists_Win" || triggerName === "CTs_Win") {
      return { event: null, success: false }
    }

    const event: BaseEvent = {
      eventType: EventType.ACTION_TEAM,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      eventId: generateMessageId(),
      correlationId: generateCorrelationId(),
      data: {
        team,
        actionCode: triggerName,
        game: this.game,
      },
    }

    return { event, success: true }
  }

  private parseRoundStartEvent(logLine: string, serverId: number): ParseResult {
    // Example: World triggered "Round_Start"
    // Map info comes from previously parsed map change events

    const event: BaseEvent = {
      eventType: EventType.ROUND_START,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      eventId: generateMessageId(),
      correlationId: generateCorrelationId(),
      data: {
        map: this.currentMap || "", // Use current map from parser state
        roundNumber: 1, // TODO: Track actual round number
        maxPlayers: 0, // TODO: Get from server info
      },
    }

    return { event, success: true }
  }

  private parseRoundEndEvent(logLine: string, serverId: number): ParseResult {
    // Example: World triggered "Round_End"
    // The winning team was captured from the previous Terrorists_Win/CTs_Win event

    const event: BaseEvent = {
      eventType: EventType.ROUND_END,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      eventId: generateMessageId(),
      correlationId: generateCorrelationId(),
      data: {
        winningTeam: this.lastWinningTeam,
      },
    }

    // Clear the winning team after using it
    this.lastWinningTeam = undefined

    return { event, success: true }
  }

  private parseTeamWinEvent(logLine: string, serverId: number): ParseResult {
    // Parse: Team "TERRORIST" triggered "Terrorists_Win" (CT "4") (T "4")
    const teamWinMatch = logLine.match(/Team "([^"]+)" triggered "([^"]+)"/i)
    if (teamWinMatch) {
      const [, team, triggerName] = teamWinMatch

      // Store winning team for subsequent Round_End event
      this.lastWinningTeam = team

      // Extract scores
      const scoreMatch = logLine.match(/\(CT "(\d+)"\) \(T "(\d+)"\)/)
      let ctScore = 0
      let tScore = 0

      if (scoreMatch) {
        ctScore = parseInt(scoreMatch[1] || "0") || 0
        tScore = parseInt(scoreMatch[2] || "0") || 0
      }

      const event: BaseEvent = {
        eventType: EventType.TEAM_WIN,
        timestamp: this.createTimestamp(),
        serverId,
        raw: logLine,
        eventId: generateMessageId(),
        correlationId: generateCorrelationId(),
        data: {
          winningTeam: team,
          triggerName,
          score: {
            ct: ctScore,
            t: tScore,
          },
        },
      }

      return { event, success: true }
    }

    return { event: null, success: false, error: "Could not parse team win event" }
  }

  private parseMapChangeEvent(logLine: string, serverId: number): ParseResult {
    // Parse map change events like:
    // "-------- Mapchange to cs_havana --------"
    // "Started map "cs_havana" (CRC "-1352213912")"
    // "changelevel: de_mirage"

    let mapName = ""

    // Try different map change patterns
    const mapchangeToMatch = logLine.match(/Mapchange to (\w+)/)
    const startedMapMatch = logLine.match(/Started map "(\w+)"/)
    const changelevelMatch = logLine.match(/changelevel:?\s+(\w+)/)

    if (mapchangeToMatch && mapchangeToMatch[1]) {
      mapName = mapchangeToMatch[1]
    } else if (startedMapMatch && startedMapMatch[1]) {
      mapName = startedMapMatch[1]
    } else if (changelevelMatch && changelevelMatch[1]) {
      mapName = changelevelMatch[1]
    } else {
      return { event: null, success: false, error: "Could not extract map name from change event" }
    }

    // Store the previous map and update current map
    const previousMap = this.currentMap || undefined
    this.currentMap = mapName

    const event: BaseEvent = {
      eventType: EventType.MAP_CHANGE,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      eventId: generateMessageId(),
      correlationId: generateCorrelationId(),
      data: {
        newMap: mapName,
        playerCount: 0, // Would need additional parsing to get player count
        previousMap: previousMap,
      },
    }

    return { event, success: true }
  }
}
