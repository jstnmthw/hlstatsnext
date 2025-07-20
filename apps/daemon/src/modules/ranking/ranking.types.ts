/**
 * Ranking Module Types
 */

import type { HandlerResult } from "@/shared/types/common"

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
  ): { winner: number; loser: number }
}
