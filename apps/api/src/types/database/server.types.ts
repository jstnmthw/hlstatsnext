import type { Server, Player, Game } from "@repo/database/client"

/**
 * Represents detailed server information including live player data
 */
export interface ServerDetails extends Omit<Server, "players"> {
  gameData: Game | null
  currentPlayers: Player[]
  playerCount: number
  isOnline: boolean
}

/**
 * Input for creating a server
 */
export interface CreateServerInput {
  address: string
  port: number
  gameId: string
  name?: string
  rconPassword?: string
  privateAddress?: string
}

/**
 * Input for updating a server
 */
export interface UpdateServerInput {
  name?: string
  rconPassword?: string
  privateAddress?: string
}
