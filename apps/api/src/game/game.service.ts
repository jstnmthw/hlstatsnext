import type { PrismaClient } from "@repo/database/client";
import type { GameStatistics } from "../types/database/game.types";
import { ACTIVITY_TIMEFRAMES } from "../types/database/game.types";
import type { Result, AppError } from "../types/common";
import { success, failure } from "../types";

/**
 * Service class for handling game-related business logic operations
 */
export class GameService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get game statistics summary - Complex business logic not suitable for schema resolvers
   */
  async getGameStats(
    gameId: string
  ): Promise<Result<GameStatistics, AppError>> {
    try {
      const game = await this.db.game.findUnique({
        where: { code: gameId },
      });

      if (!game) {
        return failure({
          type: "NOT_FOUND",
          message: "Game not found",
          resource: "game",
          id: gameId,
        });
      }

      const thirtyDaysAgo =
        Math.floor(Date.now() / 1000) - ACTIVITY_TIMEFRAMES.THIRTY_DAYS;

      const [totalPlayers, activePlayers, stats, topPlayers] =
        await Promise.all([
          // Total players
          this.db.player.count({
            where: { game: gameId },
          }),

          // Active players (last 30 days)
          this.db.player.count({
            where: {
              game: gameId,
              last_event: {
                gte: thirtyDaysAgo,
              },
            },
          }),

          // Aggregate statistics
          this.db.player.aggregate({
            where: { game: gameId },
            _sum: {
              kills: true,
              deaths: true,
            },
            _avg: {
              skill: true,
            },
          }),

          // Top 5 players
          this.db.player.findMany({
            where: {
              game: gameId,
              hideranking: 0,
            },
            include: {
              clanData: true,
              countryData: true,
            },
            orderBy: {
              skill: "desc",
            },
            take: 5,
          }),
        ]);

      const gameStatistics: GameStatistics = {
        totalPlayers,
        activePlayers,
        totalKills: stats._sum?.kills || 0,
        totalDeaths: stats._sum?.deaths || 0,
        averageSkill: Math.round(stats._avg?.skill || 1000),
        topPlayers,
      };

      return success(gameStatistics);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to calculate game statistics",
        operation: "getGameStats",
      });
    }
  }
}
