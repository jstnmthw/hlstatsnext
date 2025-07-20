/**
 * Player Repository
 * 
 * Data access layer for player operations.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseRepository } from '@/shared/infrastructure/repository.base'
import type { DatabaseClient } from '@/database/client'
import type { ILogger } from '@/shared/utils/logger'
import type { 
  IPlayerRepository, 
  PlayerCreateData
} from './player.types'
import type { FindOptions, CreateOptions, UpdateOptions } from '@/shared/types/database'
import type { Player } from '@repo/database/client'

export class PlayerRepository extends BaseRepository<Player> implements IPlayerRepository {
  protected tableName = 'player'

  constructor(db: DatabaseClient, logger: ILogger) {
    super(db, logger)
  }

  async findById(playerId: number, options?: FindOptions): Promise<Player | null> {
    try {
      this.validateId(playerId, 'findById')
      
      return await this.executeWithTransaction(async (tx) => {
        const table = options?.transaction ? (tx as any).player : this.table
        return table.findUnique({
          where: { playerId },
          include: options?.include,
          select: options?.select,
        })
      }, options)
    } catch (error) {
      this.handleError('findById', error)
    }
  }

  async findByUniqueId(uniqueId: string, game: string, options?: FindOptions): Promise<Player | null> {
    try {
      if (!uniqueId || !game) {
        throw new Error('uniqueId and game are required')
      }
      
      return await this.executeWithTransaction(async (tx) => {
        const table = options?.transaction ? (tx as any).playerUniqueId : this.db.prisma.playerUniqueId
        const uniqueIdEntry = await table.findUnique({
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
      this.handleError('findByUniqueId', error)
    }
  }

  async create(data: PlayerCreateData, options?: CreateOptions): Promise<Player> {
    try {
      if (!data.lastName || !data.game || !data.steamId) {
        throw new Error('lastName, game, and steamId are required')
      }
      
      return await this.executeWithTransaction(async (tx) => {
        const table = options?.transaction ? (tx as any).player : this.table
        
        const player = await table.create({
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
      this.handleError('create', error)
    }
  }

  async update(playerId: number, data: Partial<Player>, options?: UpdateOptions): Promise<Player> {
    try {
      this.validateId(playerId, 'update')
      const cleanData = this.cleanUpdateData(data)
      
      if (Object.keys(cleanData).length === 0) {
        throw new Error('No valid fields to update')
      }
      
      return await this.executeWithTransaction(async (tx) => {
        const table = options?.transaction ? (tx as any).player : this.table
        
        // Handle skill underflow protection
        if (cleanData.skill !== undefined && typeof cleanData.skill === 'object' && 'increment' in cleanData.skill) {
          try {
            return await table.update({
              where: { playerId },
              data: cleanData,
            })
          } catch (err: unknown) {
            // If skill underflowed on an UNSIGNED column, clamp to zero and retry
            if (
              typeof err === 'object' &&
              err !== null &&
              (err as { code?: string; message?: string }).message?.includes('Out of range')
            ) {
              return await table.update({
                where: { playerId },
                data: { ...cleanData, skill: 0 },
              })
            }
            throw err
          }
        }
        
        return await table.update({
          where: { playerId },
          data: cleanData,
        })
      }, options)
    } catch (error) {
      this.handleError('update', error)
    }
  }

  async findTopPlayers(
    limit: number, 
    game: string, 
    includeHidden: boolean, 
    options?: FindOptions
  ): Promise<Player[]> {
    try {
      const whereClause: Record<string, unknown> = { game }
      
      if (!includeHidden) {
        whereClause.hideranking = 0
      }
      
      return await this.executeWithTransaction(async (tx) => {
        const table = options?.transaction ? (tx as any).player : this.table
        return table.findMany({
          where: whereClause,
          orderBy: { skill: 'desc' },
          take: Math.min(limit, 100),
          include: options?.include,
          select: options?.select,
        })
      }, options)
    } catch (error) {
      this.handleError('findTopPlayers', error)
    }
  }

  async findRoundParticipants(serverId: number, startTime: Date, options?: FindOptions): Promise<unknown[]> {
    try {
      this.validateId(serverId, 'findRoundParticipants')
      
      return await this.executeWithTransaction(async (tx) => {
        const table = options?.transaction ? (tx as any).eventEntry : this.db.prisma.eventEntry
        return table.findMany({
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
      this.handleError('findRoundParticipants', error)
    }
  }

  async createUniqueId(playerId: number, uniqueId: string, game: string, options?: CreateOptions): Promise<void> {
    try {
      this.validateId(playerId, 'createUniqueId')
      
      await this.executeWithTransaction(async (tx) => {
        const table = options?.transaction ? (tx as any).playerUniqueId : this.db.prisma.playerUniqueId
        await table.create({
          data: {
            playerId,
            uniqueId,
            game,
          },
        })
      }, options)
    } catch (error) {
      this.handleError('createUniqueId', error)
    }
  }

  async findUniqueIdEntry(uniqueId: string, game: string, options?: FindOptions): Promise<unknown> {
    try {
      return await this.executeWithTransaction(async (tx) => {
        const table = options?.transaction ? (tx as any).playerUniqueId : this.db.prisma.playerUniqueId
        return table.findUnique({
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
      }, options)
    } catch (error) {
      this.handleError('findUniqueIdEntry', error)
    }
  }
}