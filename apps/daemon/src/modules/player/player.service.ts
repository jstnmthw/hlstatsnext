/**
 * Player Service
 *
 * Business logic for player management, statistics, and ratings.
 */

import type {
  IPlayerService,
  IPlayerRepository,
  PlayerStatsUpdate,
  SkillRating,
  RatingUpdate,
  PlayerEvent,
  PlayerKillEvent,
} from "./player.types"
import type { Player } from "@repo/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { KillContext } from "@/modules/ranking/ranking.service"
import type { HandlerResult } from "@/shared/types/common"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IMatchService } from "@/modules/match/match.types"
import { EventType } from "@/shared/types/events"
import { validateSteamId, validatePlayerName, sanitizePlayerName } from "@/shared/utils/validation"

export class PlayerService implements IPlayerService {
  // Rating system constants
  private readonly DEFAULT_RATING = 1000
  private readonly DEFAULT_CONFIDENCE = 350
  private readonly DEFAULT_VOLATILITY = 0.06
  private readonly MAX_CONFIDENCE_REDUCTION = 300
  private readonly UNIX_TIMESTAMP_DIVISOR = 1000

  constructor(
    private readonly repository: IPlayerRepository,
    private readonly logger: ILogger,
    private readonly rankingService: IRankingService,
    private readonly matchService?: IMatchService,
  ) {}

  async getOrCreatePlayer(steamId: string, playerName: string, game: string): Promise<number> {
    if (!validateSteamId(steamId)) {
      throw new Error(`Invalid Steam ID: ${steamId}`)
    }

    if (!validatePlayerName(playerName)) {
      throw new Error(`Invalid player name: ${playerName}`)
    }

    const isBot = steamId.toUpperCase() === "BOT"
    const normalizedName = sanitizePlayerName(playerName)
    const effectiveId = isBot ? `BOT_${normalizedName}` : steamId

    try {
      // First, try to find existing player by Steam ID
      const existingPlayer = await this.repository.findByUniqueId(effectiveId, game)

      if (existingPlayer) {
        return existingPlayer.playerId
      }

      // Create new player
      const player = await this.repository.create({
        lastName: playerName,
        game,
        skill: this.DEFAULT_RATING,
        steamId: effectiveId,
      })

      this.logger.info(
        `Created new player: ${playerName} (${effectiveId}) with ID ${player.playerId}`,
      )
      return player.playerId
    } catch (error) {
      this.logger.error(`Failed to get or create player ${playerName}: ${error}`)
      throw error
    }
  }

  async getPlayerStats(playerId: number): Promise<Player | null> {
    try {
      return await this.repository.findById(playerId)
    } catch (error) {
      this.logger.error(`Failed to get player stats for ${playerId}: ${error}`)
      return null
    }
  }

  async updatePlayerStats(playerId: number, updates: PlayerStatsUpdate): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {}

      // Build increment operations for numeric fields
      if (updates.kills !== undefined) {
        updateData.kills = { increment: updates.kills }
      }
      if (updates.deaths !== undefined) {
        updateData.deaths = { increment: updates.deaths }
      }
      if (updates.suicides !== undefined) {
        updateData.suicides = { increment: updates.suicides }
      }
      if (updates.teamkills !== undefined) {
        updateData.teamkills = { increment: updates.teamkills }
      }
      if (updates.skill !== undefined) {
        updateData.skill = { increment: updates.skill }
        // Update last skill change timestamp when skill is modified
        updateData.last_skill_change = Math.floor(Date.now() / this.UNIX_TIMESTAMP_DIVISOR)
      }
      if (updates.shots !== undefined) {
        updateData.shots = { increment: updates.shots }
      }
      if (updates.hits !== undefined) {
        updateData.hits = { increment: updates.hits }
      }
      if (updates.headshots !== undefined) {
        updateData.headshots = { increment: updates.headshots }
      }
      if (updates.connection_time !== undefined) {
        updateData.connection_time = { increment: updates.connection_time }
      }

      // Direct value updates
      if (updates.kill_streak !== undefined) {
        updateData.kill_streak = updates.kill_streak
      }
      if (updates.death_streak !== undefined) {
        updateData.death_streak = updates.death_streak
      }
      if (updates.last_event !== undefined) {
        updateData.last_event = updates.last_event
      }
      if (updates.lastName !== undefined) {
        updateData.lastName = updates.lastName
      }

      await this.repository.update(playerId, updateData as Partial<Player>)
      this.logger.debug(`Updated player stats for ${playerId}`)
    } catch (error) {
      this.logger.error(`Failed to update player stats for ${playerId}: ${error}`)
      throw error
    }
  }

  async getPlayerRating(playerId: number): Promise<SkillRating> {
    try {
      const player = await this.repository.findById(playerId, {
        select: {
          skill: true,
          _count: {
            select: {
              fragsAsKiller: true,
            },
          },
        },
      })

      if (!player) {
        // Return default rating for new players
        return {
          playerId,
          rating: this.DEFAULT_RATING,
          confidence: this.DEFAULT_CONFIDENCE,
          volatility: this.DEFAULT_VOLATILITY,
          gamesPlayed: 0,
        }
      }

      // Confidence decreases with experience (more games = more confident rating)
      const confidenceReduction = Math.min(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (player as any)._count.fragsAsKiller,
        this.MAX_CONFIDENCE_REDUCTION,
      )
      const adjustedConfidence = this.DEFAULT_CONFIDENCE - confidenceReduction

      return {
        playerId,
        rating: player.skill,
        confidence: adjustedConfidence,
        volatility: this.DEFAULT_VOLATILITY,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gamesPlayed: (player as any)._count.fragsAsKiller,
      }
    } catch (error) {
      this.logger.error(`Failed to get player rating for ${playerId}: ${error}`)
      // Return default rating on error
      return {
        playerId,
        rating: this.DEFAULT_RATING,
        confidence: this.DEFAULT_CONFIDENCE,
        volatility: this.DEFAULT_VOLATILITY,
        gamesPlayed: 0,
      }
    }
  }

  async updatePlayerRatings(updates: RatingUpdate[]): Promise<void> {
    try {
      // Update all players in a transaction
      await Promise.all(
        updates.map((update) =>
          this.repository.update(update.playerId, {
            skill: update.newRating,
            last_skill_change: Math.floor(Date.now() / this.UNIX_TIMESTAMP_DIVISOR),
          }),
        ),
      )

      this.logger.debug(`Updated ratings for ${updates.length} players`)
    } catch (error) {
      this.logger.error(`Failed to update player ratings: ${error}`)
      throw error
    }
  }

  async getTopPlayers(
    limit: number = 50,
    game: string = "cstrike",
    includeHidden: boolean = false,
  ): Promise<Player[]> {
    try {
      return await this.repository.findTopPlayers(limit, game, includeHidden)
    } catch (error) {
      this.logger.error(`Failed to get top players: ${error}`)
      return []
    }
  }

  async getRoundParticipants(serverId: number, duration: number): Promise<unknown[]> {
    try {
      const durationMs = duration * this.UNIX_TIMESTAMP_DIVISOR
      const roundStartTime = new Date(Date.now() - durationMs)

      return await this.repository.findRoundParticipants(serverId, roundStartTime)
    } catch (error) {
      this.logger.error(`Failed to get round participants: ${error}`)
      throw error
    }
  }

  async handlePlayerEvent(event: PlayerEvent): Promise<HandlerResult> {
    try {
      switch (event.eventType) {
        case EventType.PLAYER_CONNECT:
          return await this.handlePlayerConnect(event)
        case EventType.PLAYER_DISCONNECT:
          return await this.handlePlayerDisconnect(event)
        case EventType.PLAYER_ENTRY:
          return await this.handlePlayerEntry()
        case EventType.PLAYER_CHANGE_TEAM:
          return await this.handlePlayerChangeTeam()
        case EventType.PLAYER_CHANGE_ROLE:
          return await this.handlePlayerChangeRole()
        case EventType.PLAYER_CHANGE_NAME:
          return await this.handlePlayerChangeName(event)
        case EventType.PLAYER_SUICIDE:
          return await this.handlePlayerSuicide(event)
        case EventType.PLAYER_DAMAGE:
          return await this.handlePlayerDamage(event)
        case EventType.PLAYER_TEAMKILL:
          return await this.handlePlayerTeamkill(event)
        case EventType.CHAT_MESSAGE:
          return await this.handleChatMessage(event)
        default:
          return { success: true } // Event not handled by this service
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async handleKillEvent(event: PlayerKillEvent): Promise<HandlerResult> {
    try {
      const { killerId, victimId, headshot, weapon, killerTeam, victimTeam } = event.data
      const timestamp = Math.floor(Date.now() / this.UNIX_TIMESTAMP_DIVISOR)

      // Get current player stats for streak tracking
      const [killerStats, victimStats] = await Promise.all([
        this.repository.getPlayerStats(killerId),
        this.repository.getPlayerStats(victimId),
      ])

      if (!killerStats || !victimStats) {
        return {
          success: false,
          error: "Unable to retrieve player stats for skill calculation",
        }
      }

      // Calculate skill changes using the enhanced ranking system
      const killContext: KillContext = {
        weapon: weapon || "unknown",
        headshot: headshot || false,
        killerTeam: killerTeam || "UNKNOWN",
        victimTeam: victimTeam || "UNKNOWN",
      }

      const killerRating: SkillRating = {
        playerId: killerId,
        rating: killerStats.skill || this.DEFAULT_RATING,
        confidence: 1.0, // TODO: Implement confidence tracking
        volatility: this.DEFAULT_VOLATILITY,
        gamesPlayed: killerStats.kills + killerStats.deaths,
      }

      const victimRating: SkillRating = {
        playerId: victimId,
        rating: victimStats.skill || this.DEFAULT_RATING,
        confidence: 1.0,
        volatility: this.DEFAULT_VOLATILITY,
        gamesPlayed: victimStats.kills + victimStats.deaths,
      }

      const skillAdjustment = await this.rankingService.calculateSkillAdjustment(
        killerRating,
        victimRating,
        killContext,
      )

      // Calculate streaks
      const newKillerKillStreak = (killerStats.kill_streak || 0) + 1
      const newVictimDeathStreak = (victimStats.death_streak || 0) + 1

      // Update killer stats
      const killerUpdates: PlayerStatsUpdate = {
        kills: 1,
        skill: skillAdjustment.killerChange,
        kill_streak: newKillerKillStreak,
        death_streak: 0, // Reset death streak on kill
        last_event: timestamp,
      }

      if (headshot) {
        killerUpdates.headshots = 1
      }

      // Handle team kills
      if (killerTeam === victimTeam) {
        killerUpdates.teamkills = 1
        this.logger.warn(`Team kill: ${killerId} -> ${victimId}`)
      }

      // Update victim stats
      const victimUpdates: PlayerStatsUpdate = {
        deaths: 1,
        skill: skillAdjustment.victimChange,
        death_streak: newVictimDeathStreak,
        kill_streak: 0, // Reset kill streak on death
        last_event: timestamp,
      }

      // Apply stat updates and log EventFrag
      await Promise.all([
        this.updatePlayerStats(killerId, killerUpdates),
        this.updatePlayerStats(victimId, victimUpdates),
        // Log EventFrag for historical tracking
        this.repository.logEventFrag(
          killerId,
          victimId,
          event.serverId,
          "", // TODO: Get current map from MatchService
          weapon || "unknown",
          headshot || false,
          undefined, // killerRole - TODO: Get from player roles
          undefined, // victimRole - TODO: Get from player roles
          // Position data from event if available
          undefined, // killerX - TODO: Extract from event.data positions
          undefined, // killerY
          undefined, // killerZ
          undefined, // victimX
          undefined, // victimY
          undefined, // victimZ
        ),
      ])

      // Log kill event
      this.logger.event(
        `Kill event: ${killerId} → ${victimId} (${weapon}${headshot ? ", headshot" : ""})`,
      )

      // Log skill calculation details
      this.logger.event(
        `Skill adjustment: killer ${killerRating.rating} → ${killerRating.rating + skillAdjustment.killerChange} ` +
          `(${skillAdjustment.killerChange > 0 ? "+" : ""}${skillAdjustment.killerChange}), ` +
          `victim ${victimRating.rating} → ${victimRating.rating + skillAdjustment.victimChange} ` +
          `(${skillAdjustment.victimChange})`,
      )

      return { success: true, affected: 2 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handlePlayerConnect(event: PlayerEvent): Promise<HandlerResult> {
    try {
      // Player ID should already be resolved by event processor
      if (event.eventType !== EventType.PLAYER_CONNECT) {
        return { success: false, error: "Invalid event type for handlePlayerConnect" }
      }
      const { playerId } = event.data

      await this.updatePlayerStats(playerId, {
        last_event: Math.floor(Date.now() / this.UNIX_TIMESTAMP_DIVISOR),
      })

      this.logger.event(`Player connected: ${playerId}`)

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handlePlayerDisconnect(event: PlayerEvent): Promise<HandlerResult> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { playerId, sessionDuration } = (event as any).data

      const updates: PlayerStatsUpdate = {
        last_event: Math.floor(Date.now() / this.UNIX_TIMESTAMP_DIVISOR),
      }

      if (sessionDuration) {
        updates.connection_time = sessionDuration
      }

      await this.updatePlayerStats(playerId, updates)

      this.logger.event(`Player disconnected: ${playerId}`)

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handlePlayerEntry(): Promise<HandlerResult> {
    // Player entry is typically just logging, no stats update needed
    return { success: true }
  }

  private async handlePlayerChangeTeam(): Promise<HandlerResult> {
    // Team changes don't affect stats directly
    return { success: true }
  }

  private async handlePlayerChangeRole(): Promise<HandlerResult> {
    // Role changes don't affect stats directly
    return { success: true }
  }

  private async handlePlayerChangeName(event: PlayerEvent): Promise<HandlerResult> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { playerId, newName } = (event as any).data

      await this.updatePlayerStats(playerId, {
        lastName: newName,
        last_event: Math.floor(Date.now() / this.UNIX_TIMESTAMP_DIVISOR),
      })

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handlePlayerSuicide(event: PlayerEvent): Promise<HandlerResult> {
    try {
      if (event.eventType !== EventType.PLAYER_SUICIDE) {
        return { success: false, error: "Invalid event type for handlePlayerSuicide" }
      }

      const { playerId } = event.data
      const timestamp = Math.floor(Date.now() / this.UNIX_TIMESTAMP_DIVISOR)

      // Get current player stats for streak tracking
      const playerStats = await this.repository.getPlayerStats(playerId)

      if (!playerStats) {
        return {
          success: false,
          error: "Unable to retrieve player stats for suicide processing",
        }
      }

      // Calculate skill penalty for suicide
      const skillPenalty = this.rankingService.calculateSuicidePenalty()

      // Update death streak, reset kill streak
      const newDeathStreak = (playerStats.death_streak || 0) + 1

      const updates: PlayerStatsUpdate = {
        suicides: 1,
        deaths: 1, // Suicide also counts as death
        skill: skillPenalty,
        death_streak: newDeathStreak,
        kill_streak: 0, // Reset kill streak on death
        last_event: timestamp,
      }

      await this.updatePlayerStats(playerId, updates)

      this.logger.event(`Player suicide: ${playerId} (penalty: ${skillPenalty})`)

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handlePlayerDamage(event: PlayerEvent): Promise<HandlerResult> {
    try {
      if (event.eventType !== EventType.PLAYER_DAMAGE) {
        return { success: false, error: "Invalid event type for handlePlayerDamage" }
      }

      const { attackerId, victimId, weapon, damage, hitgroup } = event.data
      const timestamp = Math.floor(Date.now() / this.UNIX_TIMESTAMP_DIVISOR)

      // Update attacker's shots and hits statistics
      const attackerUpdates: PlayerStatsUpdate = {
        shots: 1, // Each damage event counts as a hit
        hits: 1,
        last_event: timestamp,
      }

      // If it's a headshot, update headshot count
      if (hitgroup === "head") {
        attackerUpdates.headshots = 1
      }

      await this.updatePlayerStats(attackerId, attackerUpdates)

      // Log damage event for accuracy tracking
      this.logger.debug(
        `Damage: ${attackerId} -> ${victimId} (${damage} damage with ${weapon}, hitgroup: ${hitgroup})`,
      )

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handlePlayerTeamkill(event: PlayerEvent): Promise<HandlerResult> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { killerId, victimId, headshot } = (event as any).data

      // Update killer stats (teamkill)
      const killerUpdates: PlayerStatsUpdate = {
        teamkills: 1,
        last_event: Math.floor(Date.now() / this.UNIX_TIMESTAMP_DIVISOR),
      }

      if (headshot) {
        killerUpdates.headshots = 1
      }

      // Update victim stats (death)
      const victimUpdates: PlayerStatsUpdate = {
        deaths: 1,
        last_event: Math.floor(Date.now() / this.UNIX_TIMESTAMP_DIVISOR),
      }

      await Promise.all([
        this.updatePlayerStats(killerId, killerUpdates),
        this.updatePlayerStats(victimId, victimUpdates),
      ])

      return { success: true, affected: 2 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handleChatMessage(event: PlayerEvent): Promise<HandlerResult> {
    try {
      // Type guard to ensure we have the correct event type
      if (event.eventType !== EventType.CHAT_MESSAGE) {
        return { success: false, error: "Invalid event type for handleChatMessage" }
      }

      const { playerId, message, messageMode } = event.data

      // Get current map from the match service, initialize if needed
      let map = this.matchService?.getCurrentMap(event.serverId) || ""
      if (map === "unknown" && this.matchService) {
        map = await this.matchService.initializeMapForServer(event.serverId)
      }

      // Store chat message in database
      await this.repository.createChatEvent(
        playerId,
        event.serverId,
        map,
        message,
        messageMode || 0,
      )

      this.logger.event(`Chat message: ${playerId}: "${message}"`)

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
