import type { PrismaClient } from "@repo/database/client";
import type {
  ClanWithAverageSkill,
  ClanStatistics,
} from "../types/database/clan.types";
import type { Result, AppError } from "../types/common";
import { success, failure } from "../types";

/**
 * Service class for handling clan-related business logic
 * Only contains methods with complex business logic not handled by GraphQL schema
 */
export class ClanService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get clan statistics - Complex business logic for statistical calculations
   */
  async getClanStats(
    clanId: string
  ): Promise<Result<ClanStatistics, AppError>> {
    try {
      const clan = await this.db.clan.findUnique({
        where: { clanId: Number(clanId) },
        include: {
          players: {
            orderBy: { skill: "desc" },
          },
        },
      });

      if (!clan) {
        return failure({
          type: "NOT_FOUND",
          message: "Clan not found",
          resource: "clan",
          id: clanId,
        });
      }

      const stats = await this.db.player.aggregate({
        where: { clan: clan.clanId },
        _sum: {
          kills: true,
          deaths: true,
        },
        _avg: {
          skill: true,
        },
      });

      const topPlayer = await this.db.player.findFirst({
        where: { clan: clan.clanId },
        orderBy: {
          skill: "desc",
        },
      });

      const totalKills = stats?._sum?.kills || 0;
      const totalDeaths = stats?._sum?.deaths || 0;
      const killDeathRatio =
        totalDeaths > 0 ? totalKills / totalDeaths : totalKills;

      const clanStatistics: ClanStatistics = {
        clan: {
          ...clan,
          gameData: {
            code: clan.game,
            name: clan.game,
            realgame: clan.game,
            hidden: "0",
          },
          players: [],
          _count: { players: clan.players.length },
        },
        totalKills,
        totalDeaths,
        averageSkill: Math.round(stats?._avg?.skill || 1000),
        topPlayer,
        killDeathRatio: Math.round(killDeathRatio * 100) / 100,
      };

      return success(clanStatistics);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to calculate clan statistics",
        operation: "getClanStats",
      });
    }
  }

  /**
   * Get top clans by average skill - Complex business logic for ranking
   */
  async getTopClans(
    gameId: string,
    limit: number = 10
  ): Promise<Result<readonly ClanWithAverageSkill[], AppError>> {
    try {
      const clans = await this.db.clan.findMany({
        where: {
          game: gameId,
          hidden: 0,
          players: {
            some: {}, // Only clans with at least one player
          },
        },
        include: {
          players: {
            select: { skill: true },
          },
        },
      });

      // Calculate average skill for each clan - this is business logic
      const clansWithAvgSkill = clans.map((clan): ClanWithAverageSkill => {
        const totalSkill = clan.players.reduce(
          (sum, player) => sum + player.skill,
          0
        );
        const averageSkill =
          clan.players.length > 0 ? totalSkill / clan.players.length : 1000;

        return {
          ...clan,
          gameData: {
            code: clan.game,
            name: clan.game,
            realgame: clan.game,
            hidden: "0",
          },
          players: [], // Don't expose all players in listing
          _count: { players: clan.players.length },
          averageSkill: Math.round(averageSkill),
        };
      });

      // Sort by average skill and return top clans - business logic
      const topClans = clansWithAvgSkill
        .sort((a, b) => b.averageSkill - a.averageSkill)
        .slice(0, Math.min(limit, 50)); // Cap at 50 for performance

      return success(topClans);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch top clans",
        operation: "getTopClans",
      });
    }
  }
}
