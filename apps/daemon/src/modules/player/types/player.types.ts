/**
 * Player Module Types
 */

import type { BaseEvent, EventType, PlayerMeta, DualPlayerMeta } from "@/shared/types/events"
import type { HandlerResult } from "@/shared/types/common"
import type { FindOptions, UpdateOptions, CreateOptions } from "@/shared/types/database"
import type { Player, Prisma } from "@repo/database/client"

// Re-export Player type for convenience
export type { Player } from "@repo/database/client"

// Prisma input types for player operations
export type PlayerCreateInput = Prisma.PlayerCreateInput
export type PlayerUpdateInput = Prisma.PlayerUpdateInput

// Player-specific event types
export interface PlayerKillEvent extends BaseEvent {
  eventType: EventType.PLAYER_KILL
  data: {
    killerGameUserId?: number // Original from parser
    victimGameUserId?: number // Original from parser
    killerId: number // Resolved by PlayerEventHandler
    victimId: number // Resolved by PlayerEventHandler
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
    gameUserId: number
    playerId?: number // Added by PlayerEventHandler ID resolution
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
    gameUserId: number
    playerId?: number // Added by PlayerEventHandler ID resolution
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
    attackerGameUserId?: number // Original from parser
    victimGameUserId?: number // Original from parser
    attackerId: number // Resolved by PlayerEventHandler
    victimId: number // Resolved by PlayerEventHandler
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
  killStreak: number
  deathStreak: number
  connectionTime: number
  lastEvent: Date | null
  accuracy?: number
}

export interface PlayerSessionStats {
  kills: number
  deaths: number
  sessionTime: number
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
  killStreak?: number
  deathStreak?: number
  connectionTime?: number
  lastEvent?: Date
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

export interface PlayerWithCounts extends Player {
  _count: {
    fragsAsKiller: number
  }
}

// Player resolver interface for breaking circular dependencies
export interface IPlayerResolver {
  /**
   * Get or create a player by Steam ID and name
   * Returns the database player ID
   */
  getOrCreatePlayer(
    steamId: string,
    playerName: string,
    game: string,
    serverId?: number,
  ): Promise<number>
}

// Service interfaces
export interface IPlayerService extends IPlayerResolver {
  // Player management inherits getOrCreatePlayer from IPlayerResolver
  getPlayerStats(playerId: number): Promise<Player | null>
  updatePlayerStats(playerId: number, updates: PlayerStatsUpdate): Promise<void>

  // Batch operations for performance optimization
  getPlayerStatsBatch(playerIds: number[]): Promise<Map<number, Player>>
  updatePlayerStatsBatch(updates: Array<{ playerId: number; skillDelta: number }>): Promise<void>

  // Rating system
  getPlayerRating(playerId: number): Promise<SkillRating>
  updatePlayerRatings(updates: RatingUpdate[]): Promise<void>

  // Event handling
  handlePlayerEvent(event: PlayerEvent): Promise<HandlerResult>
}

// Per-alias (players_names) aggregation update shape
export interface PlayerNameStatsUpdate {
  numUses?: number
  connectionTime?: number
  kills?: number
  deaths?: number
  suicides?: number
  shots?: number
  hits?: number
  headshots?: number
  lastUse?: Date
}

export interface IPlayerRepository {
  // CRUD operations
  findById(playerId: number, options?: FindOptions): Promise<Player | null>
  findByUniqueId(uniqueId: string, game: string, options?: FindOptions): Promise<Player | null>
  create(data: PlayerCreateData, options?: CreateOptions): Promise<Player>
  upsertPlayer(data: PlayerCreateData, options?: CreateOptions): Promise<Player>
  update(playerId: number, data: Partial<Player>, options?: UpdateOptions): Promise<Player>

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

  // Change events
  createChangeNameEvent(
    playerId: number,
    serverId: number,
    map: string,
    oldName: string,
    newName: string,
    options?: CreateOptions,
  ): Promise<void>

  createChangeTeamEvent(
    playerId: number,
    serverId: number,
    map: string,
    team: string,
    options?: CreateOptions,
  ): Promise<void>

  createChangeRoleEvent(
    playerId: number,
    serverId: number,
    map: string,
    role: string,
    options?: CreateOptions,
  ): Promise<void>

  // Suicide / Teamkill events
  createSuicideEvent(
    playerId: number,
    serverId: number,
    map: string,
    weapon?: string,
    options?: CreateOptions,
  ): Promise<void>

  createTeamkillEvent(
    killerId: number,
    victimId: number,
    serverId: number,
    map: string,
    weapon: string,
    options?: CreateOptions,
  ): Promise<void>

  // Entry lifecycle event
  createEntryEvent?(
    playerId: number,
    serverId: number,
    map: string,
    options?: CreateOptions,
  ): Promise<void>

  // Connect/disconnect lifecycle events
  createConnectEvent(
    playerId: number,
    serverId: number,
    map: string,
    ipAddress: string,
    options?: CreateOptions,
  ): Promise<void>

  createDisconnectEvent(
    playerId: number,
    serverId: number,
    map: string,
    options?: CreateOptions,
  ): Promise<void>

  // Player stats retrieval for skill calculations
  getPlayerStats(playerId: number, options?: FindOptions): Promise<Player | null>

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

  // Optional: update server stats in response to player connect/disconnect
  updateServerForPlayerEvent?(
    serverId: number,
    updates: Record<string, unknown>,
    options?: UpdateOptions,
  ): Promise<void>

  // players_names aggregation upsert
  upsertPlayerName(
    playerId: number,
    name: string,
    updates: PlayerNameStatsUpdate,
    options?: UpdateOptions,
  ): Promise<void>

  // Helpers
  hasRecentConnect(serverId: number, playerId: number, withinMs?: number): Promise<boolean>

  // Batch operations for performance optimization
  getPlayerStatsBatch(playerIds: number[]): Promise<Map<number, Player>>
  updatePlayerStatsBatch(updates: Array<{ playerId: number; skillDelta: number }>): Promise<void>

  // Player ranking and stats methods for commands
  getPlayerRank(playerId: number): Promise<number | null>
  getTotalPlayerCount(): Promise<number>
  getPlayerSessionStats(playerId: number): Promise<PlayerSessionStats | null>
}
