import { CACHE_TTL, cacheManager, CacheManager } from "../../shared/utils/cache-manager"
import { handlePrismaError } from "../../shared/utils/prisma-error-handler"
import { PlayerRepository } from "./player.repository"
import type {
  GetPlayersFilters,
  GetPlayersResult,
  GetServerPlayersFilters,
  GetServerPlayersResult,
  PlayerOrderByInput,
  PlayerWhereInput,
} from "./player.types"

export class PlayerService {
  private playerRepository: PlayerRepository

  constructor() {
    this.playerRepository = new PlayerRepository()
  }

  async getPlayers(
    filters: GetPlayersFilters = {},
    pagination: { take?: number; skip?: number } = {},
    orderBy: PlayerOrderByInput[] = [],
  ): Promise<GetPlayersResult> {
    try {
      const { serverId, game, search, onlineOnly, recentOnly, recentDays } = filters

      // Build where clause
      const where: PlayerWhereInput = {
        AND: [
          game ? { game } : {},
          search
            ? {
                lastName: {
                  contains: search,
                },
              }
            : {},
          recentOnly
            ? {
                lastEvent: {
                  gte: new Date(Date.now() - (recentDays || 30) * 24 * 60 * 60 * 1000),
                },
              }
            : {},
          serverId && onlineOnly
            ? {
                connects: {
                  some: {
                    serverId,
                    eventTimeDisconnect: null,
                    eventTime: {
                      gte: new Date(Date.now() - 6 * 60 * 60 * 1000),
                    },
                  },
                },
              }
            : serverId
              ? {
                  connects: {
                    some: {
                      serverId,
                    },
                  },
                }
              : {},
        ],
      }

      const [players, totalCount] = await Promise.all([
        this.playerRepository.findManyPlayers({
          where,
          take: pagination.take,
          skip: pagination.skip,
          orderBy: orderBy.length > 0 ? orderBy : [{ skill: "desc" }],
        }),
        this.playerRepository.countPlayers(where),
      ])

      // Transform players to include derived stats
      const playersWithStats = players.map((player) => ({
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
        kdRatio:
          player.deaths > 0 ? Number((player.kills / player.deaths).toFixed(2)) : player.kills,
        headshotRatio:
          player.kills > 0 ? Number(((player.headshots / player.kills) * 100).toFixed(1)) : 0,
        isOnline: false, // Will be computed in server-specific queries
        totalSessions: 0, // Will be computed in server-specific queries
        favoriteServer: false, // Will be computed in server-specific queries
      }))

      return {
        players: playersWithStats,
        totalCount,
      }
    } catch (error) {
      throw handlePrismaError(error, "Failed to get players")
    }
  }

  async getServerPlayers(
    serverId: number,
    filters: GetServerPlayersFilters = {},
    pagination: { take?: number; skip?: number } = {},
    orderBy: PlayerOrderByInput[] = [],
  ): Promise<GetServerPlayersResult> {
    try {
      // Generate cache keys
      const playersKey = CacheManager.generateServerPlayerKey(
        serverId,
        filters as Record<string, unknown>,
        pagination as Record<string, unknown>,
        orderBy as Record<string, unknown>[],
      )

      // Try to get from cache first
      const cachedResult = cacheManager.get<GetServerPlayersResult>(playersKey)
      if (cachedResult) {
        return cachedResult
      }

      // If not cached, fetch from database
      const [players, counts] = await Promise.all([
        this.playerRepository.getServerPlayers(serverId, filters, pagination, orderBy),
        this.playerRepository.getServerPlayersCount(serverId, filters),
      ])

      const result = {
        players,
        totalCount: counts.total,
        onlineCount: counts.online,
        recentCount: counts.recent,
      }

      // Cache the result
      const ttl = filters.onlineOnly ? CACHE_TTL.PLAYER_COUNTS : CACHE_TTL.PLAYER_LIST
      cacheManager.set(playersKey, result, ttl)

      return result
    } catch (error) {
      throw handlePrismaError(error, "Failed to get server players")
    }
  }

  async getPlayerById(playerId: number) {
    try {
      const player = await this.playerRepository.getPlayerById(playerId)
      if (!player) {
        throw new Error(`Player with ID ${playerId} not found`)
      }
      return player
    } catch (error) {
      throw handlePrismaError(error, "Failed to get player")
    }
  }

  async getPlayerServerHistory(playerId: number, serverId: number, limit = 30) {
    try {
      return await this.playerRepository.getPlayerServerHistory(playerId, serverId, limit)
    } catch (error) {
      throw handlePrismaError(error, "Failed to get player server history")
    }
  }

  async getPlayersRecentActivity(serverId?: number, days = 7) {
    try {
      return await this.playerRepository.getPlayersRecentActivity(serverId, days)
    } catch (error) {
      throw handlePrismaError(error, "Failed to get recent player activity")
    }
  }

  // Utility methods for common filters
  buildPlayerWhereInput(filters: GetPlayersFilters): PlayerWhereInput {
    const { game, search, onlineOnly, recentOnly, recentDays, serverId } = filters

    return {
      AND: [
        game ? { game } : {},
        search
          ? {
              OR: [
                {
                  lastName: {
                    contains: search,
                  },
                },
                {
                  names: {
                    some: {
                      name: {
                        contains: search,
                      },
                    },
                  },
                },
              ],
            }
          : {},
        recentOnly
          ? {
              lastEvent: {
                gte: new Date(Date.now() - (recentDays || 30) * 24 * 60 * 60 * 1000),
              },
            }
          : {},
        serverId
          ? {
              connects: {
                some: {
                  serverId,
                  ...(onlineOnly && {
                    eventTimeDisconnect: null,
                    eventTime: {
                      gte: new Date(Date.now() - 6 * 60 * 60 * 1000),
                    },
                  }),
                },
              },
            }
          : {},
      ],
    }
  }

  buildPlayerOrderBy(
    sortField: string = "skill",
    sortOrder: "asc" | "desc" = "desc",
  ): PlayerOrderByInput[] {
    const orderBy: PlayerOrderByInput[] = []

    switch (sortField) {
      case "name":
        orderBy.push({ lastName: sortOrder })
        break
      case "skill":
        orderBy.push({ skill: sortOrder })
        break
      case "kills":
        orderBy.push({ kills: sortOrder })
        break
      case "deaths":
        orderBy.push({ deaths: sortOrder })
        break
      case "lastEvent":
        orderBy.push({ lastEvent: sortOrder })
        break
      case "connectionTime":
        orderBy.push({ connectionTime: sortOrder })
        break
      default:
        orderBy.push({ skill: "desc" })
        break
    }

    return orderBy
  }
}
