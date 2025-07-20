/**
 * Weapon Repository
 */

import { BaseRepository } from '@/shared/infrastructure/repository.base'
import type { DatabaseClient } from '@/database/client'
import type { ILogger } from '@/shared/utils/logger'
import type { IWeaponRepository } from './weapon.types'
import type { FindOptions, UpdateOptions } from '@/shared/types/database'

export class WeaponRepository extends BaseRepository<Record<string, unknown>> implements IWeaponRepository {
  protected tableName = 'weapon'

  constructor(db: DatabaseClient, logger: ILogger) {
    super(db, logger)
  }

  async updateWeaponStats(weaponCode: string, updates: Record<string, unknown>, options?: UpdateOptions): Promise<void> {
    try {
      await this.executeWithTransaction(async (tx) => {
        const table = options?.transaction ? tx.weapon : this.table
        await table.upsert({
          where: { code: weaponCode },
          create: {
            code: weaponCode,
            game: 'csgo',
            name: weaponCode,
            modifier: 1,
            kills: 0,
            headshots: 0,
            ...updates,
          },
          update: updates,
        })
      }, options)
    } catch (error) {
      this.handleError('updateWeaponStats', error)
    }
  }

  async findWeaponByCode(weaponCode: string, options?: FindOptions): Promise<unknown> {
    try {
      return await this.executeWithTransaction(async (tx) => {
        const table = options?.transaction ? tx.weapon : this.table
        return table.findUnique({
          where: { code: weaponCode },
          include: options?.include,
          select: options?.select,
        })
      }, options)
    } catch (error) {
      this.handleError('findWeaponByCode', error)
    }
  }
}