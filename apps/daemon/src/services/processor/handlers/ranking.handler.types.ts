import type { GameEvent } from "@/types/common/events"
import type { HandlerResult, SkillRating } from "./ranking.handler"

export interface IRankingHandler {
  handleEvent(event: GameEvent): Promise<HandlerResult>
  calculateExpectedScore(ratingA: number, ratingB: number): number
  updatePlayerRating(
    playerId: number,
    actualScore: number,
    expectedScore: number,
  ): Promise<SkillRating>
}
