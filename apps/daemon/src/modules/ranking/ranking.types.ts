/**
 * Ranking Module Types
 */

import type { KillContext } from "./ranking.service"

export interface SkillRating {
  playerId: number
  rating: number
  confidence: number
  volatility: number
  gamesPlayed: number
}

export interface IRankingService {
  calculateRatingAdjustment(
    winnerRating: SkillRating,
    loserRating: SkillRating,
  ): Promise<{ winner: number; loser: number }>
  calculateSkillAdjustment(
    killerRating: SkillRating,
    victimRating: SkillRating,
    context: KillContext,
  ): Promise<{ killerChange: number; victimChange: number }>
  calculateSuicidePenalty(): number
}
