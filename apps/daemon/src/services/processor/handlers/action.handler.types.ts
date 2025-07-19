import type { GameEvent } from "@/types/common/events"

export interface IActionHandler {
  handleEvent(event: GameEvent): Promise<HandlerResult>
}

export interface HandlerResult {
  success: boolean
  error?: string
  actionsProcessed?: number
  playersAffected?: number[]
}

export interface ActionProcessingContext {
  serverId: number
  map: string
  timestamp: Date
  game: string
}

export interface EventMeta {
  serverId?: number
  map?: string
}
