import type { Clan, PrismaClient } from "@repo/database/client";
import type {
  ClanWithAverageSkill,
  ClanStatistics,
  ClanFilters,
} from "../types/database/clan.types";
import type { Result, AppError } from "../types/common";
import {
  success,
  failure,
  CLAN_INCLUDE,
  CLAN_WITH_ALL_PLAYERS_INCLUDE,
} from "../types";

/**
 * Service class for handling clan-related operations
 */
export class ClanService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get all clans with filters
   */
  async getClans(
    filters: ClanFilters = {},
  ): Promise<Result<readonly Clan[], AppError>> {
    try {
      const whereClause = this.buildClanWhereClause(filters);

      const clans = await this.db.clan.findMany({
        where: whereClause,
        include: CLAN_INCLUDE,
        orderBy: [{ name: "asc" }],
      });

      return success(clans);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch clans",
        operation: "getClans",
      });
    }
  }

  /**
   * Get a single clan by ID
   */
  async getClan(id: string): Promise<Result<Clan | null, AppError>> {
    try {
      const clan = await this.db.clan.findUnique({
        where: { clanId: Number(id) },
        include: CLAN_WITH_ALL_PLAYERS_INCLUDE,
      });

      return success(clan);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch clan",
        operation: "getClan",
      });
    }
  }

  /**
   * Get clan statistics
   */
  async getClanStats(
    clanId: string,
  ): Promise<Result<ClanStatistics, AppError>> {
    try {
      const clanResult = await this.getClan(clanId);

      if (!clanResult.success) {
        return clanResult;
      }

      const clan = clanResult.data;
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
          _count: { players: 0 },
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
   * Get top clans by average skill for a game
   */
  async getTopClans(
    gameId: string,
    limit: number = 10,
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
        include: CLAN_INCLUDE,
      });

      // Calculate average skill for each clan
      const clansWithAvgSkill = await Promise.all(
        clans.map(async (clan): Promise<ClanWithAverageSkill> => {
          const avgSkill = await this.db.player.aggregate({
            where: { clan: clan.clanId, game: gameId },
            _avg: {
              skill: true,
            },
          });

          return {
            ...clan,
            gameData: {
              code: clan.game,
              name: clan.game,
              realgame: clan.game,
              hidden: "0",
            },
            averageSkill: Math.round(avgSkill._avg?.skill || 1000),
          };
        }),
      );

      // Sort by average skill and return top clans
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

  /**
   * Build where clause for clan filtering
   */
  private buildClanWhereClause(filters: ClanFilters): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (filters.gameId) {
      where.gameId = filters.gameId;
    }

    if (typeof filters.hidden === "boolean") {
      where.hidden = filters.hidden;
    }

    if (filters.hasPlayers) {
      where.players = {
        some: {},
      };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { tag: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return where;
  }
}
