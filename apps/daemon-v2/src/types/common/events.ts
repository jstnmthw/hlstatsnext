/**
 * Core Event Types for HLStats Daemon v2
 *
 * These types define the structure of game events that flow through
 * the processing pipeline from ingress to statistics calculation.
 */

export enum EventType {
  PLAYER_CONNECT = "PLAYER_CONNECT",
  PLAYER_DISCONNECT = "PLAYER_DISCONNECT",
  PLAYER_KILL = "PLAYER_KILL",
  PLAYER_DEATH = "PLAYER_DEATH",
  PLAYER_SUICIDE = "PLAYER_SUICIDE",
  PLAYER_TEAMKILL = "PLAYER_TEAMKILL",
  ROUND_START = "ROUND_START",
  ROUND_END = "ROUND_END",
  MAP_CHANGE = "MAP_CHANGE",
  SERVER_SHUTDOWN = "SERVER_SHUTDOWN",
  ADMIN_ACTION = "ADMIN_ACTION",
  CHAT_MESSAGE = "CHAT_MESSAGE",
}

export interface Position3D {
  x: number
  y: number
  z: number
}

// Base player metadata structure
export interface PlayerMeta {
  steamId: string
  playerName: string
  isBot: boolean
}

// Two-player metadata for events involving multiple players
export interface DualPlayerMeta {
  killer: PlayerMeta
  victim: PlayerMeta
}

export interface BaseEvent {
  eventType: EventType
  timestamp: Date
  serverId: number
  raw?: string // Original log line for debugging
  /**
   * Optional payload for events that do not have a specific data structure.
   * This is primarily to allow ergonomic access in generic code paths (e.g. tests)
   * without resorting to explicit casts. Event-specific interfaces should override
   * this with a strongly-typed version.
   */
  data?: unknown
}

export interface PlayerKillEvent extends BaseEvent {
  eventType: EventType.PLAYER_KILL
  data: {
    killerId: number
    victimId: number
    weapon: string
    headshot: boolean
    distance?: number
    killerPosition?: Position3D
    victimPosition?: Position3D
    killerTeam: string
    victimTeam: string
  }
  meta?: DualPlayerMeta
}

export interface PlayerConnectEvent extends BaseEvent {
  eventType: EventType.PLAYER_CONNECT
  data: {
    playerId: number
    steamId: string
    playerName: string
    ipAddress: string
    country?: string
    userAgent?: string
  }
  meta?: PlayerMeta
}

export interface PlayerDisconnectEvent extends BaseEvent {
  eventType: EventType.PLAYER_DISCONNECT
  data: {
    playerId: number
    reason?: string
    sessionDuration?: number
  }
  meta?: PlayerMeta
}

export interface PlayerChatEvent extends BaseEvent {
  eventType: EventType.CHAT_MESSAGE
  data: {
    playerId: number
    message: string
    team: string
    isDead: boolean
    messageMode?: number // 0=normal,1=dead etc.
  }
  meta?: PlayerMeta
}

export interface RoundEndEvent extends BaseEvent {
  eventType: EventType.ROUND_END
  data: {
    winningTeam: string
    duration: number
    score: {
      team1: number
      team2: number
    }
  }
}

export interface MapChangeEvent extends BaseEvent {
  eventType: EventType.MAP_CHANGE
  data: {
    previousMap?: string
    newMap: string
    playerCount: number
  }
}

export interface PlayerDeathEvent extends BaseEvent {
  eventType: EventType.PLAYER_DEATH
  data: {
    victimId: number
    killerId?: number // Undefined for world/environmental deaths
    weapon?: string
    headshot?: boolean
    victimPosition?: Position3D
    killerPosition?: Position3D
    victimTeam: string
    killerTeam?: string
  }
  meta?: DualPlayerMeta | PlayerMeta // Dual if killer exists, single for world deaths
}

export interface PlayerSuicideEvent extends BaseEvent {
  eventType: EventType.PLAYER_SUICIDE
  data: {
    playerId: number
    weapon?: string
    position?: Position3D
    team: string
  }
  meta?: PlayerMeta
}

export interface PlayerTeamkillEvent extends BaseEvent {
  eventType: EventType.PLAYER_TEAMKILL
  data: {
    killerId: number
    victimId: number
    weapon: string
    headshot: boolean
    distance?: number
    killerPosition?: Position3D
    victimPosition?: Position3D
    team: string // Shared team for both players
  }
  meta?: DualPlayerMeta
}

export interface RoundStartEvent extends BaseEvent {
  eventType: EventType.ROUND_START
  data: {
    map: string
    roundNumber: number
    maxPlayers: number
  }
  // No meta needed for round events
}

export interface ServerShutdownEvent extends BaseEvent {
  eventType: EventType.SERVER_SHUTDOWN
  data: {
    reason?: string
    uptimeSeconds?: number
    playerCount?: number
  }
  // No meta needed for server events
}

export interface AdminActionEvent extends BaseEvent {
  eventType: EventType.ADMIN_ACTION
  data: {
    adminId: number
    action: string // e.g. "kick", "ban", "swap"
    targetPlayerId?: number
    reason?: string
  }
  // No meta needed for admin events (admin info should be in data)
}

// Updated discriminated union of all supported events
export type GameEvent =
  | PlayerKillEvent
  | PlayerConnectEvent
  | PlayerDisconnectEvent
  | PlayerChatEvent
  | RoundEndEvent
  | RoundStartEvent
  | MapChangeEvent
  | PlayerDeathEvent
  | PlayerSuicideEvent
  | PlayerTeamkillEvent
  | ServerShutdownEvent
  | AdminActionEvent

export interface ProcessedEvent {
  id: string
  event: GameEvent
  processedAt: Date
  success: boolean
  error?: string
}

// Helper type to extract events that have metadata
export type EventWithMeta = Extract<GameEvent, { meta?: PlayerMeta | DualPlayerMeta }>

// Helper type to extract events with single player metadata
export type SinglePlayerEvent = Extract<GameEvent, { meta?: PlayerMeta }>

// Helper type to extract events with dual player metadata
export type DualPlayerEvent = Extract<GameEvent, { meta?: DualPlayerMeta }>
