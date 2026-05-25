/**
 * Player Rank Repository
 *
 * Read-only queries for player rank position, total counts, and
 * per-session stats derived from event tables.
 */

import type { DatabaseClient } from "@/database/client"
import { BaseRepository } from "@/shared/infrastructure/persistence/repository.base"
import type { ILogger } from "@/shared/utils/logger.types"
import type { Player } from "@repo/db/client"
import type { PlayerSessionStats } from "../types/player.types"

export class PlayerRankRepository extends BaseRepository<Player> {
  protected tableName = "player"

  constructor(db: DatabaseClient, logger: ILogger) {
    super(db, logger)
  }

  async getPlayerRank(playerId: number): Promise<number | null> {
    try {
      this.validateId(playerId, "getPlayerRank")

      const player = await this.db.prisma.player.findUnique({
        where: { playerId },
        select: { skill: true },
      })

      if (!player) {
        return null
      }

      const higherSkillPlayers = await this.db.prisma.player.count({
        where: {
          skill: {
            gt: player.skill,
          },
        },
      })

      return higherSkillPlayers + 1
    } catch (error) {
      this.handleError("getPlayerRank", error)
    }
  }

  async getTotalPlayerCount(): Promise<number> {
    try {
      return await this.db.prisma.player.count()
    } catch (error) {
      this.handleError("getTotalPlayerCount", error)
    }
  }

  async getPlayerSessionStats(playerId: number): Promise<PlayerSessionStats | null> {
    try {
      this.validateId(playerId, "getPlayerSessionStats")

      const lastConnect = await this.db.prisma.eventConnect.findFirst({
        where: { playerId },
        orderBy: { eventTime: "desc" },
        select: { eventTime: true },
      })

      if (!lastConnect || !lastConnect.eventTime) {
        return null
      }

      const sessionStart = lastConnect.eventTime

      const kills = await this.db.prisma.eventFrag.count({
        where: {
          killerId: playerId,
          eventTime: {
            gte: sessionStart,
          },
        },
      })

      const deaths = await this.db.prisma.eventFrag.count({
        where: {
          victimId: playerId,
          eventTime: {
            gte: sessionStart,
          },
        },
      })

      const sessionTime = Math.floor((Date.now() - sessionStart.getTime()) / 1000)

      return {
        kills,
        deaths,
        sessionTime,
      }
    } catch (error) {
      this.handleError("getPlayerSessionStats", error)
    }
  }
}
