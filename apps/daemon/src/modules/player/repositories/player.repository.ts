/**
 * Player Repository
 *
 * Data access layer for player operations.
 */

import { GameConfig } from "@/config/game.config"
import type { DatabaseClient } from "@/database/client"
import { PlayerNameUpdateBuilder } from "@/shared/application/utils/player-name-update.builder"
import {
  BatchedRepository,
  type BatchCreateOperation,
  type BatchUpdateOperation,
} from "@/shared/infrastructure/data/batch-repository"
import type { CreateOptions, FindOptions, UpdateOptions } from "@/shared/types/database"
import type { ILogger } from "@/shared/utils/logger.types"
import type { Player, Prisma } from "@repo/db/client"
import type {
  IPlayerRepository,
  PlayerCreateData,
  PlayerNameStatsUpdate,
  PlayerSessionStats,
} from "../types/player.types"

export class PlayerRepository extends BatchedRepository<Player> implements IPlayerRepository {
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
            createdAt: new Date(),
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

  async upsertPlayer(data: PlayerCreateData, options?: CreateOptions): Promise<Player> {
    try {
      if (!data.lastName || !data.game || !data.steamId) {
        throw new Error("lastName, game, and steamId are required")
      }

      return await this.executeWithTransaction(async (client) => {
        // Use standard Prisma upsert - race conditions now handled at service level
        const result = await client.playerUniqueId.upsert({
          where: {
            uniqueId_game: {
              uniqueId: data.steamId,
              game: data.game,
            },
          },
          update: {
            player: {
              update: {
                lastName: data.lastName,
              },
            },
          },
          create: {
            uniqueId: data.steamId,
            game: data.game,
            player: {
              create: {
                lastName: data.lastName,
                game: data.game,
                skill: data.skill || 1000,
                createdAt: new Date(),
              },
            },
          },
          include: {
            player: true,
          },
        })

        return result.player
      }, options)
    } catch (error) {
      this.handleError("upsertPlayer", error)
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
          // Handle skill underflow protection for UNSIGNED column.
          // Pre-read the current skill value and clamp at the application level
          // to avoid triggering a MariaDB "BIGINT UNSIGNED out of range" error,
          // which can invalidate the adapter's transaction connection.
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
            // Player not found — fall through to the normal update which will
            // throw P2025 and be caught by the outer handler below.
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
            messageMode: messageMode,
            eventTime: new Date(),
          },
        })
      }, options)

      this.logger.debug(`Created chat event for player ${playerId} on server ${serverId}`)
    } catch (error) {
      this.handleError("createChatEvent", error)
    }
  }

  async createChangeNameEvent(
    playerId: number,
    serverId: number,
    map: string,
    oldName: string,
    newName: string,
    options?: CreateOptions,
  ): Promise<void> {
    try {
      this.validateId(serverId, "createChangeNameEvent")
      await this.executeWithTransaction(async (client) => {
        await client.eventChangeName.create({
          data: {
            eventTime: new Date(),
            serverId,
            map: map || "",
            playerId: playerId > 0 ? playerId : 0,
            oldName,
            newName,
          },
        })
      }, options)
      this.logger.debug(`Created change-name event for player ${playerId} on server ${serverId}`)
    } catch (error) {
      this.handleError("createChangeNameEvent", error)
    }
  }

  async createChangeTeamEvent(
    playerId: number,
    serverId: number,
    map: string,
    team: string,
    options?: CreateOptions,
  ): Promise<void> {
    try {
      this.validateId(serverId, "createChangeTeamEvent")
      await this.executeWithTransaction(async (client) => {
        await client.eventChangeTeam.create({
          data: {
            eventTime: new Date(),
            serverId,
            map: map || "",
            playerId: playerId > 0 ? playerId : 0,
            team,
          },
        })
      }, options)
      this.logger.debug(`Created change-team event for player ${playerId} on server ${serverId}`)
    } catch (error) {
      this.handleError("createChangeTeamEvent", error)
    }
  }

  async createChangeRoleEvent(
    playerId: number,
    serverId: number,
    map: string,
    role: string,
    options?: CreateOptions,
  ): Promise<void> {
    try {
      this.validateId(serverId, "createChangeRoleEvent")
      await this.executeWithTransaction(async (client) => {
        await client.eventChangeRole.create({
          data: {
            eventTime: new Date(),
            serverId,
            map: map || "",
            playerId: playerId > 0 ? playerId : 0,
            role,
          },
        })
      }, options)
      this.logger.debug(`Created change-role event for player ${playerId} on server ${serverId}`)
    } catch (error) {
      this.handleError("createChangeRoleEvent", error)
    }
  }

  async createSuicideEvent(
    playerId: number,
    serverId: number,
    map: string,
    weapon?: string,
    options?: CreateOptions,
  ): Promise<void> {
    try {
      this.validateId(serverId, "createSuicideEvent")
      await this.executeWithTransaction(async (client) => {
        await client.eventSuicide.create({
          data: {
            eventTime: new Date(),
            serverId,
            map: map || "",
            playerId: playerId > 0 ? playerId : 0,
            weapon: weapon || "",
          },
        })
      }, options)
      this.logger.debug(`Created suicide event for player ${playerId} on server ${serverId}`)
    } catch (error) {
      this.handleError("createSuicideEvent", error)
    }
  }

  async createTeamkillEvent(
    killerId: number,
    victimId: number,
    serverId: number,
    map: string,
    weapon: string,
    options?: CreateOptions,
  ): Promise<void> {
    try {
      this.validateId(serverId, "createTeamkillEvent")
      await this.executeWithTransaction(async (client) => {
        await client.eventTeamkill.create({
          data: {
            eventTime: new Date(),
            serverId,
            map: map || "",
            killerId: killerId > 0 ? killerId : 0,
            victimId: victimId > 0 ? victimId : 0,
            weapon: weapon || "",
          },
        })
      }, options)
      this.logger.debug(
        `Created teamkill event: ${killerId} → ${victimId} (${weapon}) on server ${serverId}`,
      )
    } catch (error) {
      this.handleError("createTeamkillEvent", error)
    }
  }

  async createEntryEvent(
    playerId: number,
    serverId: number,
    map: string,
    options?: CreateOptions,
  ): Promise<void> {
    try {
      this.validateId(serverId, "createEntryEvent")

      await this.executeWithTransaction(async (client) => {
        await client.eventEntry.create({
          data: {
            eventTime: new Date(),
            serverId,
            map: map || "",
            playerId: playerId > 0 ? playerId : 0,
          },
        })
      }, options)

      this.logger.debug(`Created entry event for player ${playerId} on server ${serverId}`)
    } catch (error) {
      this.handleError("createEntryEvent", error)
    }
  }

  async createConnectEvent(
    playerId: number,
    serverId: number,
    map: string,
    ipAddress: string,
    options?: CreateOptions,
  ): Promise<void> {
    try {
      this.validateId(serverId, "createConnectEvent")

      await this.executeWithTransaction(async (client) => {
        await client.eventConnect.create({
          data: {
            eventTime: new Date(),
            serverId,
            map: map || "",
            playerId: playerId > 0 ? playerId : 0,
            ipAddress: ipAddress || "",
            hostname: "",
            hostgroup: "",
          },
        })
      }, options)

      this.logger.debug(`Created connect event for player ${playerId} on server ${serverId}`)
    } catch (error) {
      this.handleError("createConnectEvent", error)
    }
  }

  async createDisconnectEvent(
    playerId: number,
    serverId: number,
    map: string,
    options?: CreateOptions,
  ): Promise<void> {
    try {
      this.validateId(serverId, "createDisconnectEvent")

      await this.executeWithTransaction(async (client) => {
        await client.eventDisconnect
          .create({
            data: {
              eventTime: new Date(),
              serverId,
              map: map || "",
              playerId: playerId > 0 ? playerId : 0,
            },
          })
          .catch((error) => {
            this.logger.warn(
              `Failed to create disconnect event for player ${playerId} on server ${serverId}`,
              error,
            )
          })

        // Best-effort: also backfill disconnect time on the most recent connect row
        try {
          if (playerId > 0) {
            const lastConnect = await client.eventConnect.findFirst({
              where: { serverId, playerId },
              orderBy: { id: "desc" },
              select: { id: true },
            })
            if (lastConnect) {
              await client.eventConnect.update({
                where: { id: lastConnect.id },
                data: { eventTimeDisconnect: new Date() },
              })
            }
          }
        } catch {
          this.logger.warn(
            `Failed to backfill disconnect time for player ${playerId} on server ${serverId}`,
          )
        }
      }, options)

      this.logger.debug(`Created disconnect event for player ${playerId} on server ${serverId}`)
    } catch (error) {
      this.handleError("createDisconnectEvent", error)
    }
  }

  async hasRecentConnect(
    serverId: number,
    playerId: number,
    withinMs: number = 2 * 60 * 1000,
    options?: FindOptions,
  ): Promise<boolean> {
    try {
      this.validateId(serverId, "hasRecentConnect")
      if (playerId <= 0) return false

      return await this.executeWithTransaction(async (client) => {
        const row = await client.eventConnect.findFirst({
          where: { serverId, playerId },
          orderBy: { id: "desc" },
          select: { eventTime: true },
        })
        if (!row || !row.eventTime) return false
        const diff = Date.now() - row.eventTime.getTime()
        return diff >= 0 && diff <= withinMs
      }, options)
    } catch (error) {
      this.handleError("hasRecentConnect", error)
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

  async updateServerForPlayerEvent(
    serverId: number,
    updates: Record<string, unknown>,
    options?: UpdateOptions,
  ): Promise<void> {
    try {
      this.validateId(serverId, "updateServerForPlayerEvent")

      await this.executeWithTransaction(async (client) => {
        await client.server.update({
          where: { serverId },
          data: updates,
        })
      }, options)

      this.logger.debug(`Updated server ${serverId} for player event`)
    } catch (error) {
      this.handleError("updateServerForPlayerEvent", error)
    }
  }

  async upsertPlayerName(
    playerId: number,
    name: string,
    updates: PlayerNameStatsUpdate,
    options?: UpdateOptions,
  ): Promise<void> {
    try {
      this.validateId(playerId, "upsertPlayerName")
      if (!name || name.trim().length === 0) {
        throw new Error("name is required for upsertPlayerName")
      }

      // Use PlayerNameUpdateBuilder to build the update data
      const builder = PlayerNameUpdateBuilder.create()

      // Add all updates to the builder
      if (updates.numUses) builder.addUsage(updates.numUses)
      if (updates.connectionTime) builder.addConnectionTime(updates.connectionTime)
      if (updates.kills) builder.addKills(updates.kills)
      if (updates.deaths) builder.addDeaths(updates.deaths)
      if (updates.suicides) builder.addSuicides(updates.suicides)
      if (updates.shots) builder.addShots(updates.shots)
      if (updates.hits) builder.addHits(updates.hits)
      if (updates.headshots) builder.addHeadshots(updates.headshots)
      if (updates.lastUse) builder.updateLastUse(updates.lastUse)

      // Build the data for Prisma upsert
      const { incrementData, directData } = builder.buildForPrismaUpsert()
      const createData = builder.buildForCreate(playerId, name)

      await this.executeWithTransaction(async (client) => {
        await client.playerName.upsert({
          where: {
            playerId_name: {
              playerId,
              name,
            },
          },
          create: createData,
          update: {
            ...incrementData,
            ...directData,
          },
        })
      }, options)

      this.logger.debug(
        `Upserted PlayerName for player ${playerId} name "${name}" with updates ${JSON.stringify(
          updates,
        )}`,
      )
    } catch (error) {
      this.handleError("upsertPlayerName", error)
    }
  }

  // Batch operations implementation required by BatchedRepository

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

      // Convert to Map for O(1) lookups
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

      // Group operations by the fields being updated for optimization
      const groupedOperations = this.groupOperationsByKey(operations, (op) =>
        JSON.stringify(Object.keys(op.data).sort()),
      )

      for (const [, ops] of groupedOperations) {
        await this.executeBatchedOperation(ops, async (chunk) => {
          await this.executeWithTransaction(async (client) => {
            // For each chunk, perform individual updates
            // Note: Prisma doesn't support batch updates with different data per record
            // so we use Promise.all for concurrent execution
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

  /**
   * Batch method to get player stats for multiple player IDs
   * Optimized for ActionService to prevent N+1 queries
   */
  async getPlayerStatsBatch(playerIds: number[]): Promise<Map<number, Player>> {
    return this.findManyById(playerIds, {
      select: {
        playerId: true,
        skill: true,
        lastName: true,
        game: true,
        // Add other fields as needed by ActionService
      },
    })
  }

  /**
   * Batch method to update player stats for multiple players
   * Optimized for team bonus operations
   */
  async updatePlayerStatsBatch(
    updates: Array<{ playerId: number; skillDelta: number }>,
  ): Promise<void> {
    if (updates.length === 0) return

    // Group updates by skill delta for efficient batch processing
    const skillGroups = updates.reduce((groups, update) => {
      const key = update.skillDelta.toString()
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(update.playerId)
      return groups
    }, new Map<string, number[]>())

    // Execute batch updates for each skill delta group
    const updatePromises = Array.from(skillGroups.entries()).map(([skillDeltaStr, playerIds]) => {
      const skillDelta = parseInt(skillDeltaStr, 10)
      return this.db.prisma.player.updateMany({
        where: { playerId: { in: playerIds } },
        data: { skill: { increment: skillDelta } },
      })
    })

    await Promise.all(updatePromises)
  }

  /**
   * Get player's rank position
   */
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

      // Count players with higher skill rating
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
      throw error
    }
  }

  /**
   * Get total number of players
   */
  async getTotalPlayerCount(): Promise<number> {
    try {
      return await this.db.prisma.player.count()
    } catch (error) {
      this.handleError("getTotalPlayerCount", error)
      throw error
    }
  }

  /**
   * Get player's current session statistics
   */
  async getPlayerSessionStats(playerId: number): Promise<PlayerSessionStats | null> {
    try {
      this.validateId(playerId, "getPlayerSessionStats")

      // Get the most recent connect event for this player
      const lastConnect = await this.db.prisma.eventConnect.findFirst({
        where: { playerId },
        orderBy: { eventTime: "desc" },
        select: { eventTime: true },
      })

      if (!lastConnect || !lastConnect.eventTime) {
        // If no connect event found, return null to indicate no session data
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

      // Calculate actual session time from connect event to now
      const sessionTime = Math.floor((Date.now() - sessionStart.getTime()) / 1000)

      return {
        kills,
        deaths,
        sessionTime,
      }
    } catch (error) {
      this.handleError("getPlayerSessionStats", error)
      throw error
    }
  }
}
