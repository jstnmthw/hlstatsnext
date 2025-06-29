import type { GameEvent } from "@/types/common/events"
import type { HandlerResult, MatchStats } from "./match.handler"

export interface IMatchHandler {
  handleEvent(event: GameEvent): Promise<HandlerResult>
  getMatchStats(serverId: number): MatchStats | undefined
}
