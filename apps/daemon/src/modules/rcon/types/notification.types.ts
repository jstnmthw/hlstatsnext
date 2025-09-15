/**
 * Notification System Type Definitions
 *
 * Comprehensive type definitions for the event notification system.
 */

import type { EventType } from "@/shared/types/events"

/**
 * Event notification data interfaces
 */
export interface BaseNotificationData {
  serverId: number
  timestamp?: Date
}

export interface KillEventNotificationData extends BaseNotificationData {
  killerId: number
  victimId: number
  killerName?: string
  victimName?: string
  killerSkill?: number
  victimSkill?: number
  skillAdjustment: {
    killerChange: number
    victimChange: number
  }
  weapon?: string
  headshot?: boolean
}

export interface SuicideEventNotificationData extends BaseNotificationData {
  playerId: number
  playerName?: string
  playerSkill?: number
  skillPenalty: number
  weapon?: string
}

export interface TeamKillEventNotificationData extends BaseNotificationData {
  killerId: number
  victimId: number
  killerName?: string
  victimName?: string
  weapon?: string
  headshot: boolean
  skillPenalty: number
}

export interface ActionEventNotificationData extends BaseNotificationData {
  playerId: number
  playerName?: string
  playerSkill?: number
  actionCode: string
  actionDescription: string
  points: number
}

export interface TeamActionEventNotificationData extends BaseNotificationData {
  team: string
  actionCode: string
  actionDescription: string
  points: number
  playerCount?: number
}

export interface ConnectEventNotificationData extends BaseNotificationData {
  playerId: number
  playerName?: string
  playerCountry?: string
  steamId?: string
  ipAddress: string
  connectionTime: number
}

export interface DisconnectEventNotificationData extends BaseNotificationData {
  playerId: number
  playerName?: string
  playerCountry?: string
  playerSkill?: number
  reason: string
  sessionDuration: number
}

/**
 * Union type for all notification data
 */
export type NotificationEventData =
  | KillEventNotificationData
  | SuicideEventNotificationData
  | TeamKillEventNotificationData
  | ActionEventNotificationData
  | TeamActionEventNotificationData
  | ConnectEventNotificationData
  | DisconnectEventNotificationData

/**
 * Message components for building notifications
 */
export interface MessageComponents {
  eventType: EventType
  killer?: {
    id: number
    name?: string
    skill?: number
  }
  victim?: {
    id: number
    name?: string
    skill?: number
  }
  player?: {
    id: number
    name?: string
    skill?: number
    country?: string
  }
  team?: string
  action?: {
    code: string
    description: string
  }
  points?: number
  weapon?: string
  headshot?: boolean
  skillAdjustment?: {
    killerChange: number
    victimChange: number
  }
  skillPenalty?: number
  connectionTime?: number
  playerCount?: number
}

/**
 * Message template definitions
 */
export interface MessageTemplates {
  kill: string
  suicide: string
  teamkill: string
  playerAction: string
  teamAction: string
  playerPlayerAction: string
  connect: string
  disconnect: string
}

/**
 * Default message templates
 */
export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplates = {
  kill: "[HLStatsNext]: {killerName} (+{killerSkill}) killed {victimName} (-{victimSkill}) with {weapon} for {points} points",
  suicide:
    "[HLStatsNext]: {playerName} ({playerSkill}) lost {points} points for suicide with {weapon}",
  teamkill: "[HLStatsNext]: {killerName} lost {points} points for team killing {victimName}",
  playerAction: "[HLStatsNext]: {playerName} ({playerSkill}) got {points} points for {action}",
  teamAction: "[HLStatsNext]: Team {team} ({playerCount} players) got {points} points for {action}",
  playerPlayerAction:
    "[HLStatsNext]: {playerName} got {points} points for {action} against {victimName}",
  connect: "[HLStatsNext]: {playerName} from {playerCountry} connected",
  disconnect: "[HLStatsNext]: {playerName} from {playerCountry} ({playerSkill}) disconnected",
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  serverId: number
  engineType: string
  colorEnabled: boolean
  colorScheme?: Record<string, unknown>
  eventTypes?: EventType[]
  messageFormats?: Partial<MessageTemplates>
}

/**
 * Template variable replacement context
 */
export interface TemplateContext {
  killerName?: string
  killerSkill?: number
  victimName?: string
  victimSkill?: number
  playerName?: string
  playerSkill?: number
  playerCountry?: string
  team?: string
  action?: string
  points?: string // Formatted with + or - prefix
  weapon?: string
  headshot?: boolean
  playerCount?: number
  connectionTime?: number
}

/**
 * Template replacement function type
 */
export type TemplateReplacer = (template: string, context: TemplateContext) => string
