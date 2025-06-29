import type { GameEvent } from "@/types/common/events"

export interface IEventService {
  createGameEvent(event: GameEvent): Promise<void>
}
