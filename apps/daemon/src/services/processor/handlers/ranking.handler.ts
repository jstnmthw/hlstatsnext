/**
 * Ranking Event Handler
 *
 * Processes events that affect player rankings and skill ratings,
 * implementing ELO-style rating calculations and leaderboard management.
 */

import type { GameEvent, PlayerKillEvent, RoundEndEvent } from "@/types/common/events"
import type { IWeaponService } from "@/services/weapon/weapon.types"
import type { IPlayerService } from "@/services/player/player.types"
import type { ILogger } from "@/utils/logger.types"
import type { IRankingHandler } from "./ranking.handler.types"

export interface SkillRating {
  playerId: number
  rating: number
  confidence: number
  volatility: number
  gamesPlayed: number
}

export interface RatingChange {
  playerId: number
  oldRating: number
  newRating: number
  change: number
  reason: string
}

export interface HandlerResult {
  success: boolean
  error?: string
  ratingChanges?: RatingChange[]
}

export class RankingHandler implements IRankingHandler {
  constructor(
    private readonly playerService: IPlayerService,
    private readonly weaponService: IWeaponService,
    private readonly logger: ILogger,
  ) {}

  // ELO rating system constants
  private readonly DEFAULT_K_FACTOR = 32
  private readonly RATING_FLOOR = 100
  private readonly RATING_CEILING = 3000

  // ELO calculation constants
  private readonly ELO_BASE = 10
  private readonly ELO_DIVISOR = 400

  // K-factor adjustments
  private readonly NEW_PLAYER_GAMES_THRESHOLD = 10
  private readonly INTERMEDIATE_PLAYER_GAMES_THRESHOLD = 50
  private readonly HIGH_RATING_THRESHOLD = 2000
  private readonly NEW_PLAYER_K_MULTIPLIER = 1.5
  private readonly INTERMEDIATE_PLAYER_K_MULTIPLIER = 1.2
  private readonly HIGH_RATING_K_MULTIPLIER = 0.8

  // Rating change modifiers
  private readonly HEADSHOT_BONUS_MULTIPLIER = 1.2
  private readonly VICTIM_PENALTY_MULTIPLIER = 0.8
  private readonly MAX_RATING_GAIN = 50
  private readonly MAX_RATING_LOSS = -40

  // Round-based rating constants
  private readonly ROUND_DURATION_DIVISOR = 60
  private readonly MAX_ROUND_BONUS = 5
  private readonly CLEAN_ROUND_BONUS = 2
  private readonly ZERO_TEAMKILLS = 0

  // Event type constants
  private readonly PLAYER_KILL_EVENT = "PLAYER_KILL"
  private readonly ROUND_END_EVENT = "ROUND_END"

  async handleEvent(event: GameEvent): Promise<HandlerResult> {
    switch (event.eventType) {
      case this.PLAYER_KILL_EVENT:
        return this.handleKillRating(event)

      case this.ROUND_END_EVENT:
        return this.handleRoundRating(event)

      default:
        return { success: true } // Event not handled by this handler
    }
  }

  private async handleKillRating(event: PlayerKillEvent): Promise<HandlerResult> {
    const { killerId, victimId, headshot, weapon } = event.data

    try {
      // Get current ratings from player service
      const [killerRating, victimRating] = await Promise.all([
        this.playerService.getPlayerRating(killerId),
        this.playerService.getPlayerRating(victimId),
      ])

      // Resolve weapon multiplier from weapon service
      const weaponMultiplier = await this.weaponService.getSkillMultiplier(undefined, weapon)

      // Calculate rating changes for kill/death
      const changes = this.calculateKillRatingChange(killerRating, victimRating, {
        headshot,
        weaponMultiplier,
      })

      // Update ratings in database via player service
      await this.playerService.updatePlayerRatings([
        {
          playerId: killerId,
          newRating: killerRating.rating + changes.killer,
          gamesPlayed: killerRating.gamesPlayed + 1,
        },
        {
          playerId: victimId,
          newRating: victimRating.rating + changes.victim,
          gamesPlayed: victimRating.gamesPlayed + 1,
        },
      ])

      this.logger.event(
        `Rating change for kill: Killer ${killerId} (+${changes.killer}), Victim ${victimId} (${changes.victim})`,
      )

      const headshotText = headshot ? " (headshot)" : ""
      return {
        success: true,
        ratingChanges: [
          {
            playerId: killerId,
            oldRating: killerRating.rating,
            newRating: killerRating.rating + changes.killer,
            change: changes.killer,
            reason: `Kill with ${weapon}${headshotText}`,
          },
          {
            playerId: victimId,
            oldRating: victimRating.rating,
            newRating: victimRating.rating + changes.victim,
            change: changes.victim,
            reason: `Death to ${weapon}${headshotText}`,
          },
        ],
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Rating calculation error",
      }
    }
  }

  private async handleRoundRating(event: RoundEndEvent): Promise<HandlerResult> {
    const { winningTeam, duration } = event.data
    const serverId = event.serverId

    // Skip rating updates if we don't have complete round data
    if (!winningTeam || !duration) {
      return { success: true }
    }

    try {
      // Get all players who participated in the round via player service
      const participants = await this.playerService.getRoundParticipants(serverId, duration)

      // Calculate team-based rating adjustments
      const ratingChanges: RatingChange[] = []
      const baseBonus = Math.min(
        Math.floor(duration / this.ROUND_DURATION_DIVISOR),
        this.MAX_ROUND_BONUS,
      )

      for (const participant of participants) {
        const oldRating = participant.player.skill
        let ratingChange = baseBonus

        // Winning team gets extra points
        if (participant.player.teamkills === this.ZERO_TEAMKILLS) {
          // Only reward players who didn't teamkill
          ratingChange += this.CLEAN_ROUND_BONUS
        }

        const playerRating = await this.playerService.getPlayerRating(participant.playerId)

        // Update player rating via player service
        await this.playerService.updatePlayerRatings([
          {
            playerId: participant.playerId,
            newRating: this.clampRating(oldRating + ratingChange),
            gamesPlayed: playerRating.gamesPlayed + 1,
          },
        ])

        const cleanRoundText =
          participant.player.teamkills === this.ZERO_TEAMKILLS ? " (clean round)" : ""
        ratingChanges.push({
          playerId: participant.playerId,
          oldRating,
          newRating: oldRating + ratingChange,
          change: ratingChange,
          reason: `Round participation${cleanRoundText}`,
        })
      }

      this.logger.event(
        `Round rating update for server ${serverId}: ${winningTeam} team won (${duration}s)`,
      )

      return {
        success: true,
        ratingChanges,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Round rating error",
      }
    }
  }

  private calculateKillRatingChange(
    killer: SkillRating,
    victim: SkillRating,
    context: { headshot: boolean; weaponMultiplier: number },
  ): { killer: number; victim: number } {
    // Expected probability of killer winning (ELO formula)
    const ratingDifference = victim.rating - killer.rating
    const expectedKiller = 1 / (1 + Math.pow(this.ELO_BASE, ratingDifference / this.ELO_DIVISOR))

    // Base K-factor adjusted by confidence and game experience
    const killerK = this.getAdjustedKFactor(killer)
    const victimK = this.getAdjustedKFactor(victim)

    // Weapon and headshot modifiers
    const weaponMultiplier = context.weaponMultiplier
    const headshotBonus = context.headshot ? this.HEADSHOT_BONUS_MULTIPLIER : 1.0

    // Calculate rating changes
    const killerActualScore = 1 // Killer won
    const victimActualScore = 0 // Victim lost

    const killerChange = Math.round(
      killerK * (killerActualScore - expectedKiller) * weaponMultiplier * headshotBonus,
    )
    const victimChange = Math.round(
      victimK * (victimActualScore - (1 - expectedKiller)) * this.VICTIM_PENALTY_MULTIPLIER,
    )

    return {
      killer: Math.min(killerChange, this.MAX_RATING_GAIN),
      victim: Math.max(victimChange, this.MAX_RATING_LOSS),
    }
  }

  private getAdjustedKFactor(player: SkillRating): number {
    if (player.gamesPlayed < this.NEW_PLAYER_GAMES_THRESHOLD) {
      return this.DEFAULT_K_FACTOR * this.NEW_PLAYER_K_MULTIPLIER
    }
    if (player.gamesPlayed < this.INTERMEDIATE_PLAYER_GAMES_THRESHOLD) {
      return this.DEFAULT_K_FACTOR * this.INTERMEDIATE_PLAYER_K_MULTIPLIER
    }
    if (player.rating > this.HIGH_RATING_THRESHOLD) {
      return this.DEFAULT_K_FACTOR * this.HIGH_RATING_K_MULTIPLIER
    }

    return this.DEFAULT_K_FACTOR
  }

  private clampRating(rating: number): number {
    return Math.max(this.RATING_FLOOR, Math.min(this.RATING_CEILING, rating))
  }

  /**
   * Calculate expected match outcome between two players
   */
  public calculateExpectedScore(ratingA: number, ratingB: number): number {
    const ratingDifference = ratingB - ratingA
    return 1 / (1 + Math.pow(this.ELO_BASE, ratingDifference / this.ELO_DIVISOR))
  }

  /**
   * Update player rating based on match outcome
   */
  public async updatePlayerRating(
    playerId: number,
    actualScore: number,
    expectedScore: number,
  ): Promise<SkillRating> {
    const currentRating = await this.playerService.getPlayerRating(playerId)
    const kFactor = this.getAdjustedKFactor(currentRating)

    const ratingChange = kFactor * (actualScore - expectedScore)
    const newRating = this.clampRating(currentRating.rating + ratingChange)

    await this.playerService.updatePlayerRatings([
      {
        playerId,
        newRating,
        gamesPlayed: currentRating.gamesPlayed + 1,
      },
    ])

    return {
      ...currentRating,
      rating: newRating,
      gamesPlayed: currentRating.gamesPlayed + 1,
    }
  }
}
