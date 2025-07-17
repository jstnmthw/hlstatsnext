import type { PrismaClient } from "@repo/database/client"
import type { Result, AppError } from "@/shared/types"
import type { ServerWithStatus } from "./server.types"
import { success, failure } from "@/shared/types"
import { isRecordNotFoundError } from "@/shared/utils/prisma-error-handler"

/**
 * Server service handling business logic for server operations
 */
export class ServerService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get server with online status based on recent activity
   * A server is considered online if it has logs within the last 5 minutes
   */
  async getServerWithStatus(serverId: string): Promise<Result<ServerWithStatus, AppError>> {
    try {
      const server = await this.db.server.findUnique({
        where: { serverId: parseInt(serverId) },
        include: {
          _count: {
            select: {
              eventsConnect: {
                where: {
                  eventTime: {
                    gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
                  },
                },
              },
            },
          },
        },
      })

      if (!server) {
        return failure({
          type: "NOT_FOUND",
          message: "Server not found",
          resource: "server",
          id: serverId,
        })
      }

      // Get the most recent event for last activity
      const lastEvent = await this.db.eventConnect.findFirst({
        where: { serverId: server.serverId },
        orderBy: { eventTime: "desc" },
        select: { eventTime: true },
      })

      // Get current player count from recent events
      const recentPlayerCount = await this.getRecentPlayerCount(server.serverId)

      const serverWithStatus: ServerWithStatus = {
        id: server.serverId.toString(),
        address: server.address,
        port: server.port,
        name: server.name,
        isOnline: server._count.eventsConnect > 0,
        lastActivity: lastEvent?.eventTime || null,
        playerCount: recentPlayerCount,
      }

      return success(serverWithStatus)
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return failure({
          type: "NOT_FOUND",
          message: "Server not found",
          resource: "server",
          id: serverId,
        })
      }

      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch server status",
        operation: "getServerWithStatus",
      })
    }
  }

  /**
   * Get all servers with their online status
   */
  async getServersWithStatus(): Promise<Result<ServerWithStatus[], AppError>> {
    try {
      const servers = await this.db.server.findMany({
        include: {
          _count: {
            select: {
              eventsConnect: {
                where: {
                  eventTime: {
                    gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
                  },
                },
              },
            },
          },
        },
      })

      const serversWithStatus = await Promise.all(
        servers.map(async (server) => {
          const lastEvent = await this.db.eventConnect.findFirst({
            where: { serverId: server.serverId },
            orderBy: { eventTime: "desc" },
            select: { eventTime: true },
          })

          const recentPlayerCount = await this.getRecentPlayerCount(server.serverId)

          return {
            id: server.serverId.toString(),
            address: server.address,
            port: server.port,
            name: server.name,
            isOnline: server._count.eventsConnect > 0,
            lastActivity: lastEvent?.eventTime || null,
            playerCount: recentPlayerCount,
          }
        }),
      )

      return success(serversWithStatus)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch servers with status",
        operation: "getServersWithStatus",
      })
    }
  }

  /**
   * Get recent player count for a server based on unique players in the last hour
   */
  private async getRecentPlayerCount(serverId: number): Promise<number> {
    try {
      const uniquePlayers = await this.db.eventConnect.findMany({
        where: {
          serverId,
          eventTime: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
        select: {
          playerId: true,
        },
        distinct: ["playerId"],
      })

      // Filter out null playerIds and count unique players
      const validPlayerIds = new Set(
        uniquePlayers
          .map((event) => event.playerId)
          .filter((playerId): playerId is number => playerId !== null && playerId !== 0),
      )

      return validPlayerIds.size
    } catch {
      return 0
    }
  }
}
