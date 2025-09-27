/**
 * Action Module Types
 */

import type { BaseEvent, PlayerMeta, DualPlayerMeta } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import type { HandlerResult } from "@/shared/types/common"

// Raw event types (as parsed from logs, contain gameUserId)
export interface RawActionPlayerEvent extends BaseEvent {
  eventType: EventType.ACTION_PLAYER
  data: {
    gameUserId: number
    actionCode: string
    game: string
    team?: string
    bonus?: number
  }
  meta?: PlayerMeta
}

export interface RawActionPlayerPlayerEvent extends BaseEvent {
  eventType: EventType.ACTION_PLAYER_PLAYER
  data: {
    gameUserId: number
    victimGameUserId: number
    actionCode: string
    game: string
    team?: string
    bonus?: number
  }
  meta?: DualPlayerMeta
}

// Resolved event types (for business logic, contain playerId)
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

// Union type for raw events (from parser)
export type RawActionEvent =
  | RawActionPlayerEvent
  | RawActionPlayerPlayerEvent
  | ActionTeamEvent // Team and world events don't need player resolution
  | WorldActionEvent

// Union type for resolved events (for business logic)
export type ActionEvent =
  | ActionPlayerEvent
  | ActionPlayerPlayerEvent
  | ActionTeamEvent
  | WorldActionEvent

// Type guards for safe event validation
export function isRawActionPlayerEvent(event: BaseEvent): event is RawActionPlayerEvent {
  return (
    event.eventType === EventType.ACTION_PLAYER &&
    event.data !== undefined &&
    event.data !== null &&
    typeof (event.data as Record<string, unknown>).gameUserId === "number"
  )
}

export function isRawActionPlayerPlayerEvent(
  event: BaseEvent,
): event is RawActionPlayerPlayerEvent {
  return (
    event.eventType === EventType.ACTION_PLAYER_PLAYER &&
    event.data !== undefined &&
    event.data !== null &&
    typeof (event.data as Record<string, unknown>).gameUserId === "number" &&
    typeof (event.data as Record<string, unknown>).victimGameUserId === "number"
  )
}

export function isActionTeamEvent(event: BaseEvent): event is ActionTeamEvent {
  return event.eventType === EventType.ACTION_TEAM
}

export function isWorldActionEvent(event: BaseEvent): event is WorldActionEvent {
  return event.eventType === EventType.ACTION_WORLD
}

export function isRawActionEvent(event: BaseEvent): event is RawActionEvent {
  return (
    isRawActionPlayerEvent(event) ||
    isRawActionPlayerPlayerEvent(event) ||
    isActionTeamEvent(event) ||
    isWorldActionEvent(event)
  )
}

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
