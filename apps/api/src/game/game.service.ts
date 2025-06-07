import type { PrismaClient, Game } from "@repo/database/client";
import type {
  GameStatistics,
  CreateGameInput,
  UpdateGameInput,
} from "../types/database/game.types";
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

  /**
   * Create a new game
   */
  async createGame(input: CreateGameInput): Promise<Result<Game, AppError>> {
    try {
      const game = await this.db.game.create({
        data: {
          code: input.code,
          name: input.name,
          realgame: input.realgame,
          hidden: input.hidden ? "1" : "0",
        },
      });
      return success(game);
    } catch (error) {
      console.error(error);
      // Prisma unique constraint violation
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        return failure({
          type: "VALIDATION_ERROR",
          message: `Game with code '${input.code}' already exists.`,
          field: "code",
          value: input.code,
        });
      }
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to create game",
        operation: "createGame",
      });
    }
  }

  /**
   * Update an existing game
   */
  async updateGame(
    code: string,
    input: UpdateGameInput
  ): Promise<Result<Game, AppError>> {
    try {
      const game = await this.db.game.update({
        where: { code },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.realgame && { realgame: input.realgame }),
          ...(input.hidden !== undefined && {
            hidden: input.hidden ? "1" : "0",
          }),
        },
      });
      return success(game);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to update game",
        operation: "updateGame",
      });
    }
  }
}
