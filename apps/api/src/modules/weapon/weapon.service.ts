import type { PrismaClient, Weapon, Prisma } from "@repo/database/client"
import { Result, success, failure, AppError, PaginatedResult } from "../types/common"
import { isRecordNotFoundError } from "../shared/utils/prisma-error-handler"

export class WeaponService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get all weapons with optional filtering
   */
  async getWeapons(params: {
    game?: string
    page?: number
    limit?: number
  }): Promise<Result<PaginatedResult<Weapon>, AppError>> {
    try {
      const { game, page = 1, limit = 20 } = params
      const skip = (page - 1) * limit

      const where: Prisma.WeaponWhereInput = {
        ...(game && { game }),
      }

      const [weapons, total] = await Promise.all([
        this.db.weapon.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: "asc" },
        }),
        this.db.weapon.count({ where }),
      ])

      const totalPages = Math.ceil(total / limit)

      return success({
        items: weapons,
        total,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      })
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch weapons",
        operation: "getWeapons",
      })
    }
  }

  /**
   * Get a single weapon by ID
   */
  async getWeaponById(weaponId: number): Promise<Result<Weapon, AppError>> {
    try {
      const weapon = await this.db.weapon.findUnique({
        where: { weaponId },
      })

      if (!weapon) {
        return failure({
          type: "NOT_FOUND",
          message: "Weapon not found",
          resource: "weapon",
          id: weaponId.toString(),
        })
      }

      return success(weapon)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch weapon",
        operation: "getWeaponById",
      })
    }
  }

  /**
   * Get weapons for a specific game
   */
  async getGameWeapons(game: string): Promise<Result<Weapon[], AppError>> {
    try {
      const weapons = await this.db.weapon.findMany({
        where: { game },
        orderBy: { name: "asc" },
      })

      return success(weapons)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch game weapons",
        operation: "getGameWeapons",
      })
    }
  }

  /**
   * Get weapon statistics (top weapons by kills)
   */
  async getWeaponStatistics(params: { game?: string; limit?: number }): Promise<Result<Weapon[], AppError>> {
    try {
      const { game, limit = 10 } = params

      const where: Prisma.WeaponWhereInput = {
        ...(game && { game }),
      }

      const weapons = await this.db.weapon.findMany({
        where,
        orderBy: { kills: "desc" },
        take: limit,
      })

      return success(weapons)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch weapon statistics",
        operation: "getWeaponStatistics",
      })
    }
  }

  /**
   * Create a new weapon
   */
  async createWeapon(input: Prisma.WeaponCreateInput): Promise<Result<Weapon, AppError>> {
    try {
      const weapon = await this.db.weapon.create({
        data: input,
      })

      return success(weapon)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to create weapon",
        operation: "createWeapon",
      })
    }
  }

  /**
   * Update a weapon
   */
  async updateWeapon(weaponId: number, input: Prisma.WeaponUpdateInput): Promise<Result<Weapon, AppError>> {
    try {
      const weapon = await this.db.weapon.update({
        where: { weaponId },
        data: input,
      })

      return success(weapon)
    } catch (error: unknown) {
      console.error(error)
      if (isRecordNotFoundError(error)) {
        return failure({
          type: "NOT_FOUND",
          message: "Weapon not found",
          resource: "weapon",
          id: weaponId.toString(),
        })
      }

      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to update weapon",
        operation: "updateWeapon",
      })
    }
  }

  /**
   * Delete a weapon
   */
  async deleteWeapon(weaponId: number): Promise<Result<boolean, AppError>> {
    try {
      await this.db.weapon.delete({
        where: { weaponId },
      })

      return success(true)
    } catch (error: unknown) {
      console.error(error)
      if (isRecordNotFoundError(error)) {
        return failure({
          type: "NOT_FOUND",
          message: "Weapon not found",
          resource: "weapon",
          id: weaponId.toString(),
        })
      }

      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to delete weapon",
        operation: "deleteWeapon",
      })
    }
  }
}
