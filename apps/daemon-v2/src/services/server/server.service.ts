/**
 * Server Service for HLStats Daemon v2
 *
 * Handles all server-related database operations including:
 * - Server authentication and lookup
 * - Server management
 */

import type { DatabaseClient } from "@/database/client"

export class ServerService {
  constructor(private readonly db: DatabaseClient) {}

  /**
   * Look up a game server by its IP address and port. This is used by the ingress
   * service to authenticate that incoming UDP packets originate from a known and
   * authorised server record that an admin has added via the (future) admin UI.
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
}
