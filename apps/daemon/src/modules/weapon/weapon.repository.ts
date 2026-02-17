/**
 * Weapon Repository
 */

import { GameConfig } from "@/config/game.config"
import type { DatabaseClient } from "@/database/client"
import { BaseRepository } from "@/shared/infrastructure/persistence/repository.base"
import type { FindOptions, UpdateOptions } from "@/shared/types/database"
import type { ILogger } from "@/shared/utils/logger.types"
import type { Prisma } from "@repo/db/client"
import type { IWeaponRepository } from "./weapon.types"

export class WeaponRepository
  extends BaseRepository<Record<string, unknown>>
  implements IWeaponRepository
{
  protected tableName = "weapon"

  constructor(db: DatabaseClient, logger: ILogger) {
    super(db, logger)
  }

  async updateWeaponStats(
    weaponCode: string,
    updates: Record<string, unknown>,
    options?: UpdateOptions,
  ): Promise<void> {
    try {
      await this.executeWithTransaction(async (client) => {
        await client.weapon.upsert({
          where: {
            gamecode: {
              game: GameConfig.getDefaultGame(),
              code: weaponCode,
            },
          },
          create: {
            code: weaponCode,
            game: GameConfig.getDefaultGame(),
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
      this.handleError("updateWeaponStats", error)
    }
  }

  async findWeaponByCode(weaponCode: string, options?: FindOptions): Promise<unknown> {
    try {
      return await this.executeWithTransaction(async (client) => {
        const query: Prisma.WeaponFindUniqueArgs = {
          where: {
            gamecode: {
              game: GameConfig.getDefaultGame(),
              code: weaponCode,
            },
          },
          ...(options?.include ? { include: options.include } : {}),
          ...(options?.select ? { select: options.select } : {}),
        } as const
        return client.weapon.findUnique(query)
      }, options)
    } catch (error) {
      this.handleError("findWeaponByCode", error)
    }
  }
}
