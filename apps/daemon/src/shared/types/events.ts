/**
 * Base Event Types for HLStats Daemon
 *
 * Core event interfaces that are shared across all modules.
 * Domain-specific event types are defined in their respective modules.
 */

export enum EventType {
  // Player events
  PLAYER_CONNECT = "PLAYER_CONNECT",
  PLAYER_DISCONNECT = "PLAYER_DISCONNECT",
  PLAYER_ENTRY = "PLAYER_ENTRY",
  PLAYER_KILL = "PLAYER_KILL",
  PLAYER_DEATH = "PLAYER_DEATH",
  PLAYER_DAMAGE = "PLAYER_DAMAGE",
  PLAYER_SUICIDE = "PLAYER_SUICIDE",
  PLAYER_TEAMKILL = "PLAYER_TEAMKILL",
  PLAYER_CHANGE_TEAM = "PLAYER_CHANGE_TEAM",
  PLAYER_CHANGE_ROLE = "PLAYER_CHANGE_ROLE",
  PLAYER_CHANGE_NAME = "PLAYER_CHANGE_NAME",

  // Action events
  ACTION_PLAYER = "ACTION_PLAYER",
  ACTION_PLAYER_PLAYER = "ACTION_PLAYER_PLAYER",
  ACTION_TEAM = "ACTION_TEAM",
  ACTION_WORLD = "ACTION_WORLD",

  // Match events
  ROUND_START = "ROUND_START",
  ROUND_END = "ROUND_END",
  TEAM_WIN = "TEAM_WIN",
  MAP_CHANGE = "MAP_CHANGE",

  // Objective events
  BOMB_PLANT = "BOMB_PLANT",
  BOMB_DEFUSE = "BOMB_DEFUSE",
  BOMB_EXPLODE = "BOMB_EXPLODE",
  HOSTAGE_RESCUE = "HOSTAGE_RESCUE",
  HOSTAGE_TOUCH = "HOSTAGE_TOUCH",
  FLAG_CAPTURE = "FLAG_CAPTURE",
  FLAG_DEFEND = "FLAG_DEFEND",
  FLAG_PICKUP = "FLAG_PICKUP",
  FLAG_DROP = "FLAG_DROP",
  CONTROL_POINT_CAPTURE = "CONTROL_POINT_CAPTURE",
  CONTROL_POINT_DEFEND = "CONTROL_POINT_DEFEND",

  // Weapon events
  WEAPON_FIRE = "WEAPON_FIRE",
  WEAPON_HIT = "WEAPON_HIT",

  // System events
  SERVER_SHUTDOWN = "SERVER_SHUTDOWN",
  SERVER_STATS_UPDATE = "SERVER_STATS_UPDATE",
  ADMIN_ACTION = "ADMIN_ACTION",
  CHAT_MESSAGE = "CHAT_MESSAGE",
}

export interface Position3D {
  x: number
  y: number
  z: number
}

export interface PlayerMeta {
  steamId: string
  playerName: string
  isBot: boolean
}

export interface DualPlayerMeta {
  killer: PlayerMeta
  victim: PlayerMeta
}

export interface BaseEvent {
  eventType: EventType
  timestamp: Date
  serverId: number
  raw?: string
  meta?: unknown
  data?: unknown
}

export interface ProcessedEvent {
  id: string
  event: BaseEvent
  processedAt: Date
  success: boolean
  error?: string
}

// Type helpers for events with metadata
export type EventWithMeta = BaseEvent & { meta?: PlayerMeta | DualPlayerMeta }
export type SinglePlayerEvent = BaseEvent & { meta?: PlayerMeta }
export type DualPlayerEvent = BaseEvent & { meta?: DualPlayerMeta }
