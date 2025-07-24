/**
 * Counter-Strike Parser
 *
 * Parses Counter-Strike game server logs into structured events.
 */

import { BaseParser } from "./base.parser"
import type { ParseResult } from "./base.parser"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import { GameConfig } from "@/config/game.config"

export class CsParser extends BaseParser {
  // Track the last winning team for Round_End events
  private lastWinningTeam: string | undefined
  // Track the current map for Round_Start events
  private currentMap: string = ""

  constructor(game: string = GameConfig.getDefaultGame()) {
    super(game)
  }

  parseLine(logLine: string, serverId: number): ParseResult {
    try {
      // Remove timestamp prefix if present
      const cleanLine = logLine.replace(/^L \d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}:\d{2}: /, "")

      // Player kill events
      if (cleanLine.includes(" killed ")) {
        return this.parseKillEvent(cleanLine, serverId)
      }

      // Player damage events
      if (cleanLine.includes(" attacked ")) {
        return this.parseDamageEvent(cleanLine, serverId)
      }

      // Player connect/disconnect
      if (cleanLine.includes(" connected, address ")) {
        return this.parseConnectEvent(cleanLine, serverId)
      }

      if (cleanLine.includes(" disconnected (reason ")) {
        return this.parseDisconnectEvent(cleanLine, serverId)
      }

      // Chat messages
      if (cleanLine.includes(" say ") || cleanLine.includes(" say_team ")) {
        return this.parseChatEvent(cleanLine, serverId)
      }

      // Player action triggers
      if (cleanLine.includes('triggered "')) {
        const actionResult = this.parseActionEvent(cleanLine, serverId)
        if (actionResult.success && actionResult.event) {
          return actionResult
        }
        // Fall through to other event parsing if not an action
      }

      // Map change events (before round events)
      if (
        cleanLine.includes("Mapchange to ") ||
        cleanLine.includes("Started map ") ||
        cleanLine.includes("changelevel:")
      ) {
        return this.parseMapChangeEvent(cleanLine, serverId)
      }

      // Round events
      if (cleanLine.includes('World triggered "Round_Start"')) {
        return this.parseRoundStartEvent(cleanLine, serverId)
      }

      // Parse team win events first (these happen before Round_End)
      if (
        cleanLine.includes('triggered "Terrorists_Win"') ||
        cleanLine.includes('triggered "CTs_Win"')
      ) {
        return this.parseTeamWinEvent(cleanLine, serverId)
      }

      if (cleanLine.includes('World triggered "Round_End"')) {
        return this.parseRoundEndEvent(cleanLine, serverId)
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
    const match = logLine.match(damageRegex)

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

    const playerId = parseInt(playerIdStr)
    if (isNaN(playerId)) {
      return { event: null, success: false, error: "Invalid player ID in connect event" }
    }

    const event: BaseEvent = {
      eventType: EventType.PLAYER_CONNECT,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
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

  private parseDisconnectEvent(logLine: string, serverId: number): ParseResult {
    // Example: "Player<2><STEAM_ID><CT>" disconnected (reason "Disconnect")
    const disconnectRegex = /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" disconnected \(reason "([^"]*)"\)/
    const match = logLine.match(disconnectRegex)

    if (!match) {
      return { event: null, success: false, error: "Could not parse disconnect event" }
    }

    const [, playerName, playerIdStr, steamId, , reason] = match

    if (!playerName || !playerIdStr || !steamId || reason === undefined) {
      return { event: null, success: false, error: "Missing required fields in disconnect event" }
    }

    const playerId = parseInt(playerIdStr)
    if (isNaN(playerId)) {
      return { event: null, success: false, error: "Invalid player ID in disconnect event" }
    }

    const event: BaseEvent = {
      eventType: EventType.PLAYER_DISCONNECT,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      data: {
        playerId,
        reason,
      },
      meta: {
        steamId,
        playerName,
        isBot: steamId === "BOT",
      },
    }

    return { event, success: true }
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

  private parseRoundStartEvent(logLine: string, serverId: number): ParseResult {
    // Example: World triggered "Round_Start"
    // Map info comes from previously parsed map change events

    const event: BaseEvent = {
      eventType: EventType.ROUND_START,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
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
      data: {
        newMap: mapName,
        playerCount: 0, // Would need additional parsing to get player count
        previousMap: previousMap,
      },
    }

    return { event, success: true }
  }
}
