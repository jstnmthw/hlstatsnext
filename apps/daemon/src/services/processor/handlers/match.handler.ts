/**
 * Match Event Handler
 *
 * Processes match and round events, calculates match statistics,
 * and manages round-based scoring and team performance.
 */

import type { 
  GameEvent, 
  RoundEndEvent, 
  MapChangeEvent, 
  TeamWinEvent,
  BombPlantEvent,
  BombDefuseEvent,
  BombExplodeEvent,
  HostageRescueEvent,
  HostageTouchEvent,
  FlagCaptureEvent,
  FlagDefendEvent,
  FlagPickupEvent,
  FlagDropEvent,
  ControlPointCaptureEvent,
  ControlPointDefendEvent,
  PlayerKillEvent,
  PlayerSuicideEvent,
  PlayerTeamkillEvent
} from "@/types/common/events"
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
  headshots: number
  shots: number
  hits: number
  suicides: number
  teamkills: number
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

      case "BOMB_PLANT":
      case "BOMB_DEFUSE":
      case "BOMB_EXPLODE":
      case "HOSTAGE_RESCUE":
      case "HOSTAGE_TOUCH":
      case "FLAG_CAPTURE":
      case "FLAG_DEFEND":
      case "FLAG_PICKUP":
      case "FLAG_DROP":
      case "CONTROL_POINT_CAPTURE":
      case "CONTROL_POINT_DEFEND":
        return this.handleObjectiveEvent(event)

      case "PLAYER_KILL":
        return this.handlePlayerKillEvent(event)

      case "PLAYER_SUICIDE":
        return this.handlePlayerSuicideEvent(event)

      case "PLAYER_TEAMKILL":
        return this.handlePlayerTeamkillEvent(event)

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
      const existing = matchStats.playerStats.get(p.playerId) ?? this.createEmptyPlayerStats(p.playerId)

      // Calculate delta from previous round stats to get round-specific stats
      const previousTotal = {
        kills: existing.kills,
        deaths: existing.deaths,
        teamkills: existing.teamkills,
      }

      // Update with current totals from getRoundParticipants (only available fields)
      // Note: getRoundParticipants only returns skill, teamkills, kills, deaths
      // Other stats (headshots, suicides, shots, hits) are tracked in real-time via event handlers
      existing.kills = p.player.kills
      existing.deaths = p.player.deaths  
      existing.teamkills = p.player.teamkills

      // Log round delta for debugging
      const roundDelta = {
        kills: existing.kills - previousTotal.kills,
        deaths: existing.deaths - previousTotal.deaths,
        teamkills: existing.teamkills - previousTotal.teamkills,
      }

      if (roundDelta.kills > 0 || roundDelta.deaths > 0) {
        this.logger.debug(
          `Player ${p.playerId} round stats delta: +${roundDelta.kills} kills, +${roundDelta.deaths} deaths, +${roundDelta.teamkills} teamkills`
        )
      }

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
        let totalHeadshots = 0

        // Create a player history snapshot for each participant
        for (const [, playerStats] of stats.playerStats) {
          totalKills += playerStats.kills
          totalHeadshots += playerStats.headshots

          await tx.playerHistory.create({
            data: {
              playerId: playerStats.playerId,
              eventTime: new Date(),
              kills: playerStats.kills,
              deaths: playerStats.deaths,
              suicides: playerStats.suicides,
              skill: this.calculatePlayerScore(playerStats),
              shots: playerStats.shots,
              hits: playerStats.hits,
              headshots: playerStats.headshots,
              teamkills: playerStats.teamkills,
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

  private async handleObjectiveEvent(event: 
    | BombPlantEvent 
    | BombDefuseEvent 
    | BombExplodeEvent
    | HostageRescueEvent 
    | HostageTouchEvent
    | FlagCaptureEvent 
    | FlagDefendEvent
    | FlagPickupEvent
    | FlagDropEvent
    | ControlPointCaptureEvent
    | ControlPointDefendEvent
  ): Promise<HandlerResult> {
    const serverId = event.serverId
    
    try {
      const matchStats = this.currentMatch.get(serverId)
      if (!matchStats) {
        this.logger.warn(`No match stats found for server ${serverId} during objective event`)
        return { success: true }
      }

      // Some events like BOMB_EXPLODE don't have a player ID
      const playerId = 'playerId' in event.data ? event.data.playerId : null
      
      // Update player objective score (only for player-based events)
      if (playerId) {
        const playerStats = matchStats.playerStats.get(playerId) ?? {
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

        // Award objective points based on event type
        const objectivePoints = this.getObjectivePoints(event.eventType)
        playerStats.objectiveScore += objectivePoints
        matchStats.playerStats.set(playerId, playerStats)
      }

      // Update server statistics for bomb events
      if (event.eventType === "BOMB_PLANT") {
        await this.db.prisma.server.update({
          where: { serverId },
          data: { bombs_planted: { increment: 1 } },
        })
      } else if (event.eventType === "BOMB_DEFUSE") {
        await this.db.prisma.server.update({
          where: { serverId },
          data: { bombs_defused: { increment: 1 } },
        })
      }

      this.logger.event(
        `Objective event on server ${serverId}: ${event.eventType}${playerId ? ` by player ${playerId} (+${this.getObjectivePoints(event.eventType)} points)` : ''}`
      )

      return {
        success: true,
        roundsAffected: 0,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Objective event error",
      }
    }
  }

  private getObjectivePoints(eventType: string): number {
    const objectivePointsMap: Record<string, number> = {
      BOMB_PLANT: 3,
      BOMB_DEFUSE: 3,
      BOMB_EXPLODE: 0, // No player points for explosion
      HOSTAGE_RESCUE: 2,
      HOSTAGE_TOUCH: 1,
      FLAG_CAPTURE: 5,
      FLAG_DEFEND: 3,
      FLAG_PICKUP: 1,
      FLAG_DROP: 0,
      CONTROL_POINT_CAPTURE: 4,
      CONTROL_POINT_DEFEND: 2,
    }
    return objectivePointsMap[eventType] || 1
  }

  private async handlePlayerKillEvent(event: PlayerKillEvent): Promise<HandlerResult> {
    const serverId = event.serverId
    
    try {
      const matchStats = this.currentMatch.get(serverId)
      if (!matchStats) {
        this.logger.warn(`No match stats found for server ${serverId} during kill event`)
        return { success: true }
      }

      const { killerId, victimId, headshot } = event.data

      // Update killer stats
      const killerStats = matchStats.playerStats.get(killerId) ?? this.createEmptyPlayerStats(killerId)
      killerStats.kills += 1
      if (headshot) {
        killerStats.headshots += 1
      }
      matchStats.playerStats.set(killerId, killerStats)

      // Update victim stats
      const victimStats = matchStats.playerStats.get(victimId) ?? this.createEmptyPlayerStats(victimId)
      victimStats.deaths += 1
      matchStats.playerStats.set(victimId, victimStats)

      this.logger.debug(
        `Kill event processed: player ${killerId} killed player ${victimId}${headshot ? ' (headshot)' : ''}`
      )

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Kill event error",
      }
    }
  }

  private async handlePlayerSuicideEvent(event: PlayerSuicideEvent): Promise<HandlerResult> {
    const serverId = event.serverId
    
    try {
      const matchStats = this.currentMatch.get(serverId)
      if (!matchStats) {
        this.logger.warn(`No match stats found for server ${serverId} during suicide event`)
        return { success: true }
      }

      const { playerId } = event.data
      const playerStats = matchStats.playerStats.get(playerId) ?? this.createEmptyPlayerStats(playerId)
      playerStats.suicides += 1
      playerStats.deaths += 1 // Suicide also counts as a death
      matchStats.playerStats.set(playerId, playerStats)

      this.logger.debug(`Suicide event processed: player ${playerId}`)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Suicide event error",
      }
    }
  }

  private async handlePlayerTeamkillEvent(event: PlayerTeamkillEvent): Promise<HandlerResult> {
    const serverId = event.serverId
    
    try {
      const matchStats = this.currentMatch.get(serverId)
      if (!matchStats) {
        this.logger.warn(`No match stats found for server ${serverId} during teamkill event`)
        return { success: true }
      }

      const { killerId, victimId, headshot } = event.data

      // Update killer stats
      const killerStats = matchStats.playerStats.get(killerId) ?? this.createEmptyPlayerStats(killerId)
      killerStats.teamkills += 1
      if (headshot) {
        killerStats.headshots += 1
      }
      matchStats.playerStats.set(killerId, killerStats)

      // Update victim stats  
      const victimStats = matchStats.playerStats.get(victimId) ?? this.createEmptyPlayerStats(victimId)
      victimStats.deaths += 1
      matchStats.playerStats.set(victimId, victimStats)

      this.logger.debug(
        `Teamkill event processed: player ${killerId} teamkilled player ${victimId}${headshot ? ' (headshot)' : ''}`
      )

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Teamkill event error",
      }
    }
  }

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

  /**
   * Add weapon statistics to player match stats
   * This method can be called by other handlers (like WeaponHandler) to update match stats
   */
  public updatePlayerWeaponStats(
    serverId: number, 
    playerId: number, 
    stats: { shots?: number; hits?: number; damage?: number }
  ): void {
    const matchStats = this.currentMatch.get(serverId)
    if (!matchStats) return

    const playerStats = matchStats.playerStats.get(playerId) ?? this.createEmptyPlayerStats(playerId)
    
    if (stats.shots) playerStats.shots += stats.shots
    if (stats.hits) playerStats.hits += stats.hits
    if (stats.damage) playerStats.damage += stats.damage

    matchStats.playerStats.set(playerId, playerStats)
    
    this.logger.debug(
      `Updated weapon stats for player ${playerId}: +${stats.shots || 0} shots, +${stats.hits || 0} hits, +${stats.damage || 0} damage`
    )
  }

  /**
   * Reset match statistics for a server (useful for new matches)
   */
  public resetMatchStats(serverId: number): void {
    this.currentMatch.delete(serverId)
    this.logger.info(`Reset match statistics for server ${serverId}`)
  }
}
