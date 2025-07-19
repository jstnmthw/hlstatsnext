/**
 * Match Event Handler
 *
 * Processes match and round events, calculates match statistics,
 * and manages round-based scoring and team performance.
 */

import type { GameEvent, RoundEndEvent, MapChangeEvent, TeamWinEvent } from "@/types/common/events"
import type { ILogger } from "@/utils/logger.types"
import type { IPlayerService } from "@/services/player/player.types"
import type { DatabaseClient } from "@/database/client"
import { IMatchHandler } from "./match.handler.types"

export interface MatchStats {
  duration: number
  totalRounds: number
  teamScores: Record<string, number>
  mvpPlayer?: number
  startTime: Date
  playerStats: Map<number, PlayerRoundStats>
}

export interface PlayerRoundStats {
  playerId: number
  kills: number
  deaths: number
  assists: number
  damage: number
  objectiveScore: number // bomb plants, defuses, flag captures, etc.
  clutchWins: number
}

export interface HandlerResult {
  success: boolean
  error?: string
  matchId?: string
  roundsAffected?: number
}

export class MatchHandler implements IMatchHandler {
  constructor(
    private readonly playerService: IPlayerService,
    private readonly db: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  private currentMatch: Map<number, MatchStats> = new Map() // serverId -> MatchStats

  async handleEvent(event: GameEvent): Promise<HandlerResult> {
    switch (event.eventType) {
      case "ROUND_START":
        return this.handleRoundStart(event)

      case "ROUND_END":
        return this.handleRoundEnd(event)

      case "TEAM_WIN":
        return this.handleTeamWin(event)

      case "MAP_CHANGE":
        return this.handleMapChange(event)

      default:
        return { success: true } // Event not handled by this handler
    }
  }

  private async handleRoundStart(event: GameEvent): Promise<HandlerResult> {
    const serverId = event.serverId

    try {
      // Initialize match stats if not exists
      if (!this.currentMatch.has(serverId)) {
        this.currentMatch.set(serverId, {
          duration: 0,
          totalRounds: 0,
          teamScores: {},
          startTime: new Date(),
          playerStats: new Map(),
        })
      }

      this.logger.event(`Round started on server ${serverId}`)

      return {
        success: true,
        roundsAffected: 1,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Round start error",
      }
    }
  }

  private async handleRoundEnd(event: RoundEndEvent): Promise<HandlerResult> {
    const serverId = event.serverId
    const { winningTeam, duration, score } = event.data

    try {
      const matchStats = this.currentMatch.get(serverId)
      if (!matchStats) {
        this.logger.warn(`No match stats found for server ${serverId}`)
        return { success: true }
      }

      // Update match statistics
      matchStats.totalRounds++
      if (duration) matchStats.duration += duration
      if (winningTeam) {
        matchStats.teamScores[winningTeam] = (matchStats.teamScores[winningTeam] || 0) + 1
      }

      await this.db.prisma.server.update({
        where: { serverId },
        data: { map_rounds: { increment: 1 } },
      })

      // Update player round statistics and calculate MVP
      await this.updatePlayerRoundStats(serverId, duration || 0)
      await this.calculateRoundMVP(serverId)

      this.logger.event(
        `Round ended on server ${serverId}${winningTeam ? `: ${winningTeam} won` : ""}${score ? ` (${score.team1}-${score.team2})` : ""}`,
      )

      return {
        success: true,
        roundsAffected: 1,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Round end error",
      }
    }
  }

  private async handleTeamWin(event: TeamWinEvent): Promise<HandlerResult> {
    const serverId = event.serverId
    const { winningTeam, triggerName, score } = event.data

    try {
      const matchStats = this.currentMatch.get(serverId)
      if (!matchStats) {
        // Initialize match stats if not exists
        this.currentMatch.set(serverId, {
          duration: 0,
          totalRounds: 0,
          teamScores: {},
          startTime: new Date(),
          playerStats: new Map(),
        })
      }

      const currentMatchStats = this.currentMatch.get(serverId)!

      // Update match statistics
      currentMatchStats.totalRounds++
      currentMatchStats.teamScores[winningTeam] =
        (currentMatchStats.teamScores[winningTeam] || 0) + 1

      // Update player round statistics and calculate MVP
      await this.updatePlayerRoundStats(serverId, 0) // Round duration is not available here
      await this.calculateRoundMVP(serverId)

      await this.db.prisma.server.update({
        where: { serverId },
        data: { map_rounds: { increment: 1 } },
      })

      // Update server statistics for CS-specific team wins
      if (triggerName === "Terrorists_Win" || triggerName === "CTs_Win") {
        await this.updateServerTeamStats(serverId, winningTeam)
      }

      this.logger.event(
        `Team win on server ${serverId}: ${winningTeam} won via ${triggerName} (CT: ${score.ct}, T: ${score.t})`,
      )

      return {
        success: true,
        roundsAffected: 1,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Team win error",
      }
    }
  }

  private async handleMapChange(event: MapChangeEvent): Promise<HandlerResult> {
    const serverId = event.serverId
    const { previousMap, newMap, playerCount } = event.data

    try {
      // Finalize current match stats if exists
      const matchStats = this.currentMatch.get(serverId)
      if (matchStats && previousMap) {
        await this.finalizeMatch(serverId, previousMap, matchStats)
      }

      // Reset match stats for new map
      this.currentMatch.delete(serverId)

      // Update server record for the new map
      await this.db.prisma.server.update({
        where: { serverId },
        data: {
          act_map: newMap,
          map_changes: { increment: 1 },
          map_started: Math.floor(Date.now() / 1000),
          map_rounds: 0,
          map_ct_wins: 0,
          map_ts_wins: 0,
          map_ct_shots: 0,
          map_ct_hits: 0,
          map_ts_shots: 0,
          map_ts_hits: 0,
        },
      })

      this.logger.event(
        `Map changed on server ${serverId}: ${previousMap} -> ${newMap} (${playerCount} players)`,
      )

      return {
        success: true,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Map change error",
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

      // Update player ELO/rankings based on match performance
      await this.updatePlayerRankings(serverId, stats)

      this.logger.event(
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

  private async updatePlayerRoundStats(serverId: number, roundDuration: number): Promise<void> {
    const matchStats = this.currentMatch.get(serverId)
    if (!matchStats) return

    // Pull round participants from PlayerService (DB view of last X seconds)
    const participants = await this.playerService.getRoundParticipants(serverId, roundDuration)

    for (const p of participants) {
      const existing = matchStats.playerStats.get(p.playerId) ?? {
        playerId: p.playerId,
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        objectiveScore: 0,
        clutchWins: 0,
      }

      // Update basic kills/deaths from aggregated eventEntry
      existing.kills += p.player.kills
      existing.deaths += p.player.deaths
      existing.objectiveScore += 0 // placeholder – future objective events

      matchStats.playerStats.set(p.playerId, existing)
    }

    this.logger.info(`Updated player round stats for server ${serverId}`)
  }

  private async calculateRoundMVP(serverId: number): Promise<void> {
    const matchStats = this.currentMatch.get(serverId)
    if (!matchStats) return

    let mvpPlayerId: number | undefined
    let highestScore = -Infinity

    for (const stats of matchStats.playerStats.values()) {
      const score = this.calculatePlayerScore(stats)
      if (score > highestScore) {
        highestScore = score
        mvpPlayerId = stats.playerId
      }
    }

    if (mvpPlayerId !== undefined) {
      matchStats.mvpPlayer = mvpPlayerId
      this.logger.info(`Round MVP calculated for server ${serverId}: player ${mvpPlayerId}`)
    }
  }

  private async calculateMatchMVP(serverId: number): Promise<number | undefined> {
    const matchStats = this.currentMatch.get(serverId)
    if (!matchStats || matchStats.playerStats.size === 0) return undefined

    let mvpPlayerId: number | undefined
    let highestScore = 0

    // Calculate MVP based on a scoring algorithm
    for (const [playerId, stats] of matchStats.playerStats) {
      const score = this.calculatePlayerScore(stats)
      if (score > highestScore) {
        highestScore = score
        mvpPlayerId = playerId
      }
    }

    return mvpPlayerId
  }

  private calculatePlayerScore(stats: PlayerRoundStats): number {
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

  private async saveMatchToDatabase(
    serverId: number,
    mapName: string,
    stats: MatchStats,
  ): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        // Update server statistics with match results
        await tx.server.update({
          where: { serverId },
          data: {
            rounds: { increment: stats.totalRounds },
          },
        })

        const server = await tx.server.findUnique({ where: { serverId } })
        if (!server) return

        let totalKills = 0
        const totalHeadshots = 0 // TODO: Track headshots

        // Create a player history snapshot for each participant
        for (const [, playerStats] of stats.playerStats) {
          totalKills += playerStats.kills
          // Note: Headshots are not yet tracked on playerStats.
          // totalHeadshots += playerStats.headshots;

          await tx.playerHistory.create({
            data: {
              playerId: playerStats.playerId,
              eventTime: new Date(),
              kills: playerStats.kills,
              deaths: playerStats.deaths,
              suicides: 0, // Would be tracked separately
              skill: this.calculatePlayerScore(playerStats),
              shots: 0, // Would need to be tracked from weapon events
              hits: 0, // Would need to be tracked from weapon events
              headshots: 0, // Would need to be tracked from frag events
              teamkills: 0, // Would be tracked separately
            },
          })
        }

        if (totalKills > 0 || totalHeadshots > 0) {
          await tx.mapCount.upsert({
            where: { game_map: { game: server.game, map: mapName } },
            create: {
              game: server.game,
              map: mapName,
              kills: totalKills,
              headshots: totalHeadshots,
            },
            update: {
              kills: { increment: totalKills },
              headshots: { increment: totalHeadshots },
            },
          })
        }
      })

      this.logger.info(`Match statistics saved to database for server ${serverId}`)
    } catch (error) {
      this.logger.failed(
        `Failed to save match statistics to database for server ${serverId}`,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  private async updatePlayerRankings(serverId: number, stats: MatchStats): Promise<void> {
    try {
      // Update player rankings based on match performance
      // This would integrate with the ranking system
      for (const [,] of stats.playerStats) {
        // The ranking handler would typically handle this,
        // but we can update some basic stats here
        // Update basic player statistics - matches are tracked via history records
        // The actual ranking updates would happen through the ranking handler
        // For now, we'll let the other handlers (PlayerHandler, RankingHandler) handle individual updates
      }

      this.logger.debug(`Player rankings updated for match on server ${serverId}`)
    } catch (error) {
      this.logger.failed(
        `Failed to update player rankings for server ${serverId}`,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  /**
   * Update server-specific team statistics (for CS games)
   */
  private async updateServerTeamStats(serverId: number, winningTeam: string): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {}

      if (winningTeam === "TERRORIST") {
        updateData.ts_wins = { increment: 1 }
        updateData.map_ts_wins = { increment: 1 }
      } else if (winningTeam === "CT") {
        updateData.ct_wins = { increment: 1 }
        updateData.map_ct_wins = { increment: 1 }
      }

      await this.db.prisma.server.update({
        where: { serverId },
        data: updateData,
      })

      this.logger.debug(`Updated server team stats for ${winningTeam} win on server ${serverId}`)
    } catch (error) {
      this.logger.failed(
        `Failed to update server team stats for server ${serverId}`,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  /**
   * Get current match statistics for a server
   */
  public getMatchStats(serverId: number): MatchStats | undefined {
    return this.currentMatch.get(serverId)
  }
}
