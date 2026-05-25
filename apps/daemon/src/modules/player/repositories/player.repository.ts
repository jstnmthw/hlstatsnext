/**
 * Player Repository
 *
 * Thin façade over the player sub-repositories. Owns CRUD on the `player`
 * table plus the various event-table writes (chat, change-name, suicide,
 * teamkill, connect/disconnect, etc.) that don't belong to a more focused
 * sub-repo. Stat mutations, alias bookkeeping, and rank queries are
 * delegated to the corresponding sub-repository.
 */

import type { DatabaseClient } from "@/database/client"
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
import { PlayerNameRepository } from "./player-name.repository"
import { PlayerRankRepository } from "./player-rank.repository"
import { PlayerStatisticsRepository } from "./player-statistics.repository"

export class PlayerRepository extends BatchedRepository<Player> implements IPlayerRepository {
  protected tableName = "player"

  private readonly statistics: PlayerStatisticsRepository
  private readonly names: PlayerNameRepository
  private readonly ranks: PlayerRankRepository

  constructor(db: DatabaseClient, logger: ILogger) {
    super(db, logger)
    this.statistics = new PlayerStatisticsRepository(db, logger)
    this.names = new PlayerNameRepository(db, logger)
    this.ranks = new PlayerRankRepository(db, logger)
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

  update(playerId: number, data: Partial<Player>, options?: UpdateOptions): Promise<Player> {
    return this.statistics.update(playerId, data, options)
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

  getPlayerStats(playerId: number, options?: FindOptions): Promise<Player | null> {
    return this.statistics.getPlayerStats(playerId, options)
  }

  logEventFrag(
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
    return this.statistics.logEventFrag(
      killerId,
      victimId,
      serverId,
      map,
      weapon,
      headshot,
      killerRole,
      victimRole,
      killerX,
      killerY,
      killerZ,
      victimX,
      victimY,
      victimZ,
      options,
    )
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

  upsertPlayerName(
    playerId: number,
    name: string,
    updates: PlayerNameStatsUpdate,
    options?: UpdateOptions,
  ): Promise<void> {
    return this.names.upsertPlayerName(playerId, name, updates, options)
  }

  findManyById(ids: number[], options?: FindOptions): Promise<Map<number, Player>> {
    return this.statistics.findManyById(ids, options)
  }

  createMany(operations: BatchCreateOperation<Player>[], options?: CreateOptions): Promise<void> {
    return this.statistics.createMany(operations, options)
  }

  updateMany(operations: BatchUpdateOperation<Player>[], options?: UpdateOptions): Promise<void> {
    return this.statistics.updateMany(operations, options)
  }

  getPlayerStatsBatch(playerIds: number[]): Promise<Map<number, Player>> {
    return this.statistics.getPlayerStatsBatch(playerIds)
  }

  updatePlayerStatsBatch(updates: Array<{ playerId: number; skillDelta: number }>): Promise<void> {
    return this.statistics.updatePlayerStatsBatch(updates)
  }

  getPlayerRank(playerId: number): Promise<number | null> {
    return this.ranks.getPlayerRank(playerId)
  }

  getTotalPlayerCount(): Promise<number> {
    return this.ranks.getTotalPlayerCount()
  }

  getPlayerSessionStats(playerId: number): Promise<PlayerSessionStats | null> {
    return this.ranks.getPlayerSessionStats(playerId)
  }
}
