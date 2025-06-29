import type { GameEvent } from "@/types/common/events"
import type { HandlerResult } from "./player.handler"

export interface IPlayerHandler {
  handleEvent(event: GameEvent): Promise<HandlerResult>
}
