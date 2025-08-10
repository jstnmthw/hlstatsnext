/**
 * Match Service
 *
 * Business logic for match management, rounds, and MVP calculations.
 */

import type {
  IMatchService,
  IMatchRepository,
  MatchEvent,
  MatchStats,
  PlayerRoundStats,
  RoundStartEvent,
  RoundEndEvent,
  TeamWinEvent,
  MapChangeEvent,
} from "./match.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { HandlerResult } from "@/shared/types/common"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import { GameConfig } from "@/config/game.config"

export class MatchService implements IMatchService {
  private currentMatches: Map<number, MatchStats> = new Map() // serverId -> MatchStats

  constructor(
    private readonly repository: IMatchRepository,
    private readonly logger: ILogger,
  ) {}

  async handleMatchEvent(event: MatchEvent): Promise<HandlerResult> {
    try {
      switch (event.eventType) {
        case EventType.ROUND_START:
          return await this.handleRoundStart(event)
        case EventType.ROUND_END:
          return await this.handleRoundEnd(event)
        case EventType.TEAM_WIN:
          return await this.handleTeamWin(event)
        case EventType.MAP_CHANGE:
          return await this.handleMapChange(event)
        default:
          return { success: true }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Objective events are now handled via ACTION_* paths and DB codes

  async handleKillInMatch(event: BaseEvent): Promise<HandlerResult> {
    const serverId = event.serverId

    try {
      let matchStats = this.currentMatches.get(serverId)
      if (!matchStats) {
        this.logger.info(`Auto-initializing match context for server ${serverId}`)
        matchStats = {
          duration: 0,
          totalRounds: 0,
          teamScores: {},
          startTime: new Date(),
          playerStats: new Map(),
          currentMap: "",
          playerTeams: new Map(),
        }
        this.currentMatches.set(serverId, matchStats)
      }

      const { killerId, victimId, headshot } = event.data as {
        killerId: number
        victimId: number
        headshot: boolean
      }

      // Update killer stats and server aggregated kills
      const killerStats =
        matchStats.playerStats.get(killerId) ?? this.createEmptyPlayerStats(killerId)
      killerStats.kills += 1
      if (headshot) {
        killerStats.headshots += 1
      }
      matchStats.playerStats.set(killerId, killerStats)

      // Update victim stats
      const victimStats =
        matchStats.playerStats.get(victimId) ?? this.createEmptyPlayerStats(victimId)
      victimStats.deaths += 1
      matchStats.playerStats.set(victimId, victimStats)

      // Best-effort: update server aggregated kills and lastEvent
      try {
        await this.repository.updateServerStats(serverId, {
          kills: { increment: 1 },
          lastEvent: new Date(),
        })
      } catch {
        // ignore
      }

      this.logger.debug(
        `Kill event processed in match: player ${killerId} killed player ${victimId}${headshot ? " (headshot)" : ""}`,
      )

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async initializeMapForServer(serverId: number): Promise<string> {
    try {
      // Check if we already have match stats for this server
      const existingStats = this.currentMatches.get(serverId)
      if (existingStats && existingStats.currentMap) {
        return existingStats.currentMap
      }

      // Try to get the last known map from the database
      const lastKnownMap = await this.repository.getLastKnownMap(serverId)

      if (lastKnownMap) {
        // Initialize match stats with the detected map
        const matchStats: MatchStats = {
          duration: 0,
          totalRounds: 0,
          teamScores: {},
          startTime: new Date(),
          playerStats: new Map(),
          currentMap: lastKnownMap,
          playerTeams: new Map(),
        }
        this.currentMatches.set(serverId, matchStats)

        this.logger.info(`Detected map from database for server ${serverId}: ${lastKnownMap}`)
        return lastKnownMap
      }

      // No map found - use fallback
      const fallbackMap = "unknown"
      const matchStats: MatchStats = {
        duration: 0,
        totalRounds: 0,
        teamScores: {},
        startTime: new Date(),
        playerStats: new Map(),
        currentMap: fallbackMap,
        playerTeams: new Map(),
      }
      this.currentMatches.set(serverId, matchStats)

      this.logger.warn(`No map found for server ${serverId} - using fallback: ${fallbackMap}`)
      return fallbackMap
    } catch (error) {
      this.logger.error(`Failed to initialize map for server ${serverId}: ${error}`)
      return "unknown"
    }
  }

  async calculateMatchMVP(serverId: number): Promise<number | undefined> {
    const matchStats = this.currentMatches.get(serverId)
    if (!matchStats || matchStats.playerStats.size === 0) return undefined

    let mvpPlayerId: number | undefined
    let highestScore = 0

    // Calculate MVP based on scoring algorithm
    for (const [playerId, stats] of matchStats.playerStats) {
      const score = this.calculatePlayerScore(stats)
      if (score > highestScore) {
        highestScore = score
        mvpPlayerId = playerId
      }
    }

    return mvpPlayerId
  }

  async handleObjectiveAction(
    actionCode: string,
    serverId: number,
    actorPlayerId?: number,
    team?: string,
  ): Promise<HandlerResult> {
    try {
      let matchStats = this.currentMatches.get(serverId)
      if (!matchStats) {
        this.logger.info(`Auto-initializing match context for server ${serverId}`)
        matchStats = {
          duration: 0,
          totalRounds: 0,
          teamScores: {},
          startTime: new Date(),
          playerStats: new Map(),
          currentMap: "",
          playerTeams: new Map(),
        }
        this.currentMatches.set(serverId, matchStats)
      }

      // Award points per canonical action code (can be externalized to config later)
      const pointsByActionCode: Record<string, number> = {
        Planted_The_Bomb: 3,
        Defused_The_Bomb: 3,
        All_Hostages_Rescued: 2,
      }
      const awardedPoints = pointsByActionCode[actionCode] ?? 1

      if (typeof actorPlayerId === "number") {
        const playerStats =
          matchStats.playerStats.get(actorPlayerId) ?? this.createEmptyPlayerStats(actorPlayerId)
        playerStats.objectiveScore += awardedPoints
        matchStats.playerStats.set(actorPlayerId, playerStats)
      }

      // Update server bomb stats for common codes
      if (actionCode === "Planted_The_Bomb") {
        await this.repository.updateBombStats(serverId, "plant")
      } else if (actionCode === "Defused_The_Bomb") {
        await this.repository.updateBombStats(serverId, "defuse")
      }

      this.logger.debug(
        `Objective action processed: ${actionCode}${actorPlayerId ? ` by player ${actorPlayerId}` : team ? ` by team ${team}` : ""}`,
      )

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  getMatchStats(serverId: number): MatchStats | undefined {
    return this.currentMatches.get(serverId)
  }

  getCurrentMap(serverId: number): string {
    const matchStats = this.currentMatches.get(serverId)
    const currentMap = matchStats?.currentMap || ""

    // If no map is set, use a fallback to indicate unknown map
    return currentMap || GameConfig.getUnknownMap()
  }

  resetMatchStats(serverId: number): void {
    this.currentMatches.delete(serverId)
    this.logger.info(`Reset match statistics for server ${serverId}`)
  }

  updatePlayerWeaponStats(
    serverId: number,
    playerId: number,
    stats: { shots?: number; hits?: number; damage?: number },
  ): void {
    const matchStats = this.currentMatches.get(serverId)
    if (!matchStats) return

    const playerStats =
      matchStats.playerStats.get(playerId) ?? this.createEmptyPlayerStats(playerId)

    if (stats.shots) playerStats.shots += stats.shots
    if (stats.hits) playerStats.hits += stats.hits
    if (stats.damage) playerStats.damage += stats.damage

    matchStats.playerStats.set(playerId, playerStats)

    this.logger.debug(
      `Updated weapon stats for player ${playerId}: +${stats.shots || 0} shots, +${stats.hits || 0} hits, +${stats.damage || 0} damage`,
    )
  }

  calculatePlayerScore(stats: PlayerRoundStats): number {
    // MVP scoring algorithm:
    // - Kills: 2 points each
    // - Deaths: -1 point each
    // - Assists: 1 point each
    // - Objective score: 3 points each (bomb plants/defuses, etc.)
    // - Clutch wins: 5 points each
    return (
      stats.kills * 2 -
      stats.deaths * 1 +
      stats.assists * 1 +
      stats.objectiveScore * 3 +
      stats.clutchWins * 5
    )
  }

  async getServerGame(serverId: number): Promise<string | null> {
    try {
      const server = await this.repository.findServerById(serverId)
      return server?.game ?? null
    } catch {
      return null
    }
  }

  setPlayerTeam(serverId: number, playerId: number, team: string): void {
    const match = this.currentMatches.get(serverId)
    if (!match) return
    match.playerTeams?.set(playerId, team)
  }

  getPlayersByTeam(serverId: number, team: string): number[] {
    const match = this.currentMatches.get(serverId)
    if (!match || !match.playerTeams) return []
    const players: number[] = []
    for (const [pid, t] of match.playerTeams.entries()) {
      if (t === team) players.push(pid)
    }
    return players
  }

  // getObjectivePoints removed; scoring to be based on action codes in later phase

  private createEmptyPlayerStats(playerId: number): PlayerRoundStats {
    return {
      playerId,
      kills: 0,
      deaths: 0,
      assists: 0,
      damage: 0,
      objectiveScore: 0,
      clutchWins: 0,
      headshots: 0,
      shots: 0,
      hits: 0,
      suicides: 0,
      teamkills: 0,
    }
  }

  private async handleRoundStart(event: RoundStartEvent): Promise<HandlerResult> {
    const serverId = event.serverId

    try {
      // Initialize match stats if not exists
      if (!this.currentMatches.has(serverId)) {
        this.currentMatches.set(serverId, {
          duration: 0,
          totalRounds: 0,
          teamScores: {},
          startTime: new Date(),
          playerStats: new Map(),
          currentMap: event.data.map,
        })
      } else {
        // Update the current map if it has changed
        const matchStats = this.currentMatches.get(serverId)!
        matchStats.currentMap = event.data.map
      }

      this.logger.debug(`Round started on server ${serverId}`)

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handleRoundEnd(event: RoundEndEvent): Promise<HandlerResult> {
    const serverId = event.serverId
    const { winningTeam, duration, score } = event.data

    try {
      let matchStats = this.currentMatches.get(serverId)
      if (!matchStats) {
        this.logger.info(`Auto-initializing match context for server ${serverId}`)
        matchStats = {
          duration: 0,
          totalRounds: 0,
          teamScores: {},
          startTime: new Date(),
          playerStats: new Map(),
          currentMap: "",
        }
        this.currentMatches.set(serverId, matchStats)
      }

      // Update match statistics
      matchStats.totalRounds++
      if (duration) matchStats.duration += duration
      if (winningTeam) {
        matchStats.teamScores[winningTeam] = (matchStats.teamScores[winningTeam] || 0) + 1
      }

      await this.repository.incrementServerRounds(serverId)

      this.logger.debug(
        `Round ended on server ${serverId}${winningTeam ? `: ${winningTeam} won` : ""}${
          score ? ` (${score.team1}-${score.team2})` : ""
        }`,
      )

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handleTeamWin(event: TeamWinEvent): Promise<HandlerResult> {
    const serverId = event.serverId
    const { winningTeam, triggerName, score } = event.data

    try {
      const matchStats = this.currentMatches.get(serverId)
      if (!matchStats) {
        // Initialize match stats if not exists
        this.currentMatches.set(serverId, {
          duration: 0,
          totalRounds: 0,
          teamScores: {},
          startTime: new Date(),
          playerStats: new Map(),
          currentMap: "",
          playerTeams: new Map(),
        })
      }

      const currentMatchStats = this.currentMatches.get(serverId)!

      // Update match statistics
      currentMatchStats.totalRounds++
      currentMatchStats.teamScores[winningTeam] =
        (currentMatchStats.teamScores[winningTeam] || 0) + 1

      await this.repository.incrementServerRounds(serverId)

      // Update server statistics for CS-specific team wins
      if (triggerName === "Terrorists_Win" || triggerName === "CTs_Win") {
        await this.repository.updateTeamWins(serverId, winningTeam)
      }

      // Team win bonus handled via Actions path if parser emits ACTION_TEAM for these codes.

      this.logger.debug(
        `Team win on server ${serverId}: ${winningTeam} won via ${triggerName} (CT: ${score.ct}, T: ${score.t})`,
      )

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handleMapChange(event: MapChangeEvent): Promise<HandlerResult> {
    const serverId = event.serverId
    const { previousMap, newMap, playerCount } = event.data

    try {
      // Finalize current match stats if exists
      const matchStats = this.currentMatches.get(serverId)
      if (matchStats && previousMap) {
        await this.finalizeMatch(serverId, previousMap, matchStats)
      }

      // Reset match stats for new map
      this.currentMatches.delete(serverId)

      // Create new match stats with the current map
      const newMatchStats: MatchStats = {
        duration: 0,
        totalRounds: 0,
        teamScores: {},
        startTime: new Date(),
        playerStats: new Map(),
        currentMap: newMap, // Set the current map
        playerTeams: new Map(),
      }
      this.currentMatches.set(serverId, newMatchStats)

      // Update server record for the new map
      if (typeof playerCount === "number") {
        await this.repository.resetMapStats(serverId, newMap, playerCount)
      } else {
        await this.repository.resetMapStats(serverId, newMap)
      }

      this.logger.debug(
        `Map changed on server ${serverId}: ${previousMap} -> ${newMap} (${playerCount} players)`,
      )

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async finalizeMatch(serverId: number, mapName: string, stats: MatchStats): Promise<void> {
    try {
      // Calculate final MVP for the match
      const mvpPlayerId = await this.calculateMatchMVP(serverId)
      stats.mvpPlayer = mvpPlayerId

      // Save match statistics to database
      await this.saveMatchToDatabase(serverId, mapName, stats)

      this.logger.debug(
        `Match finalized on server ${serverId} for map ${mapName}: ${stats.totalRounds} rounds, ${stats.duration}s, MVP: ${mvpPlayerId}, scores: ${JSON.stringify(
          stats.teamScores,
        )}`,
      )
    } catch (error) {
      this.logger.failed(
        `Failed to finalize match on server ${serverId}`,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  private async saveMatchToDatabase(
    serverId: number,
    mapName: string,
    stats: MatchStats,
  ): Promise<void> {
    try {
      const server = await this.repository.findServerById(serverId)
      if (!server) return

      let totalKills = 0
      let totalHeadshots = 0

      // Create a player history snapshot for each participant
      for (const [, playerStats] of stats.playerStats) {
        totalKills += playerStats.kills
        totalHeadshots += playerStats.headshots

        try {
          await this.repository.createPlayerHistory({
            playerId: playerStats.playerId,
            eventTime: new Date(),
            game: server.game || GameConfig.getDefaultGame(),
            kills: playerStats.kills,
            deaths: playerStats.deaths,
            suicides: playerStats.suicides,
            skill: this.calculatePlayerScore(playerStats),
            shots: playerStats.shots,
            hits: playerStats.hits,
            headshots: playerStats.headshots,
            teamkills: playerStats.teamkills,
          })
        } catch (error) {
          this.logger.warn(
            `Failed to create player history for player ${playerStats.playerId}: ${error instanceof Error ? error.message : String(error)}`,
          )
          // Continue with other players instead of failing the entire operation
        }
      }

      if (totalKills > 0 || totalHeadshots > 0) {
        await this.repository.updateMapCount(server.game, mapName, totalKills, totalHeadshots)
      }

      this.logger.info(`Match statistics saved to database for server ${serverId}`)
    } catch (error) {
      this.logger.failed(
        `Failed to save match statistics to database for server ${serverId}`,
        error instanceof Error ? error.message : String(error),
      )
    }
  }
}
