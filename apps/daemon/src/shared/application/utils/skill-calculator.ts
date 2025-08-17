/**
 * Skill Calculator - Pure Functions for ELO-based Skill Rating Calculations
 * 
 * This module contains all skill calculation logic as pure functions,
 * making them easily testable and auditable. These functions have no
 * side effects and depend only on their input parameters.
 */

export interface SkillRatingInput {
  rating: number
  gamesPlayed: number
}

export interface KillContextInput {
  weapon: string
  weaponModifier: number
  headshot: boolean
  isTeamKill: boolean
}

export interface SkillCalculationConfig {
  minRating: number
  maxRating: number
  maxSkillChange: number
  baseKFactor: number
  volatilityDivisor: number
  victimLossRatio: number
  headshotBonus: number
  teamKillPenalty: number
  teamKillVictimCompensation: number
  suicidePenalty: number
  kFactorNewPlayerMultiplier: number
  kFactorLearningPlayerMultiplier: number
  kFactorElitePlayerMultiplier: number
  newPlayerGamesThreshold: number
  learningPlayerGamesThreshold: number
  elitePlayerRatingThreshold: number
}

export const DEFAULT_SKILL_CONFIG: SkillCalculationConfig = {
  minRating: 100,
  maxRating: 3000,
  maxSkillChange: 50,
  baseKFactor: 32,
  volatilityDivisor: 400,
  victimLossRatio: 0.8,
  headshotBonus: 1.2,
  teamKillPenalty: -10,
  teamKillVictimCompensation: 2,
  suicidePenalty: -5,
  kFactorNewPlayerMultiplier: 1.5,
  kFactorLearningPlayerMultiplier: 1.2,
  kFactorElitePlayerMultiplier: 0.8,
  newPlayerGamesThreshold: 10,
  learningPlayerGamesThreshold: 50,
  elitePlayerRatingThreshold: 2000,
}

/**
 * Calculate expected score using ELO formula
 * 
 * Returns the probability that the player will win against the opponent.
 * - 0.5 = Equal skill (50% chance)
 * - 0.1 = Much weaker player (10% chance to win)
 * - 0.9 = Much stronger player (90% chance to win)
 * 
 * The volatilityDivisor controls how quickly probabilities change with rating differences.
 * Standard chess ELO uses 400, meaning a 400-point difference = 90% win probability.
 * 
 * @param playerRating - The rating of the player
 * @param opponentRating - The rating of the opponent
 * @param volatilityDivisor - Controls sensitivity to rating differences (default 400)
 * @returns Expected win probability between 0 and 1
 */
export function calculateExpectedScore(
  playerRating: number,
  opponentRating: number,
  volatilityDivisor: number = DEFAULT_SKILL_CONFIG.volatilityDivisor,
): number {
  const ratingDiff = opponentRating - playerRating
  const exponent = ratingDiff / volatilityDivisor
  return 1 / (1 + Math.pow(10, exponent))
}

/**
 * Get dynamic K-factor based on player experience and rating
 * 
 * K-factor determines how much ratings change per game.
 * Higher K = more volatile ratings, faster adjustment to true skill.
 * Lower K = more stable ratings, slower but smoother progression.
 * 
 * Multipliers:
 * - New players (< 10 games): 1.5x - Helps them reach appropriate skill quickly
 * - Learning (10-50 games): 1.2x - Still adjusting but stabilizing
 * - Elite (2000+ rating): 0.8x - Established players need stability
 * - Experienced (50+ games): 1.0x - Standard volatility
 * 
 * @param gamesPlayed - Number of games the player has played
 * @param rating - Current rating of the player
 * @param config - Configuration for K-factor calculation
 * @returns Adjusted K-factor value
 */
export function getKFactor(
  gamesPlayed: number,
  rating: number,
  config: Partial<SkillCalculationConfig> = {},
): number {
  const cfg = { ...DEFAULT_SKILL_CONFIG, ...config }
  
  // New players (0-10 games): K × 1.5
  if (gamesPlayed < cfg.newPlayerGamesThreshold) {
    return cfg.baseKFactor * cfg.kFactorNewPlayerMultiplier
  }
  
  // Learning players (10-50 games): K × 1.2
  if (gamesPlayed < cfg.learningPlayerGamesThreshold) {
    return cfg.baseKFactor * cfg.kFactorLearningPlayerMultiplier
  }
  
  // Elite players (2000+ rating): K × 0.8
  if (rating >= cfg.elitePlayerRatingThreshold) {
    return cfg.baseKFactor * cfg.kFactorElitePlayerMultiplier
  }
  
  // Experienced players (50+ games): K × 1.0
  return cfg.baseKFactor
}

/**
 * Apply rating bounds to prevent ratings going below/above limits
 * 
 * Ensures ratings stay within acceptable bounds (default: 100-3000).
 * If a change would exceed bounds, it's clamped to reach exactly the limit.
 * This prevents rating inflation/deflation and keeps ratings meaningful.
 * 
 * @param currentRating - Current rating of the player
 * @param change - Proposed rating change (positive or negative)
 * @param minRating - Minimum allowed rating (default 100)
 * @param maxRating - Maximum allowed rating (default 3000)
 * @returns Adjusted change that respects bounds
 */
export function applyRatingBounds(
  currentRating: number,
  change: number,
  minRating: number = DEFAULT_SKILL_CONFIG.minRating,
  maxRating: number = DEFAULT_SKILL_CONFIG.maxRating,
): number {
  const newRating = currentRating + change
  
  if (newRating < minRating) {
    return minRating - currentRating
  }
  
  if (newRating > maxRating) {
    return maxRating - currentRating
  }
  
  return change
}

/**
 * Calculate base rating change for a single round outcome
 * 
 * Core ELO formula: Change = K × (Actual - Expected)
 * - If you win when expected to lose, you gain a lot
 * - If you win when expected to win, you gain a little
 * - If you lose when expected to win, you lose a lot
 * - If you lose when expected to lose, you lose a little
 * 
 * @param expectedScore - Probability of winning (0-1)
 * @param kFactor - Maximum possible change for this player
 * @param actualScore - What actually happened (1 = win, 0 = loss)
 * @returns Rating change before any modifiers
 */
export function calculateBaseRatingChange(
  expectedScore: number,
  kFactor: number,
  actualScore: number,
): number {
  return kFactor * (actualScore - expectedScore)
}

/**
 * Apply kill context modifiers to base rating change
 * 
 * Adjusts the base rating change based on how the kill was made:
 * - Weapon modifier: Harder weapons (knife) give more points
 * - Headshot bonus: Precision kills are worth 20% more
 * - Maximum cap: Prevents excessive gains from single kills
 * 
 * Example: AWP headshot kill = base × 1.4 (weapon) × 1.2 (headshot)
 * 
 * @param baseChange - Base rating change from ELO calculation
 * @param context - Context of the kill (weapon, headshot, etc.)
 * @param config - Configuration for modifiers
 * @returns Modified rating change with all bonuses applied
 */
export function applyKillModifiers(
  baseChange: number,
  context: KillContextInput,
  config: Partial<SkillCalculationConfig> = {},
): number {
  const cfg = { ...DEFAULT_SKILL_CONFIG, ...config }
  
  let modifiedChange = baseChange
  
  // Apply weapon multiplier
  modifiedChange *= context.weaponModifier
  
  // Apply headshot bonus
  if (context.headshot) {
    modifiedChange *= cfg.headshotBonus
  }
  
  // Cap gains at maximum
  if (modifiedChange > cfg.maxSkillChange) {
    modifiedChange = cfg.maxSkillChange
  }
  
  return modifiedChange
}

/**
 * Calculate skill adjustment for a kill event
 * 
 * Complete skill calculation for a player vs player kill.
 * Combines ELO probability, K-factors, weapon modifiers, and special cases.
 * 
 * Special handling:
 * - Team kills: Fixed penalties instead of skill-based calculation
 * - High skill differential: Capped to prevent farming
 * - New players: Higher K-factor for faster convergence
 * 
 * The victim loses 80% of what the killer gains to slowly deflate ratings
 * and counteract the natural inflation from players improving over time.
 * 
 * @param killer - Killer's rating and experience
 * @param victim - Victim's rating and experience
 * @param context - How the kill happened (weapon, headshot, team kill)
 * @param config - Calculation parameters
 * @returns Rating changes for both players
 */
export function calculateKillSkillAdjustment(
  killer: SkillRatingInput,
  victim: SkillRatingInput,
  context: KillContextInput,
  config: Partial<SkillCalculationConfig> = {},
): { killerChange: number; victimChange: number } {
  const cfg = { ...DEFAULT_SKILL_CONFIG, ...config }
  
  // Handle team kills with penalties
  if (context.isTeamKill) {
    return {
      killerChange: cfg.teamKillPenalty,
      victimChange: cfg.teamKillVictimCompensation,
    }
  }
  
  // Calculate expected score using ELO formula
  const expectedScore = calculateExpectedScore(killer.rating, victim.rating, cfg.volatilityDivisor)
  
  // Get dynamic K-factor based on killer's experience
  const kFactor = getKFactor(killer.gamesPlayed, killer.rating, cfg)
  
  // Calculate base rating change (actual score = 1 for killer win)
  const baseChange = calculateBaseRatingChange(expectedScore, kFactor, 1)
  
  // Apply modifiers (weapon, headshot)
  const modifiedChange = applyKillModifiers(baseChange, context, cfg)
  
  // Calculate final changes
  const killerGain = Math.round(modifiedChange)
  const victimLoss = -Math.round(modifiedChange * cfg.victimLossRatio)
  
  // Apply rating bounds
  const finalKillerChange = applyRatingBounds(killer.rating, killerGain, cfg.minRating, cfg.maxRating)
  const finalVictimChange = applyRatingBounds(victim.rating, victimLoss, cfg.minRating, cfg.maxRating)
  
  return {
    killerChange: finalKillerChange,
    victimChange: finalVictimChange,
  }
}

/**
 * Calculate standard rating adjustment for win/loss scenarios
 * 
 * Used for binary outcomes like round wins, objectives, or duels.
 * Simpler than kill calculations - no weapon or headshot modifiers.
 * 
 * Still accounts for:
 * - Skill differential (underdogs gain more)
 * - Player experience (new players have volatile ratings)
 * - Rating bounds (can't exceed min/max)
 * - Asymmetric loss (loser loses 80% to prevent inflation)
 * 
 * @param winner - Winner's rating and experience
 * @param loser - Loser's rating and experience
 * @param config - Calculation parameters
 * @returns Rating changes for both players
 */
export function calculateStandardRatingAdjustment(
  winner: SkillRatingInput,
  loser: SkillRatingInput,
  config: Partial<SkillCalculationConfig> = {},
): { winner: number; loser: number } {
  const cfg = { ...DEFAULT_SKILL_CONFIG, ...config }
  
  // Calculate expected score for winner
  const expectedScore = calculateExpectedScore(winner.rating, loser.rating, cfg.volatilityDivisor)
  
  // Get K-factor for winner
  const kFactor = getKFactor(winner.gamesPlayed, winner.rating, cfg)
  
  // Calculate rating change (actual score = 1 for winner)
  const winnerGain = Math.round(kFactor * (1 - expectedScore))
  
  // Apply bounds and calculate loser's loss
  const boundedWinnerGain = applyRatingBounds(winner.rating, winnerGain, cfg.minRating, cfg.maxRating)
  const loserLoss = -Math.round(boundedWinnerGain * cfg.victimLossRatio)
  const boundedLoserLoss = applyRatingBounds(loser.rating, loserLoss, cfg.minRating, cfg.maxRating)
  
  return {
    winner: boundedWinnerGain,
    loser: boundedLoserLoss,
  }
}

/**
 * Calculate suicide penalty
 * 
 * Fixed penalty applied when players kill themselves.
 * Includes: falling damage, own grenades, console kill, drowning, etc.
 * Small enough to not be devastating but large enough to discourage.
 * 
 * @param config - Configuration containing suicide penalty value
 * @returns Negative rating adjustment (default: -5)
 */
export function calculateSuicidePenalty(
  config: Partial<SkillCalculationConfig> = {},
): number {
  const cfg = { ...DEFAULT_SKILL_CONFIG, ...config }
  return cfg.suicidePenalty
}

/**
 * Calculate team kill penalties
 * 
 * Applied when a player kills their own teammate.
 * Killer is penalized to discourage team killing.
 * Victim gets small compensation since it wasn't their fault.
 * 
 * Fixed values prevent exploiting the system by having
 * low-rated players team kill high-rated teammates.
 * 
 * @param config - Configuration with penalty values
 * @returns Fixed adjustments (default: -10 killer, +2 victim)
 */
export function calculateTeamKillPenalty(
  config: Partial<SkillCalculationConfig> = {},
): { killerChange: number; victimChange: number } {
  const cfg = { ...DEFAULT_SKILL_CONFIG, ...config }
  return {
    killerChange: cfg.teamKillPenalty,
    victimChange: cfg.teamKillVictimCompensation,
  }
}

/**
 * Validate skill rating configuration
 * 
 * Ensures all configuration parameters are sensible:
 * - Rating bounds are ordered correctly
 * - Multipliers are positive where required
 * - Ratios are between 0 and 1
 * - K-factors and modifiers won't cause overflow
 * 
 * Call this when loading configuration from external sources
 * to catch errors early rather than during gameplay.
 * 
 * @param config - Configuration to validate
 * @returns True if valid
 * @throws Error with specific validation failure message
 */
export function validateSkillConfig(config: Partial<SkillCalculationConfig>): boolean {
  const cfg = { ...DEFAULT_SKILL_CONFIG, ...config }
  
  if (cfg.minRating >= cfg.maxRating) {
    throw new Error('minRating must be less than maxRating')
  }
  
  if (cfg.maxSkillChange <= 0) {
    throw new Error('maxSkillChange must be positive')
  }
  
  if (cfg.baseKFactor <= 0) {
    throw new Error('baseKFactor must be positive')
  }
  
  if (cfg.volatilityDivisor <= 0) {
    throw new Error('volatilityDivisor must be positive')
  }
  
  if (cfg.victimLossRatio < 0 || cfg.victimLossRatio > 1) {
    throw new Error('victimLossRatio must be between 0 and 1')
  }
  
  if (cfg.headshotBonus < 1) {
    throw new Error('headshotBonus must be at least 1')
  }
  
  return true
}