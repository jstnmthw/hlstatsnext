/**
 * Weapon Repository
 */

import { BaseRepository } from "@/shared/infrastructure/repository.base"
import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IWeaponRepository } from "./weapon.types"
import type { FindOptions, UpdateOptions } from "@/shared/types/database"
import type { Prisma } from "@repo/database/client"

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
              game: "cstrike",
              code: weaponCode,
            },
          },
          create: {
            code: weaponCode,
            game: "csgo",
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
              game: "cstrike",
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
