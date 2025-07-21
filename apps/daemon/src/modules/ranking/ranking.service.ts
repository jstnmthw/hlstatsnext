/**
 * Ranking Service - HLStats ELO-based skill rating system
 * Based on the legacy HLStats skill calculation algorithm
 */

import type { IRankingService, SkillRating } from "./ranking.types"
import type { ILogger } from "@/shared/utils/logger"
import type { HandlerResult } from "@/shared/types/common"

export interface KillContext {
  weapon: string
  headshot: boolean
  killerTeam: string
  victimTeam: string
  distance?: number
}

export class RankingService implements IRankingService {
  // Rating system constants (from legacy system)
  private readonly MIN_RATING = 100
  private readonly MAX_RATING = 3000
  private readonly MAX_SKILL_CHANGE = 50
  private readonly DEFAULT_STARTING_RATING = 1000

  // Weapon multipliers (from legacy hlstatsx_Weapons table)
  private readonly WEAPON_MULTIPLIERS: Record<string, number> = {
    // Sniper rifles
    awp: 1.4,
    scout: 1.4,
    g3sg1: 1.3,
    sg550: 1.3,
    
    // Assault rifles (baseline)
    ak47: 1.0,
    m4a1: 1.0,
    m4a1_silencer: 1.0,
    aug: 1.0,
    sg552: 1.0,
    
    // SMGs
    mp5navy: 0.9,
    ump45: 0.9,
    p90: 0.9,
    tmp: 0.8,
    mac10: 0.8,
    
    // Shotguns
    m3: 0.9,
    xm1014: 0.9,
    
    // Pistols
    deagle: 0.8,
    usp: 0.7,
    glock: 0.7,
    p228: 0.7,
    elite: 0.6,
    fiveseven: 0.7,
    
    // Melee/Special
    knife: 2.0,
    hegrenade: 1.5,
    flashbang: 1.8, // Rare flash kills
    
    // Machine guns
    m249: 0.8,
    
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
   * Based on the legacy HLStats ELO algorithm
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

    // Get base skill ratio with bounds
    const skillRatio = this.calculateSkillRatio(killerRating.rating, victimRating.rating)
    
    // Get weapon multiplier
    const weaponMultiplier = this.getWeaponMultiplier(context.weapon)
    
    // Apply headshot bonus
    const headshotMultiplier = context.headshot ? 1.2 : 1.0
    
    // Calculate base skill change
    let killerGain = skillRatio * 5 * weaponMultiplier * headshotMultiplier
    
    // Apply maximum skill change cap
    if (killerGain > this.MAX_SKILL_CHANGE) {
      killerGain = this.MAX_SKILL_CHANGE
    }
    
    // Calculate victim loss (different modes from legacy)
    // Mode 2: Victim loses 50% of killer's gain
    const victimLoss = -(killerGain * 0.5)
    
    // Apply rating bounds
    const finalKillerChange = this.applyRatingBounds(
      killerRating.rating,
      Math.round(killerGain)
    )
    const finalVictimChange = this.applyRatingBounds(
      victimRating.rating,
      Math.round(victimLoss)
    )

    this.logger.debug(
      `Skill calculation: ${context.weapon} kill, ` +
      `${context.headshot ? 'headshot, ' : ''}` +
      `killer: ${killerRating.rating} → ${killerRating.rating + finalKillerChange} (${finalKillerChange > 0 ? '+' : ''}${finalKillerChange}), ` +
      `victim: ${victimRating.rating} → ${victimRating.rating + finalVictimChange} (${finalVictimChange})`
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
      victimChange: +2,  // Compensation for team kill victim
    }
  }

  /**
   * Calculate skill ratio with bounds (from legacy algorithm)
   */
  private calculateSkillRatio(killerRating: number, victimRating: number): number {
    const lowRatio = 0.7
    const highRatio = 1.0 / lowRatio // 1.43
    
    let ratio = victimRating / killerRating
    
    if (ratio < lowRatio) {
      ratio = lowRatio
    }
    if (ratio > highRatio) {
      ratio = highRatio
    }
    
    return ratio
  }

  /**
   * Get weapon multiplier for skill calculations
   */
  private getWeaponMultiplier(weapon: string): number {
    // Normalize weapon name (remove prefixes, convert to lowercase)
    const normalizedWeapon = weapon.toLowerCase()
      .replace(/^weapon_/, '')
      .replace(/^item_/, '')
    
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
   * (For future use in more advanced ELO calculations)
   */
  private getKFactor(gamesPlayed: number, rating: number): number {
    if (gamesPlayed < 10) return 48      // New players learn faster
    if (gamesPlayed < 50) return 38.4    // Learning players
    if (rating > 2000) return 25.6       // Elite players (more stable)
    return 32                            // Standard K-factor
  }

  /**
   * Legacy ELO calculation (simpler version, kept for compatibility)
   */
  calculateRatingAdjustment(
    winnerRating: SkillRating,
    loserRating: SkillRating,
  ): { winner: number; loser: number } {
    // Use the more sophisticated calculateSkillAdjustment for actual gameplay
    const context: KillContext = {
      weapon: 'ak47',
      headshot: false,
      killerTeam: 'CT',
      victimTeam: 'TERRORIST',
    }
    
    const adjustment = this.calculateSkillAdjustment(winnerRating, loserRating, context)
    
    return {
      winner: adjustment.killerChange,
      loser: adjustment.victimChange,
    }
  }
}
