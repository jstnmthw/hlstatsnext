/**
 * Player Module Types
 */

import type { BaseEvent, EventType, PlayerMeta, DualPlayerMeta } from "@/shared/types/events"
import type { HandlerResult } from "@/shared/types/common"
import type { FindOptions, UpdateOptions, CreateOptions } from "@/shared/types/database"

// Player-specific event types
export interface PlayerKillEvent extends BaseEvent {
  eventType: EventType.PLAYER_KILL
  data: {
    killerId: number
    victimId: number
    weapon: string
    headshot: boolean
    distance?: number
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

export interface PlayerSuicideEvent extends BaseEvent {
  eventType: EventType.PLAYER_SUICIDE
  data: {
    playerId: number
    weapon?: string
    team: string
  }
  meta?: PlayerMeta
}

export interface PlayerDamageEvent extends BaseEvent {
  eventType: EventType.PLAYER_DAMAGE
  data: {
    attackerId: number
    victimId: number
    weapon: string
    damage: number
    damageArmor: number
    healthRemaining: number
    armorRemaining: number
    hitgroup: string
    attackerTeam: string
    victimTeam: string
  }
  meta?: DualPlayerMeta
}

export interface PlayerTeamkillEvent extends BaseEvent {
  eventType: EventType.PLAYER_TEAMKILL
  data: {
    killerId: number
    victimId: number
    weapon: string
    headshot: boolean
    distance?: number
    team: string
  }
  meta?: DualPlayerMeta
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
    team: string
  }
  meta?: PlayerMeta
}

export interface PlayerChangeRoleEvent extends BaseEvent {
  eventType: EventType.PLAYER_CHANGE_ROLE
  data: {
    playerId: number
    role: string
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

export interface PlayerChatEvent extends BaseEvent {
  eventType: EventType.CHAT_MESSAGE
  data: {
    playerId: number
    message: string
    team: string
    isDead: boolean
    messageMode?: number
  }
  meta?: PlayerMeta
}

// Union type of all player events
export type PlayerEvent =
  | PlayerKillEvent
  | PlayerConnectEvent
  | PlayerDisconnectEvent
  | PlayerSuicideEvent
  | PlayerDamageEvent
  | PlayerTeamkillEvent
  | PlayerEntryEvent
  | PlayerChangeTeamEvent
  | PlayerChangeRoleEvent
  | PlayerChangeNameEvent
  | PlayerChatEvent

// Player data types
export interface PlayerStats {
  kills: number
  deaths: number
  suicides: number
  teamkills: number
  headshots: number
  shots: number
  hits: number
  skill: number
  kill_streak: number
  death_streak: number
  connection_time: number
  last_event: number
}

export interface PlayerStatsUpdate {
  kills?: number
  deaths?: number
  suicides?: number
  teamkills?: number
  skill?: number
  shots?: number
  hits?: number
  headshots?: number
  kill_streak?: number
  death_streak?: number
  connection_time?: number
  last_event?: number
  lastName?: string
}

export interface PlayerCreateData {
  lastName: string
  game: string
  skill?: number
  steamId: string
}

export interface SkillRating {
  playerId: number
  rating: number
  confidence: number
  volatility: number
  gamesPlayed: number
}

export interface RatingUpdate {
  playerId: number
  newRating: number
  gamesPlayed: number
}

// Service interfaces
export interface IPlayerService {
  // Player management
  getOrCreatePlayer(steamId: string, playerName: string, game: string): Promise<number>
  getPlayerStats(playerId: number): Promise<import("@repo/database/client").Player | null>
  updatePlayerStats(playerId: number, updates: PlayerStatsUpdate): Promise<void>

  // Rating system
  getPlayerRating(playerId: number): Promise<SkillRating>
  updatePlayerRatings(updates: RatingUpdate[]): Promise<void>

  // Queries
  getTopPlayers(
    limit?: number,
    game?: string,
    includeHidden?: boolean,
  ): Promise<import("@repo/database/client").Player[]>
  getRoundParticipants(serverId: number, duration: number): Promise<unknown[]>

  // Event handling
  handlePlayerEvent(event: PlayerEvent): Promise<HandlerResult>
  handleKillEvent(event: PlayerKillEvent): Promise<HandlerResult>
}

export interface IPlayerRepository {
  // CRUD operations
  findById(
    playerId: number,
    options?: FindOptions,
  ): Promise<import("@repo/database/client").Player | null>
  findByUniqueId(
    uniqueId: string,
    game: string,
    options?: FindOptions,
  ): Promise<import("@repo/database/client").Player | null>
  create(
    data: PlayerCreateData,
    options?: CreateOptions,
  ): Promise<import("@repo/database/client").Player>
  update(
    playerId: number,
    data: Partial<import("@repo/database/client").Player>,
    options?: UpdateOptions,
  ): Promise<import("@repo/database/client").Player>

  // Specialized queries
  findTopPlayers(
    limit: number,
    game: string,
    includeHidden: boolean,
    options?: FindOptions,
  ): Promise<import("@repo/database/client").Player[]>
  findRoundParticipants(
    serverId: number,
    startTime: Date,
    options?: FindOptions,
  ): Promise<unknown[]>

  // Unique ID management
  createUniqueId(
    playerId: number,
    uniqueId: string,
    game: string,
    options?: CreateOptions,
  ): Promise<void>
  findUniqueIdEntry(uniqueId: string, game: string, options?: FindOptions): Promise<unknown>

  // Event creation
  createChatEvent(
    playerId: number,
    serverId: number,
    map: string,
    message: string,
    messageMode?: number,
    options?: CreateOptions,
  ): Promise<void>

  // Player stats retrieval for skill calculations
  getPlayerStats(
    playerId: number,
    options?: FindOptions,
  ): Promise<import("@repo/database/client").Player | null>

  // EventFrag logging for kill events
  logEventFrag(
    killerId: number,
    victimId: number,
    serverId: number,
    map: string,
    weapon: string,
    headshot: boolean,
    killerRole?: string,
    victimRole?: string,
    killerX?: number,
    killerY?: number,
    killerZ?: number,
    victimX?: number,
    victimY?: number,
    victimZ?: number,
    options?: CreateOptions,
  ): Promise<void>
}

export interface IPlayerEventHandler {
  handleEvent(event: PlayerEvent): Promise<HandlerResult>
}
