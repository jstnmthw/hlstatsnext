import type { PrismaClient, Rank, Prisma } from "@repo/database/client"
import { Result, success, failure, AppError } from "../types/common"
import { isRecordNotFoundError } from "../utils/prisma-error-handler"

export class RankService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get all ranks for a specific game
   */
  async getGameRanks(game: string): Promise<Result<Rank[], AppError>> {
    try {
      const ranks = await this.db.rank.findMany({
        where: { game },
        orderBy: { minKills: "asc" },
      })

      return success(ranks)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch game ranks",
        operation: "getGameRanks",
      })
    }
  }

  /**
   * Get a single rank by ID
   */
  async getRankById(rankId: number): Promise<Result<Rank, AppError>> {
    try {
      const rank = await this.db.rank.findUnique({
        where: { rankId },
      })

      if (!rank) {
        return failure({
          type: "NOT_FOUND",
          message: "Rank not found",
          resource: "rank",
          id: rankId.toString(),
        })
      }

      return success(rank)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch rank",
        operation: "getRankById",
      })
    }
  }

  /**
   * Get player rank based on kills
   */
  async getPlayerRank(game: string, kills: number): Promise<Result<Rank | null, AppError>> {
    try {
      const rank = await this.db.rank.findFirst({
        where: {
          game,
          minKills: { lte: kills },
          maxKills: { gte: kills },
        },
        orderBy: { minKills: "desc" },
      })

      return success(rank)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch player rank",
        operation: "getPlayerRank",
      })
    }
  }

  /**
   * Create a new rank
   */
  async createRank(input: Prisma.RankCreateInput): Promise<Result<Rank, AppError>> {
    try {
      const rank = await this.db.rank.create({
        data: input,
      })

      return success(rank)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to create rank",
        operation: "createRank",
      })
    }
  }

  /**
   * Update a rank
   */
  async updateRank(rankId: number, input: Prisma.RankUpdateInput): Promise<Result<Rank, AppError>> {
    try {
      const rank = await this.db.rank.update({
        where: { rankId },
        data: input,
      })

      return success(rank)
    } catch (error: unknown) {
      console.error(error)
      if (isRecordNotFoundError(error)) {
        return failure({
          type: "NOT_FOUND",
          message: "Rank not found",
          resource: "rank",
          id: rankId.toString(),
        })
      }

      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to update rank",
        operation: "updateRank",
      })
    }
  }

  /**
   * Delete a rank
   */
  async deleteRank(rankId: number): Promise<Result<boolean, AppError>> {
    try {
      await this.db.rank.delete({
        where: { rankId },
      })

      return success(true)
    } catch (error: unknown) {
      console.error(error)
      if (isRecordNotFoundError(error)) {
        return failure({
          type: "NOT_FOUND",
          message: "Rank not found",
          resource: "rank",
          id: rankId.toString(),
        })
      }

      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to delete rank",
        operation: "deleteRank",
      })
    }
  }
}
