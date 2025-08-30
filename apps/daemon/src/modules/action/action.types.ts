/**
 * Action Module Types
 */

import type { BaseEvent, EventType, PlayerMeta, DualPlayerMeta } from "@/shared/types/events"
import type { HandlerResult } from "@/shared/types/common"

export interface ActionPlayerEvent extends BaseEvent {
  eventType: EventType.ACTION_PLAYER
  data: {
    playerId: number
    actionCode: string
    game: string
    team?: string
    bonus?: number
  }
  meta?: PlayerMeta
}

export interface ActionPlayerPlayerEvent extends BaseEvent {
  eventType: EventType.ACTION_PLAYER_PLAYER
  data: {
    playerId: number
    victimId: number
    actionCode: string
    game: string
    team?: string
    bonus?: number
  }
  meta?: DualPlayerMeta
}

export interface ActionTeamEvent extends BaseEvent {
  eventType: EventType.ACTION_TEAM
  data: {
    team: string
    actionCode: string
    game: string
    playersAffected?: number[]
    bonus?: number
  }
}

export interface WorldActionEvent extends BaseEvent {
  eventType: EventType.ACTION_WORLD
  data: {
    actionCode: string
    game: string
    bonus?: number
  }
}

export type ActionEvent =
  | ActionPlayerEvent
  | ActionPlayerPlayerEvent
  | ActionTeamEvent
  | WorldActionEvent

export interface IActionService {
  handleActionEvent(event: ActionEvent): Promise<HandlerResult>
}

export interface ActionDefinition {
  id: number
  game: string
  code: string
  rewardPlayer: number
  rewardTeam: number
  team: string
  description: string | null
  forPlayerActions: boolean
  forPlayerPlayerActions: boolean
  forTeamActions: boolean
  forWorldActions: boolean
}

export interface IActionRepository {
  findActionByCode(
    game: string,
    actionCode: string,
    team?: string,
  ): Promise<ActionDefinition | null>
  logPlayerAction(
    playerId: number,
    actionId: number,
    serverId: number,
    map: string,
    bonus?: number,
  ): Promise<void>
  logPlayerPlayerAction(
    playerId: number,
    victimId: number,
    actionId: number,
    serverId: number,
    map: string,
    bonus?: number,
  ): Promise<void>
  logTeamActionForPlayer(
    playerId: number,
    serverId: number,
    actionId: number,
    map: string,
    bonus?: number,
  ): Promise<void>
  logWorldAction(serverId: number, actionId: number, map: string, bonus?: number): Promise<void>

  // Batch operations for performance optimization
  logTeamActionBatch(
    teamActions: Array<{
      playerId: number
      serverId: number
      actionId: number
      map: string
      bonus: number
    }>,
  ): Promise<void>
}
