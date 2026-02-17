import type { Prisma } from "@repo/db/client"

export interface GetPlayersFilters {
  serverId?: number
  game?: string
  search?: string
  onlineOnly?: boolean
  recentOnly?: boolean
  recentDays?: number
}

export interface GetServerPlayersFilters {
  search?: string
  onlineOnly?: boolean
  recentOnly?: boolean
  recentDays?: number
  minKills?: number
  minSkill?: number
}

// Player with server-specific stats
export interface PlayerServerStats {
  playerId: number
  lastName: string
  skill: number
  kills: number
  deaths: number
  suicides: number
  headshots: number
  connectionTime: number
  lastEvent: Date | null
  lastSkillChange: Date | null
  activity: number
  country: string
  flag: string | null

  // Server-specific derived fields
  kdRatio: number
  headshotRatio: number
  isOnline: boolean
  sessionDuration?: number
  totalSessions: number
  favoriteServer: boolean
}

// Input for player queries
export type PlayerWhereInput = Prisma.PlayerWhereInput
export type PlayerOrderByInput = Prisma.PlayerOrderByWithRelationInput

// Result types for GraphQL
export interface GetPlayersResult {
  players: PlayerServerStats[]
  totalCount: number
}

export interface GetServerPlayersResult {
  players: PlayerServerStats[]
  totalCount: number
  onlineCount: number
  recentCount: number
}
