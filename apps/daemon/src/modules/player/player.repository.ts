/**
 * Player Repository
 *
 * Data access layer for player operations.
 */

import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository, PlayerCreateData, PlayerNameStatsUpdate } from "./player.types"
import type { FindOptions, CreateOptions, UpdateOptions } from "@/shared/types/database"
import type { Player, Prisma } from "@repo/database/client"
import { BaseRepository } from "@/shared/infrastructure/persistence/repository.base"
import { GameConfig } from "@/config/game.config"

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
        `Created teamkill event: ${killerId} -> ${victimId} (${weapon}) on server ${serverId}`,
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
        // Insert a row to events_disconnect for immediate visibility (skip invalid playerId)
        if (playerId > 0) {
          await client.eventDisconnect.create({
            data: {
              eventTime: new Date(),
              serverId,
              map: map || "",
              playerId,
            },
          })
        }

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
          // ignore enrichment failure
        }
      }, options)

      this.logger.debug(`Created disconnect event for player ${playerId} on server ${serverId}`)
    } catch (error) {
      this.handleError("createDisconnectEvent", error)
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

      this.logger.debug(`Logged EventFrag: ${killerId} → ${victimId} (${weapon}) on ${map}`)
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

      // Build Prisma update increments from partial updates
      const incrementData: Record<string, unknown> = {}
      if (updates.numUses) incrementData.numUses = { increment: updates.numUses }
      if (updates.connectionTime)
        incrementData.connectionTime = { increment: updates.connectionTime }
      if (updates.kills) incrementData.kills = { increment: updates.kills }
      if (updates.deaths) incrementData.deaths = { increment: updates.deaths }
      if (updates.suicides) incrementData.suicides = { increment: updates.suicides }
      if (updates.shots) incrementData.shots = { increment: updates.shots }
      if (updates.hits) incrementData.hits = { increment: updates.hits }
      if (updates.headshots) incrementData.headshots = { increment: updates.headshots }

      const lastUseUpdate = updates.lastUse ? { lastUse: updates.lastUse } : {}

      await this.executeWithTransaction(async (client) => {
        await client.playerName.upsert({
          where: {
            playerId_name: {
              playerId,
              name,
            },
          },
          create: {
            playerId,
            name,
            lastUse: updates.lastUse ?? new Date(),
            numUses: updates.numUses ?? 0,
            connectionTime: updates.connectionTime ?? 0,
            kills: updates.kills ?? 0,
            deaths: updates.deaths ?? 0,
            suicides: updates.suicides ?? 0,
            headshots: updates.headshots ?? 0,
            shots: updates.shots ?? 0,
            hits: updates.hits ?? 0,
          },
          update: {
            ...incrementData,
            ...lastUseUpdate,
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
}
