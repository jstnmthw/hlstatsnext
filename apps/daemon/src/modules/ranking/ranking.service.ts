/**
 * Ranking Service - HLStats ELO-based skill rating system
 * Based on the legacy HLStats skill calculation algorithm
 */

import type { IRankingService, SkillRating } from "./ranking.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { HandlerResult } from "@/shared/types/common"

export interface KillContext {
  weapon: string
  headshot: boolean
  killerTeam: string
  victimTeam: string
  distance?: number
}

export class RankingService implements IRankingService {
  // Rating system constants
  private readonly MIN_RATING = 100
  private readonly MAX_RATING = 3000
  private readonly MAX_SKILL_CHANGE = 50
  private readonly DEFAULT_STARTING_RATING = 1000
  private readonly BASE_K_FACTOR = 32
  private readonly VOLATILITY_DIVISOR = 400
  private readonly VICTIM_LOSS_RATIO = 0.8 // Victim loses 80% of killer's gain

  // Weapon multipliers (from PLAYER_RANKINGS.md spec)
  private readonly WEAPON_MULTIPLIERS: Record<string, number> = {
    // Precision rifles
    awp: 1.4,
    scout: 1.4,
    g3sg1: 1.4,
    sg550: 1.4,

    // Assault rifles (baseline)
    ak47: 1.0,
    m4a1: 1.0,
    m4a1_silencer: 1.0,
    aug: 1.0,
    sg552: 1.0,
    sg553: 1.0,
    galil: 1.0,
    famas: 1.0,

    // SMGs
    mp5navy: 0.9,
    ump45: 0.9,
    p90: 0.9,
    mp7: 0.9,
    mp9: 0.9,
    bizon: 0.9,
    tmp: 0.9,
    mac10: 0.9,

    // Shotguns
    m3: 0.9,
    xm1014: 0.9,
    nova: 0.9,
    sawedoff: 0.9,
    mag7: 0.9,

    // Pistols
    deagle: 0.8,
    usp: 0.8,
    glock: 0.8,
    p228: 0.8,
    elite: 0.8,
    fiveseven: 0.8,
    tec9: 0.8,
    p250: 0.8,
    hkp2000: 0.8,

    // Melee/Special
    knife: 2.0,
    hegrenade: 1.5,
    flashbang: 1.8, // Rare flash kills
    smokegrenade: 1.8,
    inferno: 1.2, // Molotov/incendiary
    decoy: 2.0, // Extremely rare

    // Machine guns
    m249: 0.8,
    negev: 0.8,

    // Default for unknown weapons
    unknown: 1.0,
  }

  constructor(private readonly logger: ILogger) {}

  async handleRatingUpdate(): Promise<HandlerResult> {
    try {
      // This method is called by the event processor
      // Actual rating calculations are done in calculateSkillAdjustment
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Calculate skill rating adjustment for a kill event
   * Based on modified ELO rating system from PLAYER_RANKINGS.md
   */
  calculateSkillAdjustment(
    killerRating: SkillRating,
    victimRating: SkillRating,
    context: KillContext,
  ): { killerChange: number; victimChange: number } {
    // Handle team kills with penalties
    if (context.killerTeam === context.victimTeam) {
      return this.calculateTeamKillPenalty()
    }

    // Calculate expected score using ELO formula
    const expectedScore = this.calculateExpectedScore(killerRating.rating, victimRating.rating)

    // Get dynamic K-factor based on killer's experience
    const kFactor = this.getKFactor(killerRating.gamesPlayed, killerRating.rating)

    // Calculate base rating change
    let baseChange = kFactor * (1 - expectedScore)

    // Apply weapon multiplier
    const weaponMultiplier = this.getWeaponMultiplier(context.weapon)
    baseChange *= weaponMultiplier

    // Apply headshot bonus
    if (context.headshot) {
      baseChange *= 1.2
    }

    // Cap gains at maximum
    if (baseChange > this.MAX_SKILL_CHANGE) {
      baseChange = this.MAX_SKILL_CHANGE
    }

    // Calculate final changes
    const killerGain = Math.round(baseChange)
    const victimLoss = -Math.round(baseChange * this.VICTIM_LOSS_RATIO)

    // Apply rating bounds
    const finalKillerChange = this.applyRatingBounds(killerRating.rating, killerGain)
    const finalVictimChange = this.applyRatingBounds(victimRating.rating, victimLoss)

    this.logger.debug(
      `Skill calculation: ${context.weapon} kill, ` +
        `${context.headshot ? "headshot, " : ""}` +
        `expected: ${expectedScore.toFixed(3)}, k-factor: ${kFactor}, ` +
        `killer: ${killerRating.rating} → ${killerRating.rating + finalKillerChange} (${finalKillerChange > 0 ? "+" : ""}${finalKillerChange}), ` +
        `victim: ${victimRating.rating} → ${victimRating.rating + finalVictimChange} (${finalVictimChange})`,
    )

    return {
      killerChange: finalKillerChange,
      victimChange: finalVictimChange,
    }
  }

  /**
   * Calculate suicide penalty
   */
  calculateSuicidePenalty(): number {
    return -5 // Fixed penalty for suicides
  }

  /**
   * Calculate team kill penalties
   */
  private calculateTeamKillPenalty(): { killerChange: number; victimChange: number } {
    return {
      killerChange: -10, // Penalty for team killer
      victimChange: +2, // Compensation for team kill victim
    }
  }

  /**
   * Calculate expected score using ELO formula
   * E = 1 / (1 + 10^((OpponentRating - PlayerRating) / 400))
   */
  private calculateExpectedScore(playerRating: number, opponentRating: number): number {
    const ratingDiff = opponentRating - playerRating
    const exponent = ratingDiff / this.VOLATILITY_DIVISOR
    return 1 / (1 + Math.pow(10, exponent))
  }

  /**
   * Get weapon multiplier for skill calculations
   */
  private getWeaponMultiplier(weapon: string): number {
    // Normalize weapon name (remove prefixes, convert to lowercase)
    const normalizedWeapon = weapon
      .toLowerCase()
      .replace(/^weapon_/, "")
      .replace(/^item_/, "")

    return this.WEAPON_MULTIPLIERS[normalizedWeapon] ?? this.WEAPON_MULTIPLIERS.unknown ?? 1.0
  }

  /**
   * Apply rating bounds to prevent ratings going below/above limits
   */
  private applyRatingBounds(currentRating: number, change: number): number {
    const newRating = currentRating + change

    if (newRating < this.MIN_RATING) {
      return this.MIN_RATING - currentRating
    }

    if (newRating > this.MAX_RATING) {
      return this.MAX_RATING - currentRating
    }

    return change
  }

  /**
   * Get dynamic K-factor based on player experience and rating
   * From PLAYER_RANKINGS.md spec
   */
  private getKFactor(gamesPlayed: number, rating: number): number {
    // New players (0-10 games): K × 1.5 = 48
    if (gamesPlayed < 10) return this.BASE_K_FACTOR * 1.5

    // Learning players (10-50 games): K × 1.2 = 38.4
    if (gamesPlayed < 50) return this.BASE_K_FACTOR * 1.2

    // Elite players (2000+ rating): K × 0.8 = 25.6
    if (rating >= 2000) return this.BASE_K_FACTOR * 0.8

    // Experienced players (50+ games): K × 1.0 = 32
    return this.BASE_K_FACTOR
  }

  /**
   * Calculate rating adjustment using standard ELO formula
   * This is a simplified version without weapon/headshot modifiers
   */
  calculateRatingAdjustment(
    winnerRating: SkillRating,
    loserRating: SkillRating,
  ): { winner: number; loser: number } {
    // Calculate expected score for winner
    const expectedScore = this.calculateExpectedScore(winnerRating.rating, loserRating.rating)

    // Get K-factor for winner
    const kFactor = this.getKFactor(winnerRating.gamesPlayed, winnerRating.rating)

    // Calculate rating change (actual score = 1 for winner)
    const winnerGain = Math.round(kFactor * (1 - expectedScore))

    // Apply bounds and calculate loser's loss
    const boundedWinnerGain = this.applyRatingBounds(winnerRating.rating, winnerGain)
    const loserLoss = -Math.round(boundedWinnerGain * this.VICTIM_LOSS_RATIO)
    const boundedLoserLoss = this.applyRatingBounds(loserRating.rating, loserLoss)

    return {
      winner: boundedWinnerGain,
      loser: boundedLoserLoss,
    }
  }
}
