/**
 * Counter-Strike Parser
 *
 * Thin orchestrator that wires together:
 *   - ParserStrategyTable: substring -> handler dispatch
 *   - EventAssemblyHelper: BaseEvent envelope construction
 *   - StateCoordinator:    the only place ServerStateManager is mutated
 *
 * Individual parseXxxEvent handlers are pure with respect to state: they only
 * read from the log line and write through the coordinator/helper.
 */

import { GameConfig } from "@/config/game.config"
import type { ServerStateManager } from "@/modules/server/state/server-state-manager"
import type { IClock } from "@/shared/infrastructure/time/clock.interface"
import { EventType } from "@/shared/types/events"
import type { ParseResult } from "./base.parser"
import { BaseParser } from "./base.parser"
import { EventAssemblyHelper } from "./event-assembly-helper"
import { ParserStrategyTable } from "./parser-strategy-table"
import { StateCoordinator } from "./state-coordinator"

const TIMESTAMP_PREFIX_RE = /^L \d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}:\d{2}: /

export class CsParser extends BaseParser {
  private readonly assembler: EventAssemblyHelper
  private readonly state: StateCoordinator
  private readonly strategies: ParserStrategyTable

  constructor(
    game: string = GameConfig.getDefaultGame(),
    clock: IClock,
    stateManager: ServerStateManager,
  ) {
    super(game, clock)
    this.assembler = new EventAssemblyHelper(clock)
    this.state = new StateCoordinator(stateManager)
    this.strategies = new ParserStrategyTable([
      {
        patterns: ["Rcon:"],
        handler: (line, serverId) => this.parseRconCommandEvent(line, serverId),
      },
      {
        patterns: ['triggered "amx_'],
        handler: (line, serverId) => this.parseAdminCommandEvent(line, serverId),
      },
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
    ])
  }

  parseLine(logLine: string, serverId: number): ParseResult {
    try {
      const cleanLine = logLine.replace(TIMESTAMP_PREFIX_RE, "")

      const strategyResult = this.strategies.dispatch(cleanLine, serverId)
      if (strategyResult) {
        return strategyResult
      }

      const specialResult = this.tryParseSpecialCases(cleanLine, serverId)
      if (specialResult) {
        return specialResult
      }

      return { event: null, success: true }
    } catch (error) {
      return {
        event: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private tryParseSpecialCases(cleanLine: string, serverId: number): ParseResult | null {
    // Player- and team-triggered actions need custom dispatch because the
    // strategy table can't disambiguate "World triggered" from "<player> triggered"
    // by substring alone.
    if (cleanLine.includes('triggered "') && !cleanLine.includes("World triggered")) {
      const actionResult = this.parseActionEvent(cleanLine, serverId)
      if (actionResult.success && actionResult.event) {
        return actionResult
      }

      const teamActionResult = this.parseTeamActionEvent(cleanLine, serverId)
      if (teamActionResult.success && teamActionResult.event) {
        return teamActionResult
      }
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

    const killerGameUserId = parseInt(killerIdStr)
    const victimGameUserId = parseInt(victimIdStr)

    if (isNaN(killerGameUserId) || isNaN(victimGameUserId)) {
      return { event: null, success: false, error: "Invalid game user ID in kill event" }
    }

    const event = this.assembler.assemble({
      eventType: EventType.PLAYER_KILL,
      serverId,
      raw: logLine,
      data: {
        killerGameUserId,
        victimGameUserId,
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
    })

    return { event, success: true }
  }

  private parseDamageEvent(logLine: string, serverId: number): ParseResult {
    // Example: "Player1<2><STEAM_ID><CT>" attacked "Player2<3><STEAM_ID><TERRORIST>" with "ak47" (damage "27") (damage_armor "0") (health "73") (armor "100") (hitgroup "chest")
    // Health and armor can be negative on overkill (engine subtracts damage from remaining HP/AP regardless of zero floor).
    const damageRegex =
      /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" attacked "([^"]+)<(\d+)><([^>]+)><([^>]*)>" with "([^"]+)" \(damage "(-?\d+)"\) \(damage_armor "(-?\d+)"\) \(health "(-?\d+)"\) \(armor "(-?\d+)"\)(?:\s+\(hitgroup "([^"]+)"\))?/
    let match = logLine.match(damageRegex)

    if (!match) {
      const tolerant =
        /"([^"]+)<(\d+)>[^"]*" attacked "([^"]+)<(\d+)>[^"]*" with "([^"]+)" .*?\(damage "(-?\d+)"\).*?\(damage_armor "(-?\d+)"\).*?\(health "(-?\d+)"\).*?\(armor "(-?\d+)"\)(?:.*?\(hitgroup "([^"]+)"\))?/
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

    const attackerGameUserId = parseInt(attackerIdStr)
    const victimGameUserId = parseInt(victimIdStr)

    if (isNaN(attackerGameUserId) || isNaN(victimGameUserId)) {
      return { event: null, success: false, error: "Invalid game user ID in damage event" }
    }

    const event = this.assembler.assemble({
      eventType: EventType.PLAYER_DAMAGE,
      serverId,
      raw: logLine,
      data: {
        attackerGameUserId,
        victimGameUserId,
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
    })

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
    const gameUserId = parseInt(playerIdStr || "")

    if (!playerName || !playerIdStr || !steamId || Number.isNaN(gameUserId)) {
      return { event: null, success: false, error: "Missing required fields in suicide event" }
    }

    const event = this.assembler.assemble({
      eventType: EventType.PLAYER_SUICIDE,
      serverId,
      raw: logLine,
      data: {
        gameUserId,
        team: team || "UNKNOWN",
        weapon: weapon || "world",
      },
      meta: {
        steamId: steamId || "",
        playerName,
        isBot: (steamId || "") === "BOT",
      },
    })

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

    const gameUserId = parseInt(playerIdStr || "")
    if (isNaN(gameUserId)) {
      return { event: null, success: false, error: "Invalid game user ID in connect event" }
    }

    const event = this.assembler.assemble({
      eventType: EventType.PLAYER_CONNECT,
      serverId,
      raw: logLine,
      data: {
        gameUserId,
        steamId,
        playerName,
        ipAddress,
      },
      meta: {
        steamId,
        playerName,
        isBot: steamId === "BOT",
      },
    })

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

    const gameUserId = parseInt(playerIdStr || "")
    if (isNaN(gameUserId)) {
      return { event: null, success: false, error: "Invalid game user ID in enter/connect event" }
    }

    const event = this.assembler.assemble({
      eventType: EventType.PLAYER_ENTRY,
      serverId,
      raw: logLine,
      data: {
        gameUserId,
      },
      meta: {
        steamId,
        playerName,
        isBot: steamId === "BOT",
      },
    })

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

    const gameUserId = parseInt(playerIdStr)
    if (Number.isNaN(gameUserId)) {
      return { event: null, success: false, error: "Invalid game user ID in team change" }
    }

    const event = this.assembler.assemble({
      eventType: EventType.PLAYER_CHANGE_TEAM,
      serverId,
      raw: logLine,
      data: {
        gameUserId,
        team: newTeam,
      },
      meta: {
        steamId,
        playerName,
        isBot: steamId === "BOT",
      },
    })

    return { event, success: true }
  }

  private parseChangeRoleEvent(logLine: string, serverId: number): ParseResult {
    const regex = /"([^"]+)<(\d+)><([^>]+)><([^>]*)>" changed role to "([^"]+)"/i

    const match = logLine.match(regex)
    if (!match) {
      return { event: null, success: false }
    }

    const [, playerName, playerIdStr, steamId, , roleRaw] = match
    const safePlayerIdStr = playerIdStr || "-1"
    const gameUserId = parseInt(safePlayerIdStr)
    const role = roleRaw || ""

    if (!playerName || !playerIdStr || !steamId || Number.isNaN(gameUserId) || role === undefined) {
      return { event: null, success: false, error: "Missing required fields in role change" }
    }

    const event = this.assembler.assemble({
      eventType: EventType.PLAYER_CHANGE_ROLE,
      serverId,
      raw: logLine,
      data: {
        gameUserId,
        role,
      },
      meta: {
        steamId: steamId || "",
        playerName,
        isBot: (steamId || "") === "BOT",
      },
    })

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
    const gameUserId = parseInt(safePlayerIdStr2)
    const newName = newNameRaw || ""

    if (!oldName || !playerIdStr || !steamId || Number.isNaN(gameUserId) || newName === undefined) {
      return { event: null, success: false, error: "Missing required fields in name change" }
    }

    const event = this.assembler.assemble({
      eventType: EventType.PLAYER_CHANGE_NAME,
      serverId,
      raw: logLine,
      data: {
        gameUserId,
        oldName,
        newName,
      },
      meta: {
        steamId: steamId || "",
        playerName: newName,
        isBot: (steamId || "") === "BOT",
      },
    })

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
      const gameUserId = Number.isNaN(parsedId) ? -1 : parsedId
      const event = this.assembler.assemble({
        eventType: EventType.PLAYER_DISCONNECT,
        serverId,
        raw: logLine,
        data: {
          gameUserId,
          reason: reason ?? "",
        },
        meta: {
          steamId,
          playerName,
          isBot: steamId === "BOT",
        },
      })

      return { event, success: true }
    }

    match = logLine.match(disconnectSimple)
    if (match) {
      const [, playerName, playerIdStr, steamId] = match

      if (!playerName || playerIdStr == null) {
        return { event: null, success: false, error: "Missing required fields in disconnect event" }
      }

      const parsedId = parseInt(playerIdStr)
      const gameUserId = Number.isNaN(parsedId) ? -1 : parsedId
      const event = this.assembler.assemble({
        eventType: EventType.PLAYER_DISCONNECT,
        serverId,
        raw: logLine,
        data: {
          gameUserId,
          reason: "",
        },
        meta: {
          steamId: steamId || "",
          playerName,
          isBot: (steamId || "") === "BOT",
        },
      })

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

    const gameUserId = parseInt(playerIdStr)
    if (isNaN(gameUserId)) {
      return { event: null, success: false, error: "Invalid game user ID in chat event" }
    }

    const event = this.assembler.assemble({
      eventType: EventType.CHAT_MESSAGE,
      serverId,
      raw: logLine,
      data: {
        gameUserId,
        message,
        team,
        isDead: false,
      },
      meta: {
        steamId,
        playerName,
        isBot: steamId === "BOT",
      },
    })

    return { event, success: true }
  }

  private parseActionEvent(logLine: string, serverId: number): ParseResult {
    // Example: "Player<2><STEAM_ID><TERRORIST>" triggered "Spawned_With_The_Bomb"
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

      const gameUserId = parseInt(playerIdStr)
      if (isNaN(gameUserId)) {
        return { event: null, success: false, error: "Invalid game user ID in action event" }
      }

      const event = this.assembler.assemble({
        eventType: EventType.ACTION_PLAYER,
        serverId,
        raw: logLine,
        data: {
          gameUserId,
          actionCode,
          game: this.game,
          team: team || undefined,
        },
        meta: {
          steamId,
          playerName,
          isBot: steamId === "BOT",
        },
      })

      return { event, success: true }
    }

    return { event: null, success: false }
  }

  private parseTeamActionEvent(logLine: string, serverId: number): ParseResult {
    // Example: Team "TERRORIST" triggered "Target_Bombed" (CT "4") (T "5")
    const teamTriggerMatch = logLine.match(/Team "([^"]+)" triggered "([^"]+)"/i)
    if (!teamTriggerMatch) {
      return { event: null, success: false }
    }

    const [, team, triggerName] = teamTriggerMatch

    // Win triggers are routed through parseTeamWinEvent via the strategy table;
    // skip them here so they don't double-emit as ACTION_TEAM.
    if (triggerName === "Terrorists_Win" || triggerName === "CTs_Win") {
      return { event: null, success: false }
    }

    const event = this.assembler.assemble({
      eventType: EventType.ACTION_TEAM,
      serverId,
      raw: logLine,
      data: {
        team,
        actionCode: triggerName,
        game: this.game,
      },
    })

    return { event, success: true }
  }

  private parseRoundStartEvent(logLine: string, serverId: number): ParseResult {
    const ctx = this.state.beginRound(serverId)

    const event = this.assembler.assemble({
      eventType: EventType.ROUND_START,
      serverId,
      raw: logLine,
      data: {
        map: ctx.currentMap,
        roundNumber: ctx.roundNumber,
        maxPlayers: ctx.maxPlayers,
      },
    })

    return { event, success: true }
  }

  private parseRoundEndEvent(logLine: string, serverId: number): ParseResult {
    const roundInfo = this.state.finishRound(serverId)

    const event = this.assembler.assemble({
      eventType: EventType.ROUND_END,
      serverId,
      raw: logLine,
      data: {
        winningTeam: roundInfo.winningTeam,
        roundNumber: roundInfo.roundNumber,
      },
    })

    return { event, success: true }
  }

  private parseTeamWinEvent(logLine: string, serverId: number): ParseResult {
    // Example: Team "TERRORIST" triggered "Terrorists_Win" (CT "4") (T "4")
    const teamWinMatch = logLine.match(/Team "([^"]+)" triggered "([^"]+)"/i)
    if (!teamWinMatch) {
      return { event: null, success: false, error: "Could not parse team win event" }
    }

    const [, team, triggerName] = teamWinMatch

    // Stash winner so the subsequent Round_End event can attach it.
    if (team) {
      this.state.rememberWinningTeam(serverId, team)
    }

    const scoreMatch = logLine.match(/\(CT "(\d+)"\) \(T "(\d+)"\)/)
    let ctScore = 0
    let tScore = 0

    if (scoreMatch) {
      ctScore = parseInt(scoreMatch[1] || "0") || 0
      tScore = parseInt(scoreMatch[2] || "0") || 0
    }

    const event = this.assembler.assemble({
      eventType: EventType.TEAM_WIN,
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
    })

    return { event, success: true }
  }

  private parseMapChangeEvent(logLine: string, serverId: number): ParseResult {
    // Parse map change events like:
    // "-------- Mapchange to cs_havana --------"
    // "Started map "cs_havana" (CRC "-1352213912")"
    // "changelevel: de_mirage"
    // "Cmd: "<host>" changelevel "de_aztec""
    let mapName = ""

    const mapchangeToMatch = logLine.match(/Mapchange to (\w+)/)
    const startedMapMatch = logLine.match(/Started map "(\w+)"/)
    const changelevelMatch = logLine.match(/changelevel:?\s+(\w+)/)
    const adminCmdMatch = logLine.match(/Cmd: "([^"]+)" changelevel "(\w+)"/)

    if (mapchangeToMatch && mapchangeToMatch[1]) {
      mapName = mapchangeToMatch[1]
    } else if (startedMapMatch && startedMapMatch[1]) {
      mapName = startedMapMatch[1]
    } else if (changelevelMatch && changelevelMatch[1]) {
      mapName = changelevelMatch[1]
    } else if (adminCmdMatch && adminCmdMatch[2]) {
      mapName = adminCmdMatch[2]
    } else {
      return { event: null, success: false, error: "Could not extract map name from change event" }
    }

    const mapChange = this.state.recordMapChange(serverId, mapName)

    const event = this.assembler.assemble({
      eventType: EventType.MAP_CHANGE,
      serverId,
      raw: logLine,
      data: {
        newMap: mapName,
        previousMap: mapChange.previousMap,
      },
    })

    return { event, success: true }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private parseRconCommandEvent(_logLine: string, _serverId: number): ParseResult {
    // RCON command logs like: Rcon: "rcon 716044165 adminD5bIpFSQ amx_say [HLStatsNext]: pimpjuice..."
    // These are administrative logs, not game events - ignore them silently
    return { event: null, success: true }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private parseAdminCommandEvent(_logLine: string, _serverId: number): ParseResult {
    // Admin command logs like: "[0x1] Public CS 1.6 Clan Server<0><><>" triggered "amx_say" (text...)
    // These are administrative command executions, not game events - ignore them silently
    return { event: null, success: true }
  }
}
