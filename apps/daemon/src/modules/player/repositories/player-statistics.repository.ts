/**
 * Player Statistics Repository
 *
 * Owns mutations and reads against the `player` table for stats
 * (kills/deaths/skill/streaks) plus event-frag logging.
 */

import { GameConfig } from "@/config/game.config"
import type { DatabaseClient } from "@/database/client"
import {
  BatchedRepository,
  type BatchCreateOperation,
  type BatchUpdateOperation,
} from "@/shared/infrastructure/data/batch-repository"
import type { CreateOptions, FindOptions, UpdateOptions } from "@/shared/types/database"
import type { ILogger } from "@/shared/utils/logger.types"
import type { Player, Prisma } from "@repo/db/client"

export class PlayerStatisticsRepository extends BatchedRepository<Player> {
  protected tableName = "player"

  constructor(db: DatabaseClient, logger: ILogger) {
    super(db, logger)
  }

  async update(playerId: number, data: Partial<Player>, options?: UpdateOptions): Promise<Player> {
    try {
      this.validateId(playerId, "update")
      const cleanData = this.cleanUpdateData(data)

      if (Object.keys(cleanData).length === 0) {
        throw new Error("No valid fields to update")
      }

      return await this.executeWithTransaction(async (client) => {
        try {
          // Skill is stored UNSIGNED in MariaDB; an increment that would push
          // the value below zero invalidates the adapter's transaction
          // connection. Pre-read and clamp at the application level instead.
          if (
            cleanData.skill !== undefined &&
            typeof cleanData.skill === "object" &&
            "increment" in cleanData.skill
          ) {
            const delta = (cleanData.skill as { increment: number }).increment
            const current = await client.player.findUnique({
              where: { playerId },
              select: { skill: true },
            })
            if (current != null) {
              const boundedSkill = Math.max(0, Number(current.skill ?? 0) + delta)
              return await client.player.update({
                where: { playerId },
                data: { ...cleanData, skill: boundedSkill },
              })
            }
          }

          return await client.player.update({
            where: { playerId },
            data: cleanData,
          })
        } catch (err: unknown) {
          if (
            typeof err === "object" &&
            err !== null &&
            (err as { message?: string }).message?.includes(
              "record that were required but not found",
            )
          ) {
            this.logger.warn(`Player ${playerId} not found, attempting to create with stats`)

            const createData: Prisma.PlayerUncheckedCreateInput = {
              playerId,
              lastName: `Player${playerId}`,
              game: GameConfig.getDefaultGame(),
              skill: 1000,
              createdAt: new Date(),
            }

            for (const [key, value] of Object.entries(cleanData)) {
              if (typeof value === "object" && value !== null && "increment" in value) {
                const incrementValue = (value as { increment: number }).increment
                ;(createData as Record<string, unknown>)[key] = Math.max(0, incrementValue)
              } else {
                ;(createData as Record<string, unknown>)[key] = value
              }
            }

            return await client.player.create({
              data: createData,
            })
          }
          throw err
        }
      }, options)
    } catch (error) {
      this.handleError("update", error)
    }
  }

  async getPlayerStats(playerId: number, options?: FindOptions): Promise<Player | null> {
    try {
      this.validateId(playerId, "getPlayerStats")

      return await this.executeWithTransaction(async (client) => {
        return client.player.findUnique({
          where: { playerId },
          select: {
            playerId: true,
            skill: true,
            kills: true,
            deaths: true,
            suicides: true,
            teamkills: true,
            headshots: true,
            killStreak: true,
            deathStreak: true,
          },
        }) as Promise<Player | null>
      }, options)
    } catch (error) {
      this.handleError("getPlayerStats", error)
    }
  }

  async logEventFrag(
    killerId: number,
    victimId: number,
    serverId: number,
    map: string,
    weapon: string,
    headshot: boolean,
    killerRole?: string,
    victimRole?: string,
    killerX?: number,
    killerY?: number,
    killerZ?: number,
    victimX?: number,
    victimY?: number,
    victimZ?: number,
    options?: CreateOptions,
  ): Promise<void> {
    try {
      this.validateId(killerId, "logEventFrag killer")
      this.validateId(victimId, "logEventFrag victim")
      this.validateId(serverId, "logEventFrag server")

      await this.executeWithTransaction(async (client) => {
        await client.eventFrag.create({
          data: {
            eventTime: new Date(),
            serverId,
            map: map || "",
            killerId,
            victimId,
            weapon: weapon || "",
            headshot: headshot ? 1 : 0,
            killerRole: killerRole || "",
            victimRole: victimRole || "",
            posX: killerX || null,
            posY: killerY || null,
            posZ: killerZ || null,
            posVictimX: victimX || null,
            posVictimY: victimY || null,
            posVictimZ: victimZ || null,
          },
        })
      }, options)

      this.logger.debug(`Logged EventFrag: ${killerId} →  ${victimId} (${weapon}) on ${map}`)
    } catch (error) {
      this.handleError("logEventFrag", error)
    }
  }

  async findManyById(ids: number[], options?: FindOptions): Promise<Map<number, Player>> {
    try {
      if (ids.length === 0) {
        return new Map()
      }

      const players = await this.executeWithTransaction(async (client) => {
        const query: Prisma.PlayerFindManyArgs = {
          where: { playerId: { in: ids } },
        }

        if (options?.include) {
          query.include = options.include as Prisma.PlayerInclude
        }
        if (options?.select) {
          query.select = options.select as Prisma.PlayerSelect
        }

        return client.player.findMany(query)
      }, options)

      const playerMap = new Map<number, Player>()
      for (const player of players || []) {
        playerMap.set(player.playerId, player)
      }

      this.logger.debug(`Batch found ${playerMap.size}/${ids.length} players`)
      return playerMap
    } catch (error) {
      this.logger.error(`Failed to batch find players: ${error}`)
      return new Map()
    }
  }

  async createMany(
    operations: BatchCreateOperation<Player>[],
    options?: CreateOptions,
  ): Promise<void> {
    try {
      if (operations.length === 0) {
        return
      }

      await this.executeBatchedOperation(operations, async (chunk) => {
        await this.executeWithTransaction(async (client) => {
          await client.player.createMany({
            data: chunk.map((op) => op.data),
            skipDuplicates: true,
          })
        }, options)
      })

      this.logger.debug(`Batch created ${operations.length} players`)
    } catch (error) {
      this.handleError("createMany", error)
    }
  }

  async updateMany(
    operations: BatchUpdateOperation<Player>[],
    options?: UpdateOptions,
  ): Promise<void> {
    try {
      if (operations.length === 0) {
        return
      }

      const groupedOperations = this.groupOperationsByKey(operations, (op) =>
        JSON.stringify(Object.keys(op.data).sort()),
      )

      for (const [, ops] of groupedOperations) {
        await this.executeBatchedOperation(ops, async (chunk) => {
          await this.executeWithTransaction(async (client) => {
            await Promise.all(
              chunk.map((op) =>
                client.player.update({
                  where: { playerId: op.id },
                  data: op.data,
                }),
              ),
            )
          }, options)
        })
      }

      this.logger.debug(`Batch updated ${operations.length} players`)
    } catch (error) {
      this.handleError("updateMany", error)
    }
  }

  async getPlayerStatsBatch(playerIds: number[]): Promise<Map<number, Player>> {
    return this.findManyById(playerIds, {
      select: {
        playerId: true,
        skill: true,
        lastName: true,
        game: true,
      },
    })
  }

  async updatePlayerStatsBatch(
    updates: Array<{ playerId: number; skillDelta: number }>,
  ): Promise<void> {
    if (updates.length === 0) return

    const skillGroups = updates.reduce((groups, update) => {
      const key = update.skillDelta.toString()
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(update.playerId)
      return groups
    }, new Map<string, number[]>())

    const updatePromises = Array.from(skillGroups.entries()).map(([skillDeltaStr, playerIds]) => {
      const skillDelta = parseInt(skillDeltaStr, 10)
      return this.db.prisma.player.updateMany({
        where: { playerId: { in: playerIds } },
        data: { skill: { increment: skillDelta } },
      })
    })

    await Promise.all(updatePromises)
  }
}
