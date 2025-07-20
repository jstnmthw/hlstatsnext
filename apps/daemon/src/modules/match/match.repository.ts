/**
 * Match Repository
 *
 * Data access layer for match and server operations.
 */

import { BaseRepository } from "@/shared/infrastructure/repository.base"
import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger"
import type { IMatchRepository, ServerRecord, PlayerHistoryData } from "./match.types"
import type { UpdateOptions, CreateOptions, FindOptions } from "@/shared/types/database"
import type { Prisma } from "@repo/database/client"

export class MatchRepository extends BaseRepository<ServerRecord> implements IMatchRepository {
  protected tableName = "server"

  constructor(db: DatabaseClient, logger: ILogger) {
    super(db, logger)
  }

  async updateServerStats(
    serverId: number,
    updates: Record<string, unknown>,
    options?: UpdateOptions,
  ): Promise<void> {
    try {
      this.validateId(serverId, "updateServerStats")

      await this.executeWithTransaction(async (client) => {
        await client.server.update({
          where: { serverId },
          data: updates,
        })
      }, options)
    } catch (error) {
      this.handleError("updateServerStats", error)
    }
  }

  async findServerById(serverId: number, options?: FindOptions): Promise<ServerRecord | null> {
    try {
      this.validateId(serverId, "findServerById")

      return await this.executeWithTransaction(async (client) => {
        const query: Prisma.ServerFindUniqueArgs = { where: { serverId } }
        if (options?.include) {
          query.include = options.include as Prisma.ServerInclude
        }
        if (options?.select) {
          query.select = options.select as Prisma.ServerSelect
        }
        return client.server.findUnique(query)
      }, options)
    } catch (error) {
      this.handleError("findServerById", error)
    }
  }

  async createPlayerHistory(data: PlayerHistoryData, options?: CreateOptions): Promise<void> {
    try {
      if (!data.playerId || !data.eventTime) {
        throw new Error("playerId and eventTime are required for player history")
      }

      await this.executeWithTransaction(async (client) => {
        await client.playerHistory.create({
          data: {
            playerId: data.playerId,
            eventTime: data.eventTime,
            kills: data.kills || 0,
            deaths: data.deaths || 0,
            suicides: data.suicides || 0,
            skill: data.skill || 0,
            shots: data.shots || 0,
            hits: data.hits || 0,
            headshots: data.headshots || 0,
            teamkills: data.teamkills || 0,
          },
        })
      }, options)
    } catch (error) {
      this.handleError("createPlayerHistory", error)
    }
  }

  async updateMapCount(
    game: string,
    map: string,
    kills: number,
    headshots: number,
    options?: UpdateOptions,
  ): Promise<void> {
    try {
      if (!game || !map) {
        throw new Error("game and map are required for map count update")
      }

      await this.executeWithTransaction(async (client) => {
        await client.mapCount.upsert({
          where: {
            game_map: { game, map },
          },
          create: {
            game,
            map,
            kills,
            headshots,
          },
          update: {
            kills: { increment: kills },
            headshots: { increment: headshots },
          },
        })
      }, options)
    } catch (error) {
      this.handleError("updateMapCount", error)
    }
  }

  // Additional repository methods for match-specific operations

  async incrementServerRounds(serverId: number, options?: UpdateOptions): Promise<void> {
    try {
      await this.updateServerStats(
        serverId,
        {
          map_rounds: { increment: 1 },
          rounds: { increment: 1 },
        },
        options,
      )
    } catch (error) {
      this.handleError("incrementServerRounds", error)
    }
  }

  async updateTeamWins(
    serverId: number,
    winningTeam: string,
    options?: UpdateOptions,
  ): Promise<void> {
    try {
      const updates: Record<string, unknown> = {}

      if (winningTeam === "TERRORIST") {
        updates.ts_wins = { increment: 1 }
        updates.map_ts_wins = { increment: 1 }
      } else if (winningTeam === "CT") {
        updates.ct_wins = { increment: 1 }
        updates.map_ct_wins = { increment: 1 }
      }

      if (Object.keys(updates).length > 0) {
        await this.updateServerStats(serverId, updates, options)
      }
    } catch (error) {
      this.handleError("updateTeamWins", error)
    }
  }

  async updateBombStats(
    serverId: number,
    eventType: "plant" | "defuse",
    options?: UpdateOptions,
  ): Promise<void> {
    try {
      const updates: Record<string, unknown> = {}

      if (eventType === "plant") {
        updates.bombs_planted = { increment: 1 }
      } else if (eventType === "defuse") {
        updates.bombs_defused = { increment: 1 }
      }

      await this.updateServerStats(serverId, updates, options)
    } catch (error) {
      this.handleError("updateBombStats", error)
    }
  }

  async resetMapStats(serverId: number, newMap: string, options?: UpdateOptions): Promise<void> {
    try {
      await this.updateServerStats(
        serverId,
        {
          act_map: newMap,
          map_changes: { increment: 1 },
          map_started: Math.floor(Date.now() / 1000),
          map_rounds: 0,
          map_ct_wins: 0,
          map_ts_wins: 0,
          map_ct_shots: 0,
          map_ct_hits: 0,
          map_ts_shots: 0,
          map_ts_hits: 0,
        },
        options,
      )
    } catch (error) {
      this.handleError("resetMapStats", error)
    }
  }
}
