import type { PrismaClient } from "@repo/database/client";
import type {
  GameWithStats,
  GameStatistics,
} from "../types/database/game.types";
import {
  GAME_INCLUDE,
  ACTIVITY_TIMEFRAMES,
} from "../types/database/game.types";
import type { Result, AppError } from "../types/common";
import { success, failure } from "../types";

/**
 * Service class for handling game-related operations
 */
export class GameService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get all games with player and clan counts
   */
  async getGames(
    includeHidden: boolean = false,
  ): Promise<Result<readonly GameWithStats[], AppError>> {
    try {
      const games = await this.db.game.findMany({
        where: includeHidden ? {} : { hidden: "0" },
        include: GAME_INCLUDE,
        orderBy: {
          name: "asc",
        },
      });

      return success(games);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch games",
        operation: "getGames",
      });
    }
  }

  /**
   * Get a single game by ID
   */
  async getGame(id: string): Promise<Result<GameWithStats | null, AppError>> {
    try {
      const game = await this.db.game.findUnique({
        where: { code: id },
        include: GAME_INCLUDE,
      });

      return success(game);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch game",
        operation: "getGame",
      });
    }
  }

  /**
   * Get a game by code
   */
  async getGameByCode(
    code: string,
  ): Promise<Result<GameWithStats | null, AppError>> {
    try {
      const game = await this.db.game.findUnique({
        where: { code },
        include: GAME_INCLUDE,
      });

      return success(game);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch game by code",
        operation: "getGameByCode",
      });
    }
  }

  /**
   * Get game statistics summary
   */
  async getGameStats(
    gameId: string,
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
