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
   * Get servers with their online status, ordered by most recent activity
   * A server is considered online if it has any events within the last 5 minutes
   * Returns up to 10 servers ordered by most recent activity
   * Optimized to avoid N+1 queries by batching event and player count queries
   */
  async getServersWithStatus(): Promise<Result<ServerWithStatus[], AppError>> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

      // Get all servers with recent event counts in one query
      const servers = await this.db.server.findMany({
        include: {
          _count: {
            select: {
              eventsChat: { where: { eventTime: { gte: fiveMinutesAgo } } },
              eventsFrag: { where: { eventTime: { gte: fiveMinutesAgo } } },
              eventsConnect: { where: { eventTime: { gte: fiveMinutesAgo } } },
            },
          },
        },
      })

      const serverIds = servers.map((s) => s.serverId)

      // Batch query: Get most recent events for all servers in 3 queries instead of N*3
      const [latestChatEvents, latestFragEvents, latestConnectEvents] = await Promise.all([
        this.db.eventChat.findMany({
          where: { serverId: { in: serverIds } },
          select: { serverId: true, eventTime: true },
          orderBy: { eventTime: "desc" },
          distinct: ["serverId"],
        }),
        this.db.eventFrag.findMany({
          where: { serverId: { in: serverIds } },
          select: { serverId: true, eventTime: true },
          orderBy: { eventTime: "desc" },
          distinct: ["serverId"],
        }),
        this.db.eventConnect.findMany({
          where: { serverId: { in: serverIds } },
          select: { serverId: true, eventTime: true },
          orderBy: { eventTime: "desc" },
          distinct: ["serverId"],
        }),
      ])

      // Create lookup maps for O(1) access
      const chatEventMap = new Map(latestChatEvents.map((e) => [e.serverId, e.eventTime]))
      const fragEventMap = new Map(latestFragEvents.map((e) => [e.serverId, e.eventTime]))
      const connectEventMap = new Map(latestConnectEvents.map((e) => [e.serverId, e.eventTime]))

      // Batch query: Get player counts for all servers in one query
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const allRecentConnects = await this.db.eventConnect.findMany({
        where: {
          serverId: { in: serverIds },
          eventTime: { gte: oneHourAgo },
          playerId: { gt: 0 },
        },
        select: { serverId: true, playerId: true },
        distinct: ["serverId", "playerId"],
      })

      // Group player counts by server
      const playerCountMap = new Map<number, number>()
      for (const event of allRecentConnects) {
        const current = playerCountMap.get(event.serverId) || 0
        playerCountMap.set(event.serverId, current + 1)
      }

      // Build results using lookup maps (no additional queries)
      const serversWithStatus: ServerWithStatus[] = servers.map((server) => {
        const hasRecentActivity =
          server._count.eventsChat > 0 ||
          server._count.eventsFrag > 0 ||
          server._count.eventsConnect > 0

        // Get most recent activity across all event types using lookup maps
        const eventTimes = [
          chatEventMap.get(server.serverId),
          fragEventMap.get(server.serverId),
          connectEventMap.get(server.serverId),
        ].filter((time): time is Date => time !== undefined)

        const lastActivity: Date | null =
          eventTimes.length > 0 ? eventTimes.sort((a, b) => b.getTime() - a.getTime())[0]! : null

        return {
          id: server.serverId.toString(),
          address: server.address,
          port: server.port,
          name: server.name,
          isOnline: hasRecentActivity,
          lastActivity,
          playerCount: playerCountMap.get(server.serverId) || 0,
        }
      })

      // Sort by most recent activity (online servers first, then by last activity)
      const sortedServers = serversWithStatus.sort((a, b) => {
        // Online servers first
        if (a.isOnline && !b.isOnline) return -1
        if (!a.isOnline && b.isOnline) return 1

        // Among servers of same online status, sort by last activity
        if (a.lastActivity && b.lastActivity) {
          return b.lastActivity.getTime() - a.lastActivity.getTime()
        }

        // Servers with activity come before servers without
        if (a.lastActivity && !b.lastActivity) return -1
        if (!a.lastActivity && b.lastActivity) return 1

        // If both have no activity, sort by server name for consistency
        return a.name?.localeCompare(b.name || "") || 0
      })

      // Take only the top 10 most active servers
      const topServers = sortedServers.slice(0, 10)

      return success(topServers)
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
