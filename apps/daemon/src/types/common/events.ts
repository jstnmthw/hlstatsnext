/**
 * Core Event Types for HLStats Daemon
 *
 * These types define the structure of game events that flow through
 * the processing pipeline from ingress to statistics calculation.
 */

export enum EventType {
  PLAYER_CONNECT = "PLAYER_CONNECT",
  PLAYER_DISCONNECT = "PLAYER_DISCONNECT",
  PLAYER_ENTRY = "PLAYER_ENTRY",
  PLAYER_KILL = "PLAYER_KILL",
  PLAYER_DEATH = "PLAYER_DEATH",
  PLAYER_SUICIDE = "PLAYER_SUICIDE",
  PLAYER_TEAMKILL = "PLAYER_TEAMKILL",
  PLAYER_CHANGE_TEAM = "PLAYER_CHANGE_TEAM",
  PLAYER_CHANGE_ROLE = "PLAYER_CHANGE_ROLE",
  PLAYER_CHANGE_NAME = "PLAYER_CHANGE_NAME",
  ACTION_PLAYER = "ACTION_PLAYER",
  ACTION_PLAYER_PLAYER = "ACTION_PLAYER_PLAYER",
  ACTION_TEAM = "ACTION_TEAM",
  ACTION_WORLD = "ACTION_WORLD",
  ROUND_START = "ROUND_START",
  ROUND_END = "ROUND_END",
  TEAM_WIN = "TEAM_WIN",
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
  meta?: unknown
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
    winningTeam?: string
    duration?: number
    score?: {
      team1: number
      team2: number
    }
  }
}

export interface TeamWinEvent extends BaseEvent {
  eventType: EventType.TEAM_WIN
  data: {
    winningTeam: string // e.g., "TERRORIST", "CT"
    triggerName: string // e.g., "Terrorists_Win", "CTs_Win"
    score: {
      ct: number
      t: number
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

export interface PlayerEntryEvent extends BaseEvent {
  eventType: EventType.PLAYER_ENTRY
  data: {
    playerId: number
  }
  meta?: PlayerMeta
}

export interface PlayerChangeTeamEvent extends BaseEvent {
  eventType: EventType.PLAYER_CHANGE_TEAM
  data: {
    playerId: number
    team: string // e.g. "CT", "TERRORIST", "Spectator"
  }
  meta?: PlayerMeta
}

export interface PlayerChangeRoleEvent extends BaseEvent {
  eventType: EventType.PLAYER_CHANGE_ROLE
  data: {
    playerId: number
    role: string // e.g. "VIP", "Commander", specific class name
  }
  meta?: PlayerMeta
}

export interface PlayerChangeNameEvent extends BaseEvent {
  eventType: EventType.PLAYER_CHANGE_NAME
  data: {
    playerId: number
    oldName: string
    newName: string
  }
  meta?: PlayerMeta
}

export interface ActionPlayerEvent extends BaseEvent {
  eventType: EventType.ACTION_PLAYER
  data: {
    playerId: number
    actionCode: string // e.g., "Planted_The_Bomb", "headshot", "flagevent_captured"
    game: string // e.g., "css", "tf", "csgo"
    team?: string // Optional team context (CT, TERRORIST, etc.)
    bonus?: number // Additional points/modifier
    position?: Position3D
  }
  meta?: PlayerMeta
}

export interface ActionPlayerPlayerEvent extends BaseEvent {
  eventType: EventType.ACTION_PLAYER_PLAYER
  data: {
    playerId: number // Actor
    victimId: number // Target
    actionCode: string // e.g., "domination", "revenge", "steal_sandvich"
    game: string
    team?: string
    bonus?: number
    actorPosition?: Position3D
    victimPosition?: Position3D
  }
  meta?: DualPlayerMeta
}

export interface ActionTeamEvent extends BaseEvent {
  eventType: EventType.ACTION_TEAM
  data: {
    team: string // CT, TERRORIST, RED, BLU, etc.
    actionCode: string // e.g., "Round_Win", "Target_Bombed", "All_Hostages_Rescued"
    game: string
    playersAffected?: number[] // Player IDs that should receive team bonus
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

// Updated discriminated union of all supported events
export type GameEvent =
  | PlayerKillEvent
  | PlayerConnectEvent
  | PlayerDisconnectEvent
  | PlayerEntryEvent
  | PlayerChangeTeamEvent
  | PlayerChangeRoleEvent
  | PlayerChangeNameEvent
  | ActionPlayerEvent
  | ActionPlayerPlayerEvent
  | ActionTeamEvent
  | WorldActionEvent
  | PlayerChatEvent
  | RoundEndEvent
  | RoundStartEvent
  | TeamWinEvent
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
