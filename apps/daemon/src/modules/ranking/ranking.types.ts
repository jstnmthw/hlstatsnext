/**
 * Ranking Module Types
 */

import type { HandlerResult } from "@/shared/types/common"
import type { KillContext } from "./ranking.service"

export interface SkillRating {
  playerId: number
  rating: number
  confidence: number
  volatility: number
  gamesPlayed: number
}

export interface IRankingService {
  handleRatingUpdate(): Promise<HandlerResult>
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
  
  // Saga methods for snapshot and compensation
  getCurrentRankings?(playerIds: number[]): Promise<SkillRating[]>
  restoreRankings?(rankings: SkillRating[]): Promise<void>
}
