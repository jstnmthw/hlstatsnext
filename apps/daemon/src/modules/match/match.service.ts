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
  RoundStartEvent,
  RoundEndEvent,
  TeamWinEvent,
  MapChangeEvent,
} from "./match.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IMapService } from "@/modules/map/map.service"
import type { HandlerResult } from "@/shared/types/common"
import { EventType } from "@/shared/types/events"

export class MatchService implements IMatchService {
  private currentMatches: Map<number, MatchStats> = new Map() // serverId → MatchStats

  constructor(
    private readonly repository: IMatchRepository,
    private readonly logger: ILogger,
    private readonly mapService?: IMapService,
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

  // Kill events are handled by PlayerService - no match-level tracking needed

  // MVP calculation removed - feature not used in production

  // Objective/action events are handled by ActionService - no match-level tracking needed

  getMatchStats(serverId: number): MatchStats | undefined {
    return this.currentMatches.get(serverId)
  }

  resetMatchStats(serverId: number): void {
    this.currentMatches.delete(serverId)
    this.logger.info(`Reset match statistics for server ${serverId}`)
  }

  // Weapon stats tracking removed - not used in production

  // Player scoring removed - was only used for MVP calculation

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

  // Player stats creation removed - handled by PlayerService

  /**
   * Ensure match stats are initialized for a server
   */
  private ensureMatchStatsInitialized(serverId: number): void {
    if (!this.currentMatches.has(serverId)) {
      this.currentMatches.set(serverId, {
        duration: 0,
        totalRounds: 0,
        teamScores: {},
        startTime: new Date(),
        playerTeams: new Map(),
      })
    }
  }

  private async handleRoundStart(event: RoundStartEvent): Promise<HandlerResult> {
    const serverId = event.serverId

    try {
      // Ensure match stats are initialized
      this.ensureMatchStatsInitialized(serverId)

      // Notify MapService about potential map change and get authoritative map
      let currentMap = "unknown"
      if (this.mapService) {
        await this.mapService.handleMapChange(serverId, event.data.map, undefined)
        currentMap = await this.mapService.getCurrentMap(serverId)
      } else {
        // Fallback to event data if MapService unavailable
        currentMap = event.data.map
      }

      this.logger.debug(`Round started on server ${serverId}, map: ${currentMap}`)

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
      // Ensure match stats are initialized
      this.ensureMatchStatsInitialized(serverId)
      const matchStats = this.currentMatches.get(serverId)!

      // Update match statistics
      matchStats.totalRounds++
      if (duration) matchStats.duration += duration
      if (winningTeam) {
        matchStats.teamScores[winningTeam] = (matchStats.teamScores[winningTeam] || 0) + 1
      }

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
      // Ensure match stats are initialized
      this.ensureMatchStatsInitialized(serverId)
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
        playerTeams: new Map(),
      }
      this.currentMatches.set(serverId, newMatchStats)

      // Notify MapService about map change and get authoritative map
      let authoritativeMap = newMap // fallback
      if (this.mapService) {
        await this.mapService.handleMapChange(serverId, newMap, previousMap)
        authoritativeMap = await this.mapService.getCurrentMap(serverId)
      }

      // Update server record with authoritative map
      if (typeof playerCount === "number") {
        await this.repository.resetMapStats(serverId, authoritativeMap, playerCount)
      } else {
        await this.repository.resetMapStats(serverId, authoritativeMap)
      }

      this.logger.debug(
        `Map changed on server ${serverId}: ${previousMap} → ${authoritativeMap} (${playerCount} players)`,
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
      // Save match statistics to database
      await this.saveMatchToDatabase(serverId)

      this.logger.debug(
        `Match finalized on server ${serverId} for map ${mapName}: ${stats.totalRounds} rounds, ${stats.duration}s, scores: ${JSON.stringify(
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

  private async saveMatchToDatabase(serverId: number): Promise<void> {
    try {
      const server = await this.repository.findServerById(serverId)
      if (!server) return

      // Player history is managed by PlayerService - no match-level tracking needed

      this.logger.info(`Match statistics saved to database for server ${serverId}`)
    } catch (error) {
      this.logger.failed(
        `Failed to save match statistics to database for server ${serverId}`,
        error instanceof Error ? error.message : String(error),
      )
    }
  }
}
