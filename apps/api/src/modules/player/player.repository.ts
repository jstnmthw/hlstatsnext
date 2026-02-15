import { db, Prisma } from "@repo/database/client"
import type {
  GetServerPlayersFilters,
  PlayerOrderByInput,
  PlayerServerStats,
  PlayerWhereInput,
} from "./player.types"

export class PlayerRepository {
  async findManyPlayers(options: {
    take?: number
    skip?: number
    where?: PlayerWhereInput
    orderBy?: PlayerOrderByInput[]
  }) {
    return db.player.findMany(options)
  }

  async countPlayers(where?: PlayerWhereInput) {
    return db.player.count({ where })
  }

  async getServerPlayers(
    serverId: number,
    filters: GetServerPlayersFilters,
    pagination: { take?: number; skip?: number },
    orderBy?: PlayerOrderByInput[],
  ): Promise<PlayerServerStats[]> {
    const { search, onlineOnly, recentOnly, recentDays = 30, minKills, minSkill } = filters

    // Build where clause
    const whereClause: Prisma.PlayerWhereInput = {
      AND: [
        // Filter by minimum kills if specified
        minKills ? { kills: { gte: minKills } } : {},
        // Filter by minimum skill if specified
        minSkill ? { skill: { gte: minSkill } } : {},
        // Search by name if specified
        search
          ? {
              lastName: {
                contains: search,
              },
            }
          : {},
        // Filter by recent activity
        recentOnly
          ? {
              lastEvent: {
                gte: new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000),
              },
            }
          : {},
        // Filter players who have played on this server
        {
          connects: {
            some: {
              serverId,
            },
          },
        },
      ],
    }

    // If onlineOnly is true, get currently connected players
    if (onlineOnly) {
      const onlineFilter = {
        connects: {
          some: {
            serverId,
            eventTimeDisconnect: null, // Still connected
            eventTime: {
              gte: new Date(Date.now() - 6 * 60 * 60 * 1000), // Connected in last 6 hours
            },
          },
        },
      }
      if (Array.isArray(whereClause.AND)) {
        whereClause.AND.push(onlineFilter)
      }
    }

    const players = await db.player.findMany({
      where: whereClause,
      include: {
        connects: {
          where: { serverId },
          orderBy: { eventTime: "desc" },
          take: 5, // Get last 5 connections for session stats
        },
        disconnects: {
          where: { serverId },
          orderBy: { eventTime: "desc" },
          take: 5,
        },
      },
      take: pagination.take,
      skip: pagination.skip,
      orderBy: orderBy || [{ skill: "desc" }],
    })

    // Transform to PlayerServerStats
    return players.map((player) => {
      const lastConnect = player.connects[0]
      const lastDisconnect = player.disconnects[0]

      // Determine if player is currently online
      const isOnline =
        lastConnect && (!lastDisconnect || lastConnect.eventTime! > lastDisconnect.eventTime!)

      // Calculate session duration for online players
      let sessionDuration: number | undefined
      if (isOnline && lastConnect?.eventTime) {
        sessionDuration = Math.floor((Date.now() - lastConnect.eventTime.getTime()) / 1000)
      }

      // Calculate derived stats
      const kdRatio =
        player.deaths > 0 ? Number((player.kills / player.deaths).toFixed(2)) : player.kills
      const headshotRatio =
        player.kills > 0 ? Number(((player.headshots / player.kills) * 100).toFixed(1)) : 0
      const totalSessions = player.connects.length

      // Determine if this is their favorite server (more than 5 connections)
      const favoriteServer = totalSessions >= 5

      return {
        playerId: player.playerId,
        lastName: player.lastName,
        skill: player.skill,
        kills: player.kills,
        deaths: player.deaths,
        suicides: player.suicides,
        headshots: player.headshots,
        connectionTime: player.connectionTime,
        lastEvent: player.lastEvent,
        lastSkillChange: player.lastSkillChange,
        activity: player.activity,
        country: player.country,
        flag: player.flag,
        kdRatio,
        headshotRatio,
        isOnline: !!isOnline,
        sessionDuration,
        totalSessions,
        favoriteServer,
      }
    })
  }

  async getServerPlayersCount(
    serverId: number,
    filters: GetServerPlayersFilters,
  ): Promise<{ total: number; online: number; recent: number }> {
    const { search, minKills, minSkill, recentDays = 30 } = filters

    // Base where clause for all players who have played on this server
    const baseWhere: Prisma.PlayerWhereInput = {
      AND: [
        minKills ? { kills: { gte: minKills } } : {},
        minSkill ? { skill: { gte: minSkill } } : {},
        search
          ? {
              lastName: {
                contains: search,
              },
            }
          : {},
        {
          connects: {
            some: {
              serverId,
            },
          },
        },
      ],
    }

    // Count total players
    const total = await db.player.count({
      where: baseWhere,
    })

    // Count online players
    const online = await db.player.count({
      where: {
        ...baseWhere,
        connects: {
          some: {
            serverId,
            eventTimeDisconnect: null,
            eventTime: {
              gte: new Date(Date.now() - 6 * 60 * 60 * 1000),
            },
          },
        },
      },
    })

    // Count recent players
    const recent = await db.player.count({
      where: {
        ...baseWhere,
        lastEvent: {
          gte: new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000),
        },
      },
    })

    return { total, online, recent }
  }

  async getPlayerById(playerId: number) {
    return db.player.findUnique({
      where: { playerId },
      include: {
        uniqueIds: true,
        names: {
          orderBy: { lastUse: "desc" },
          take: 10,
        },
        awards: {
          include: { award: true },
          orderBy: { awardTime: "desc" },
          take: 10,
        },
        ribbons: {
          include: { ribbon: true },
        },
      },
    })
  }

  async getPlayerServerHistory(playerId: number, serverId: number, limit = 30) {
    return db.eventConnect.findMany({
      where: {
        playerId,
        serverId,
      },
      include: {
        server: {
          select: {
            name: true,
            address: true,
            port: true,
          },
        },
      },
      orderBy: { eventTime: "desc" },
      take: limit,
    })
  }

  async getPlayersRecentActivity(serverId?: number, days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    return db.player.findMany({
      where: {
        lastEvent: { gte: since },
        ...(serverId && {
          connects: {
            some: { serverId },
          },
        }),
      },
      orderBy: { lastEvent: "desc" },
      take: 50,
    })
  }
}
