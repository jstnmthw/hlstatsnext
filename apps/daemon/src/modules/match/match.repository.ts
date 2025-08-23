/**
 * Match Repository
 *
 * Data access layer for match and server operations.
 */

import { BaseRepository } from "@/shared/infrastructure/persistence/repository.base"
import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IMatchRepository, ServerRecord, PlayerHistoryData } from "./match.types"
import type { UpdateOptions, CreateOptions, FindOptions } from "@/shared/types/database"
import type { Prisma } from "@repo/database/client"
import { GameConfig } from "@/config/game.config"

export class MatchRepository extends BaseRepository<ServerRecord> implements IMatchRepository {
  protected tableName = "server"

  constructor(db: DatabaseClient, logger: ILogger) {
    super(db, logger)
  }

  async getPlayerSkill(playerId: number): Promise<number | null> {
    try {
      this.validateId(playerId, "getPlayerSkill")
      return await this.executeWithTransaction(async (client) => {
        const row = await client.player.findUnique({
          where: { playerId },
          select: { skill: true },
        })
        return row?.skill ?? null
      })
    } catch (error) {
      this.handleError("getPlayerSkill", error)
    }
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
        // First check if the player exists
        const playerExists = await client.player.findUnique({
          where: { playerId: data.playerId },
          select: { playerId: true },
        })

        if (!playerExists) {
          this.logger.warn(
            `Player ${data.playerId} not found when creating player history, skipping (playerId: ${data.playerId})`,
          )
          return
        }

        try {
          const d = data.eventTime
          const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
          const game = data.game || GameConfig.getDefaultGame()

          // Try update first to aggregate increments for the same day
          const existing = await client.playerHistory.findUnique({
            where: {
              eventTime_playerId_game: {
                eventTime: day,
                playerId: data.playerId,
                game,
              },
            },
            select: { skill: true, skillChange: true, killStreak: true, deathStreak: true },
          })

          if (existing) {
            const currentSkill = typeof data.skill === "number" ? data.skill : existing.skill
            const delta = (typeof data.skill === "number" ? data.skill : 0) - existing.skill
            await client.playerHistory.update({
              where: {
                eventTime_playerId_game: {
                  eventTime: day,
                  playerId: data.playerId,
                  game,
                },
              },
              data: {
                // Aggregate per-day sums
                kills: { increment: data.kills || 0 },
                deaths: { increment: data.deaths || 0 },
                suicides: { increment: data.suicides || 0 },
                shots: { increment: data.shots || 0 },
                hits: { increment: data.hits || 0 },
                headshots: { increment: data.headshots || 0 },
                teamkills: { increment: data.teamkills || 0 },
                connectionTime: { increment: data.connectionTime || 0 },
                // Longest streaks for the day
                killStreak: Math.max(existing.killStreak ?? 0, data.killStreak || 0),
                deathStreak: Math.max(existing.deathStreak ?? 0, data.deathStreak || 0),
                // Skill values reflect end-of-day; keep latest snapshot and accumulate net change
                skill: currentSkill,
                skillChange: { increment: delta },
              },
            })
            this.logger.info(`PLAYER_HISTORY processed (Player ID: ${data.playerId})`, {
              playerId: data.playerId,
              eventDate: day.toISOString().slice(0, 10),
              game,
              aggregated: true,
            })
          } else {
            await client.playerHistory.create({
              data: {
                playerId: data.playerId,
                eventTime: day,
                game,
                kills: data.kills || 0,
                deaths: data.deaths || 0,
                suicides: data.suicides || 0,
                skill: data.skill || 0,
                shots: data.shots || 0,
                hits: data.hits || 0,
                headshots: data.headshots || 0,
                teamkills: data.teamkills || 0,
                connectionTime: data.connectionTime || 0,
                killStreak: data.killStreak || 0,
                deathStreak: data.deathStreak || 0,
                skillChange: data.skillChange || 0,
              },
            })
            this.logger.info(`PLAYER_HISTORY processed (Player ID: ${data.playerId})`, {
              playerId: data.playerId,
              eventDate: day.toISOString().slice(0, 10),
              game,
              aggregated: false,
            })
          }
        } catch (error) {
          this.handleError("createPlayerHistory", error)
        }
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

  async incrementServerRounds(serverId: number, options?: UpdateOptions): Promise<void> {
    try {
      await this.updateServerStats(
        serverId,
        {
          mapRounds: { increment: 1 },
          rounds: { increment: 1 },
          lastEvent: new Date(),
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
        updates.tsWins = { increment: 1 }
        updates.mapTsWins = { increment: 1 }
      } else if (winningTeam === "CT") {
        updates.ctWins = { increment: 1 }
        updates.mapCtWins = { increment: 1 }
      }

      if (Object.keys(updates).length > 0) {
        updates.lastEvent = new Date()
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
        updates.bombsPlanted = { increment: 1 }
      } else if (eventType === "defuse") {
        updates.bombsDefused = { increment: 1 }
      }

      await this.updateServerStats(serverId, { ...updates, lastEvent: new Date() }, options)
    } catch (error) {
      this.handleError("updateBombStats", error)
    }
  }

  async resetMapStats(
    serverId: number,
    newMap: string,
    playerCount?: number,
    options?: UpdateOptions,
  ): Promise<void> {
    try {
      await this.updateServerStats(
        serverId,
        {
          activeMap: newMap,
          mapChanges: { increment: 1 },
          mapStarted: Math.floor(Date.now() / 1000),
          mapRounds: 0,
          mapCtWins: 0,
          mapTsWins: 0,
          mapCtShots: 0,
          mapCtHits: 0,
          mapTsShots: 0,
          mapTsHits: 0,
          ...(typeof playerCount === "number" ? { players: playerCount } : {}),
          lastEvent: new Date(),
        },
        options,
      )
    } catch (error) {
      this.handleError("resetMapStats", error)
    }
  }

  async getLastKnownMap(serverId: number): Promise<string | null> {
    try {
      this.validateId(serverId, "getLastKnownMap")

      return await this.executeWithTransaction(async (client) => {
        // Check most recent EventFrag for a map (we populate this table)
        const eventFrag = await client.eventFrag.findFirst({
          where: {
            serverId,
            map: { not: "" },
          },
          orderBy: { eventTime: "desc" },
          select: { map: true },
        })

        return eventFrag?.map || null
      })
    } catch (error) {
      this.handleError("getLastKnownMap", error)
    }
  }
}
