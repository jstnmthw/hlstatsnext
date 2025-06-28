import type { PrismaClient, Award, Prisma } from "@repo/database/client"
import { Result, success, failure, AppError, PaginatedResult } from "../types/common"
import { isRecordNotFoundError } from "../utils/prisma-error-handler"

export class AwardService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get all awards with optional filtering
   */
  async getAwards(params: {
    game?: string
    awardType?: string
    page?: number
    limit?: number
  }): Promise<Result<PaginatedResult<Award>, AppError>> {
    try {
      const { game, awardType, page = 1, limit = 20 } = params
      const skip = (page - 1) * limit

      const where: Prisma.AwardWhereInput = {
        ...(game && { game }),
        ...(awardType && { awardType }),
      }

      const [awards, total] = await Promise.all([
        this.db.award.findMany({
          where,
          skip,
          take: limit,
          include: {
            d_winner: true,
            g_winner: true,
          },
          orderBy: { name: "asc" },
        }),
        this.db.award.count({ where }),
      ])

      const totalPages = Math.ceil(total / limit)

      return success({
        items: awards,
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
        message: "Failed to fetch awards",
        operation: "getAwards",
      })
    }
  }

  /**
   * Get a single award by ID
   */
  async getAwardById(awardId: number): Promise<Result<Award, AppError>> {
    try {
      const award = await this.db.award.findUnique({
        where: { awardId },
        include: {
          d_winner: true,
          g_winner: true,
          playerAwards: {
            include: {
              player: true,
            },
            orderBy: {
              count: "desc",
            },
            take: 10,
          },
        },
      })

      if (!award) {
        return failure({
          type: "NOT_FOUND",
          message: "Award not found",
          resource: "award",
          id: awardId.toString(),
        })
      }

      return success(award)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch award",
        operation: "getAwardById",
      })
    }
  }

  /**
   * Get awards for a specific game
   */
  async getGameAwards(game: string): Promise<Result<Award[], AppError>> {
    try {
      const awards = await this.db.award.findMany({
        where: { game },
        include: {
          d_winner: true,
          g_winner: true,
        },
        orderBy: { name: "asc" },
      })

      return success(awards)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch game awards",
        operation: "getGameAwards",
      })
    }
  }

  /**
   * Create a new award
   */
  async createAward(input: Prisma.AwardCreateInput): Promise<Result<Award, AppError>> {
    try {
      const award = await this.db.award.create({
        data: input,
        include: {
          d_winner: true,
          g_winner: true,
        },
      })

      return success(award)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to create award",
        operation: "createAward",
      })
    }
  }

  /**
   * Update an award
   */
  async updateAward(awardId: number, input: Prisma.AwardUpdateInput): Promise<Result<Award, AppError>> {
    try {
      const award = await this.db.award.update({
        where: { awardId },
        data: input,
        include: {
          d_winner: true,
          g_winner: true,
        },
      })

      return success(award)
    } catch (error: unknown) {
      console.error(error)
      if (isRecordNotFoundError(error)) {
        return failure({
          type: "NOT_FOUND",
          message: "Award not found",
          resource: "award",
          id: awardId.toString(),
        })
      }

      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to update award",
        operation: "updateAward",
      })
    }
  }

  /**
   * Delete an award
   */
  async deleteAward(awardId: number): Promise<Result<boolean, AppError>> {
    try {
      await this.db.award.delete({
        where: { awardId },
      })

      return success(true)
    } catch (error) {
      console.error(error)
      if (isRecordNotFoundError(error)) {
        return failure({
          type: "NOT_FOUND",
          message: "Award not found",
          resource: "award",
          id: awardId.toString(),
        })
      }

      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to delete award",
        operation: "deleteAward",
      })
    }
  }
}
