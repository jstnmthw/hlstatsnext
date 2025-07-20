/**
 * Counter-Strike Parser
 *
 * Parses Counter-Strike game server logs into structured events.
 */

import { BaseParser } from "./base.parser"
import type { ParseResult } from "./base.parser"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"

export class CsParser extends BaseParser {
  constructor(game: string = "csgo") {
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

      // Round events
      if (cleanLine.includes('World triggered "Round_Start"')) {
        return this.parseRoundStartEvent(cleanLine, serverId)
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

  private parseRoundStartEvent(logLine: string, serverId: number): ParseResult {
    const event: BaseEvent = {
      eventType: EventType.ROUND_START,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      data: {
        map: "unknown", // Would need additional parsing to get map name
        roundNumber: 1, // Would need round tracking
        maxPlayers: 32,
      },
    }

    return { event, success: true }
  }

  private parseRoundEndEvent(logLine: string, serverId: number): ParseResult {
    const event: BaseEvent = {
      eventType: EventType.ROUND_END,
      timestamp: this.createTimestamp(),
      serverId,
      raw: logLine,
      data: {
        winningTeam: "unknown", // Would need additional parsing
        duration: 0,
      },
    }

    return { event, success: true }
  }
}
