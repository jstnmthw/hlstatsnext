/**
 * Match Module Types
 */

import type { BaseEvent, EventType, PlayerMeta } from "@/shared/types/events"
import type { HandlerResult } from "@/shared/types/common"
import type { FindOptions, UpdateOptions, CreateOptions } from "@/shared/types/database"

// Match-specific event types
export interface RoundStartEvent extends BaseEvent {
  eventType: EventType.ROUND_START
  data: {
    map: string
    roundNumber: number
    maxPlayers: number
  }
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
    winningTeam: string
    triggerName: string
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

// Objective event types
export interface BombPlantEvent extends BaseEvent {
  eventType: EventType.BOMB_PLANT
  data: {
    playerId: number
    bombsite?: string
    team: string
  }
  meta?: PlayerMeta
}

export interface BombDefuseEvent extends BaseEvent {
  eventType: EventType.BOMB_DEFUSE
  data: {
    playerId: number
    bombsite?: string
    team: string
    timeRemaining?: number
  }
  meta?: PlayerMeta
}

export interface BombExplodeEvent extends BaseEvent {
  eventType: EventType.BOMB_EXPLODE
  data: {
    bombsite?: string
    planterPlayerId?: number
  }
}

export interface HostageRescueEvent extends BaseEvent {
  eventType: EventType.HOSTAGE_RESCUE
  data: {
    playerId: number
    hostageId?: number
    team: string
  }
  meta?: PlayerMeta
}

export interface HostageTouchEvent extends BaseEvent {
  eventType: EventType.HOSTAGE_TOUCH
  data: {
    playerId: number
    hostageId?: number
    team: string
  }
  meta?: PlayerMeta
}

export interface FlagCaptureEvent extends BaseEvent {
  eventType: EventType.FLAG_CAPTURE
  data: {
    playerId: number
    flagTeam: string
    captureTeam: string
  }
  meta?: PlayerMeta
}

export interface FlagDefendEvent extends BaseEvent {
  eventType: EventType.FLAG_DEFEND
  data: {
    playerId: number
    flagTeam: string
    team: string
  }
  meta?: PlayerMeta
}

export interface FlagPickupEvent extends BaseEvent {
  eventType: EventType.FLAG_PICKUP
  data: {
    playerId: number
    flagTeam: string
    team: string
  }
  meta?: PlayerMeta
}

export interface FlagDropEvent extends BaseEvent {
  eventType: EventType.FLAG_DROP
  data: {
    playerId: number
    flagTeam: string
    team: string
    reason?: string
  }
  meta?: PlayerMeta
}

export interface ControlPointCaptureEvent extends BaseEvent {
  eventType: EventType.CONTROL_POINT_CAPTURE
  data: {
    playerId: number
    pointName: string
    pointId?: number
    capturingTeam: string
    previousOwner?: string
    captureTime?: number
  }
  meta?: PlayerMeta
}

export interface ControlPointDefendEvent extends BaseEvent {
  eventType: EventType.CONTROL_POINT_DEFEND
  data: {
    playerId: number
    pointName: string
    pointId?: number
    defendingTeam: string
    team: string
  }
  meta?: PlayerMeta
}

// Union types
export type MatchEvent = RoundStartEvent | RoundEndEvent | TeamWinEvent | MapChangeEvent

export type ObjectiveEvent =
  | BombPlantEvent
  | BombDefuseEvent
  | BombExplodeEvent
  | HostageRescueEvent
  | HostageTouchEvent
  | FlagCaptureEvent
  | FlagDefendEvent
  | FlagPickupEvent
  | FlagDropEvent
  | ControlPointCaptureEvent
  | ControlPointDefendEvent

// Match data types
export interface MatchStats {
  duration: number
  totalRounds: number
  teamScores: Record<string, number>
  mvpPlayer?: number
  startTime: Date
  playerStats: Map<number, PlayerRoundStats>
  currentMap: string
}

export interface PlayerRoundStats {
  playerId: number
  kills: number
  deaths: number
  assists: number
  damage: number
  objectiveScore: number
  clutchWins: number
  headshots: number
  shots: number
  hits: number
  suicides: number
  teamkills: number
}

export interface MatchResult {
  matchId?: string
  duration: number
  totalRounds: number
  mvpPlayerId?: number
  teamScores: Record<string, number>
  playerStats: PlayerRoundStats[]
}

// Service interfaces
export interface IMatchService {
  // Match management
  handleMatchEvent(event: MatchEvent): Promise<HandlerResult>
  handleObjectiveEvent(event: ObjectiveEvent): Promise<HandlerResult>
  handleKillInMatch(event: BaseEvent): Promise<HandlerResult>

  // Match state
  getMatchStats(serverId: number): MatchStats | undefined
  getCurrentMap(serverId: number): string
  initializeMapForServer(serverId: number): Promise<string>
  resetMatchStats(serverId: number): void
  updatePlayerWeaponStats(
    serverId: number,
    playerId: number,
    stats: { shots?: number; hits?: number; damage?: number },
  ): void

  // MVP calculations
  calculateMatchMVP(serverId: number): Promise<number | undefined>
  calculatePlayerScore(stats: PlayerRoundStats): number
}

// Type for server record from database
export interface ServerRecord {
  serverId: number
  game: string
  act_map?: string
  [key: string]: unknown
}

// Type for player history data
export interface PlayerHistoryData {
  playerId: number
  eventTime: Date
  game?: string
  kills?: number
  deaths?: number
  suicides?: number
  skill?: number
  shots?: number
  hits?: number
  headshots?: number
  teamkills?: number
  connectionTime?: number
  killStreak?: number
  deathStreak?: number
  skill_change?: number
}

export interface IMatchRepository {
  // Server operations
  updateServerStats(
    serverId: number,
    updates: Record<string, unknown>,
    options?: UpdateOptions,
  ): Promise<void>
  findServerById(serverId: number, options?: FindOptions): Promise<ServerRecord | null>

  // Match history
  createPlayerHistory(data: PlayerHistoryData, options?: CreateOptions): Promise<void>

  // Map detection
  getLastKnownMap(serverId: number): Promise<string | null>

  // Map statistics
  updateMapCount(
    game: string,
    map: string,
    kills: number,
    headshots: number,
    options?: UpdateOptions,
  ): Promise<void>

  // Additional server operations
  incrementServerRounds(serverId: number, options?: UpdateOptions): Promise<void>
  updateTeamWins(serverId: number, winningTeam: string, options?: UpdateOptions): Promise<void>
  updateBombStats(
    serverId: number,
    eventType: "plant" | "defuse",
    options?: UpdateOptions,
  ): Promise<void>
  resetMapStats(serverId: number, newMap: string, options?: UpdateOptions): Promise<void>
}
