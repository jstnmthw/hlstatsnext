/**
 * Player Repository
 *
 * Data access layer for player operations.
 */

import { BaseRepository } from "@/shared/infrastructure/repository.base"
import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger"
import type { IPlayerRepository, PlayerCreateData } from "./player.types"
import type { FindOptions, CreateOptions, UpdateOptions } from "@/shared/types/database"
import type { Player, Prisma } from "@repo/database/client"

export class PlayerRepository extends BaseRepository<Player> implements IPlayerRepository {
  protected tableName = "player"

  constructor(db: DatabaseClient, logger: ILogger) {
    super(db, logger)
  }

  async findById(playerId: number, options?: FindOptions): Promise<Player | null> {
    try {
      this.validateId(playerId, "findById")

      return await this.executeWithTransaction(async (client) => {
        const query: Prisma.PlayerFindUniqueArgs = { where: { playerId } }
        if (options?.include) {
          query.include = options.include as Prisma.PlayerInclude
        }
        if (options?.select) {
          query.select = options.select as Prisma.PlayerSelect
        }
        return client.player.findUnique(query)
      }, options)
    } catch (error) {
      this.handleError("findById", error)
    }
  }

  async findByUniqueId(
    uniqueId: string,
    game: string,
    options?: FindOptions,
  ): Promise<Player | null> {
    try {
      if (!uniqueId || !game) {
        throw new Error("uniqueId and game are required")
      }

      return await this.executeWithTransaction(async (client) => {
        const uniqueIdEntry = await client.playerUniqueId.findUnique({
          where: {
            uniqueId_game: {
              uniqueId,
              game,
            },
          },
          include: {
            player: true,
          },
        })

        return uniqueIdEntry?.player || null
      }, options)
    } catch (error) {
      this.handleError("findByUniqueId", error)
    }
  }

  async create(data: PlayerCreateData, options?: CreateOptions): Promise<Player> {
    try {
      if (!data.lastName || !data.game || !data.steamId) {
        throw new Error("lastName, game, and steamId are required")
      }

      return await this.executeWithTransaction(async (client) => {
        const player = await client.player.create({
          data: {
            lastName: data.lastName,
            game: data.game,
            skill: data.skill || 1000,
            uniqueIds: {
              create: {
                uniqueId: data.steamId,
                game: data.game,
              },
            },
          },
        })

        this.logger.debug(`Created player ${player.playerId} for ${data.steamId}`)
        return player
      }, options)
    } catch (error) {
      this.handleError("create", error)
    }
  }

  async update(playerId: number, data: Partial<Player>, options?: UpdateOptions): Promise<Player> {
    try {
      this.validateId(playerId, "update")
      const cleanData = this.cleanUpdateData(data)

      if (Object.keys(cleanData).length === 0) {
        throw new Error("No valid fields to update")
      }

      return await this.executeWithTransaction(async (client) => {
        // Try to update first, catch any errors and handle them appropriately
        try {
          // Handle skill underflow protection
          if (
            cleanData.skill !== undefined &&
            typeof cleanData.skill === "object" &&
            "increment" in cleanData.skill
          ) {
            try {
              return await client.player.update({
                where: { playerId },
                data: cleanData,
              })
            } catch (err: unknown) {
              // If skill underflowed on an UNSIGNED column, clamp to zero and retry
              if (
                typeof err === "object" &&
                err !== null &&
                (err as { code?: string; message?: string }).message?.includes("Out of range")
              ) {
                return await client.player.update({
                  where: { playerId },
                  data: { ...cleanData, skill: 0 },
                })
              }
              // If record not found, fall through to create logic
              if (
                typeof err === "object" &&
                err !== null &&
                (err as { message?: string }).message?.includes(
                  "record that were required but not found",
                )
              ) {
                throw err // Let the outer catch handle this
              }
              throw err
            }
          }

          return await client.player.update({
            where: { playerId },
            data: cleanData,
          })
        } catch (err: unknown) {
          // If record not found, convert increments to direct values and create the player
          if (
            typeof err === "object" &&
            err !== null &&
            (err as { message?: string }).message?.includes(
              "record that were required but not found",
            )
          ) {
            this.logger.warn(`Player ${playerId} not found, attempting to create with stats`)

            // Convert increment operations to direct values for creation
            const createData: Prisma.PlayerUncheckedCreateInput = {
              playerId,
              lastName: `Player${playerId}`,
              game: "cstrike",
              skill: 1000,
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

  async findTopPlayers(
    limit: number,
    game: string,
    includeHidden: boolean,
    options?: FindOptions,
  ): Promise<Player[]> {
    try {
      const whereClause: Record<string, unknown> = { game }

      if (!includeHidden) {
        whereClause.hideranking = 0
      }

      return await this.executeWithTransaction(async (client) => {
        const query: Prisma.PlayerFindManyArgs = {
          where: whereClause as Prisma.PlayerWhereInput,
          orderBy: { skill: "desc" },
          take: Math.min(limit, 100),
        }
        if (options?.include) {
          query.include = options.include as Prisma.PlayerInclude
        }
        if (options?.select) {
          query.select = options.select as Prisma.PlayerSelect
        }
        return client.player.findMany(query)
      }, options)
    } catch (error) {
      this.handleError("findTopPlayers", error)
    }
  }

  async findRoundParticipants(
    serverId: number,
    startTime: Date,
    options?: FindOptions,
  ): Promise<unknown[]> {
    try {
      this.validateId(serverId, "findRoundParticipants")

      return await this.executeWithTransaction(async (client) => {
        return client.eventEntry.findMany({
          where: {
            serverId,
            eventTime: {
              gte: startTime,
            },
          },
          select: {
            playerId: true,
            player: {
              select: {
                skill: true,
                teamkills: true,
                kills: true,
                deaths: true,
              },
            },
          },
        })
      }, options)
    } catch (error) {
      this.handleError("findRoundParticipants", error)
    }
  }

  async createUniqueId(
    playerId: number,
    uniqueId: string,
    game: string,
    options?: CreateOptions,
  ): Promise<void> {
    try {
      this.validateId(playerId, "createUniqueId")

      await this.executeWithTransaction(async (client) => {
        await client.playerUniqueId.create({
          data: {
            playerId,
            uniqueId,
            game,
          },
        })
      }, options)

      this.logger.debug(`Created unique ID entry for ${uniqueId} in game ${game}`)
    } catch (error) {
      this.handleError("createUniqueId", error)
    }
  }

  async findUniqueIdEntry(uniqueId: string, game: string, options?: FindOptions): Promise<unknown> {
    try {
      return await this.executeWithTransaction(async (client) => {
        return client.playerUniqueId.findUnique({
          where: {
            uniqueId_game: {
              uniqueId,
              game,
            },
          },
        })
      }, options)
    } catch (error) {
      this.handleError("findUniqueIdEntry", error)
    }
  }

  async createChatEvent(
    playerId: number,
    serverId: number,
    map: string,
    message: string,
    messageMode: number = 0,
    options?: CreateOptions,
  ): Promise<void> {
    try {
      this.validateId(playerId, "createChatEvent")
      this.validateId(serverId, "createChatEvent")

      await this.executeWithTransaction(async (client) => {
        await client.eventChat.create({
          data: {
            playerId,
            serverId,
            map,
            message,
            message_mode: messageMode,
            eventTime: new Date(),
          },
        })
      }, options)

      this.logger.debug(`Created chat event for player ${playerId} on server ${serverId}`)
    } catch (error) {
      this.handleError("createChatEvent", error)
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
            kill_streak: true,
            death_streak: true,
          },
        }) as Promise<Player | null>
      }, options)
    } catch (error) {
      this.handleError("getPlayerStats", error)
      return null
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
            map: map || '',
            killerId,
            victimId,
            weapon: weapon || '',
            headshot: headshot ? 1 : 0,
            killerRole: killerRole || '',
            victimRole: victimRole || '',
            pos_x: killerX || null,
            pos_y: killerY || null,
            pos_z: killerZ || null,
            pos_victim_x: victimX || null,
            pos_victim_y: victimY || null,
            pos_victim_z: victimZ || null,
          },
        })
      }, options)

      this.logger.debug(`Logged EventFrag: ${killerId} -> ${victimId} (${weapon}) on ${map}`)
    } catch (error) {
      this.handleError("logEventFrag", error)
    }
  }
}
