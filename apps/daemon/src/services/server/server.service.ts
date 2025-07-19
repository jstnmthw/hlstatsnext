/**
 * Server Service for HLStats Daemon
 *
 * Handles all server-related database operations including:
 * - Server authentication and lookup
 * - Server management
 */

import type { DatabaseClient } from "@/database/client"

export class ServerService {
  constructor(private readonly db: DatabaseClient) {}

  /**
   * Look up a game server by its IP address and port.
   */
  async getServerByAddress(ipAddress: string, port: number): Promise<{ serverId: number } | null> {
    try {
      const server = await this.db.prisma.server.findFirst({
        where: {
          address: ipAddress,
          port,
        },
        select: {
          serverId: true,
        },
      })

      return server ?? null
    } catch (error) {
      console.error(`Failed to fetch server by address:`, error)
      throw error
    }
  }

  /**
   * Get the game associated with a server by its ID.
   */
  async getGameByServerId(serverId: number): Promise<string | null> {
    try {
      const server = await this.db.prisma.server.findUnique({
        where: {
          serverId,
        },
        select: {
          game: true,
        },
      })

      return server?.game ?? null
    } catch (error) {
      console.error(`Failed to fetch server game for serverId: ${serverId}`, error)
      throw error
    }
  }
}
