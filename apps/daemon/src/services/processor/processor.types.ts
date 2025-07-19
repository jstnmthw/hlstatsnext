import type { GameEvent } from "@/types/common/events"
import type { Player } from "@repo/database/client"

export interface IEventProcessor {
  enqueue(event: unknown): Promise<void>
  processEvent(event: GameEvent): Promise<void>
  getTopPlayers(limit?: number, game?: string, includeHidden?: boolean): Promise<Player[]>
}
