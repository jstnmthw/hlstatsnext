/**
 * Match Module Types
 */

import type { HandlerResult } from "@/shared/types/common"
import type { CreateOptions, FindOptions, UpdateOptions } from "@/shared/types/database"
import type { BaseEvent, EventType } from "@/shared/types/events"

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

// Union types
export type MatchEvent = RoundStartEvent | RoundEndEvent | TeamWinEvent | MapChangeEvent

// Match data types
export interface MatchStats {
  duration: number
  totalRounds: number
  teamScores: Record<string, number>
  startTime: Date
  playerTeams?: Map<number, string>
}

// Service interfaces
export interface IMatchService {
  // Match management
  handleMatchEvent(event: MatchEvent): Promise<HandlerResult>

  // Match state
  getMatchStats(serverId: number): MatchStats | undefined
  resetMatchStats(serverId: number): void

  // Team tracking
  setPlayerTeam(serverId: number, playerId: number, team: string): void
  getPlayersByTeam(serverId: number, team: string): number[]

  // Server helpers
  getServerGame(serverId: number): Promise<string | null>
}

// Type for server record from database
export interface ServerRecord {
  serverId: number
  game: string
  activeMap?: string
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
  skillChange?: number
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
  resetMapStats(
    serverId: number,
    newMap: string,
    playerCount?: number,
    options?: UpdateOptions,
  ): Promise<void>

  // Helpers
  getPlayerSkill(playerId: number): Promise<number | null>
}
