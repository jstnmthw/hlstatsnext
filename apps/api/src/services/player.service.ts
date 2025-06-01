import type { Player, PrismaClient } from "@repo/database/client";
import type {
  PlayerFilters,
  PlayerSortInput,
  PlayerStatistics,
  CreatePlayerInput,
  UpdatePlayerStatsInput,
} from "../types/database/player.types";
import type {
  Result,
  AppError,
  PaginatedResponse,
  PaginationInput,
} from "../types/common";
import {
  success,
  failure,
  createPaginationConfig,
  createPaginationMetadata,
  PLAYER_INCLUDE,
  PlayerSortField,
} from "../types";

/**
 * Service class for handling player-related operations
 */
export class PlayerService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get a single player by ID with all relations
   */
  async getPlayer(id: string): Promise<Result<Player | null, AppError>> {
    try {
      const player = await this.db.player.findUnique({
        where: { playerId: id },
        include: PLAYER_INCLUDE,
      });

      return success(player);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch player",
        operation: "getPlayer",
      });
    }
  }

  /**
   * Get a player by Steam ID
   */
  async getPlayerBySteamId(
    steamId: string,
    gameId?: string
  ): Promise<Result<Player | null, AppError>> {
    try {
      const whereClause = {
        uniqueIds: {
          some: {
            uniqueId: steamId,
            ...(gameId && { gameId }),
          },
        },
      };

      const player = await this.db.player.findFirst({
        where: whereClause,
        include: PLAYER_INCLUDE,
      });

      return success(player);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch player by Steam ID",
        operation: "getPlayerBySteamId",
      });
    }
  }

  /**
   * Get players with filtering, sorting, and pagination
   */
  async getPlayers(
    filters: PlayerFilters = {},
    sort: PlayerSortInput = { field: PlayerSortField.SKILL, direction: "desc" },
    pagination: PaginationInput = {}
  ): Promise<Result<PaginatedResponse<Player>, AppError>> {
    try {
      const paginationConfig = createPaginationConfig(pagination);
      const whereClause = this.buildPlayerWhereClause(filters);
      const orderBy = this.buildPlayerOrderBy(sort);

      const [players, total] = await Promise.all([
        this.db.player.findMany({
          where: whereClause,
          include: PLAYER_INCLUDE,
          orderBy,
          skip: paginationConfig.skip,
          take: paginationConfig.limit,
        }),
        this.db.player.count({ where: whereClause }),
      ]);

      const paginationMetadata = createPaginationMetadata(
        total,
        paginationConfig
      );

      return success({
        items: players,
        pagination: paginationMetadata,
      });
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch players",
        operation: "getPlayers",
      });
    }
  }

  /**
   * Get top players by skill for a specific game
   */
  async getTopPlayers(
    gameId: string,
    limit: number = 10
  ): Promise<Result<readonly Player[], AppError>> {
    try {
      const players = await this.db.player.findMany({
        where: {
          game: gameId,
          hideRanking: false,
        },
        include: PLAYER_INCLUDE,
        orderBy: {
          skill: "desc",
        },
        take: Math.min(limit, 100), // Cap at 100 for performance
      });

      return success(players);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to fetch top players",
        operation: "getTopPlayers",
      });
    }
  }

  /**
   * Get player statistics summary
   */
  async getPlayerStats(
    playerId: string
  ): Promise<Result<PlayerStatistics, AppError>> {
    try {
      const playerResult = await this.getPlayer(playerId);

      if (!playerResult.success) {
        return playerResult;
      }

      const player = playerResult.data;
      if (!player) {
        return failure({
          type: "NOT_FOUND",
          message: "Player not found",
          resource: "player",
          id: playerId,
        });
      }

      // Calculate derived statistics
      const killDeathRatio =
        player.deaths > 0 ? player.kills / player.deaths : player.kills;
      const accuracy =
        player.shots > 0 ? (player.hits / player.shots) * 100 : 0;
      const headshotRatio =
        player.kills > 0 ? (player.headshots / player.kills) * 100 : 0;

      // Get player rank within their game
      const rank =
        (await this.db.player.count({
          where: {
            game: player.game,
            skill: {
              gt: player.skill,
            },
            hideRanking: false,
          },
        })) + 1;

      const statistics: PlayerStatistics = {
        player,
        killDeathRatio: Math.round(killDeathRatio * 100) / 100,
        accuracy: Math.round(accuracy * 100) / 100,
        headshotRatio: Math.round(headshotRatio * 100) / 100,
        rank,
      };

      return success(statistics);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to calculate player statistics",
        operation: "getPlayerStats",
      });
    }
  }

  /**
   * Update player statistics (called by daemon)
   */
  async updatePlayerStats(
    steamId: string,
    gameId: string,
    stats: UpdatePlayerStatsInput
  ): Promise<Result<Player, AppError>> {
    try {
      // Find player by Steam ID
      const existingPlayerResult = await this.getPlayerBySteamId(
        steamId,
        gameId
      );

      if (!existingPlayerResult.success) {
        return existingPlayerResult;
      }

      const existingPlayer = existingPlayerResult.data;
      if (!existingPlayer) {
        return failure({
          type: "NOT_FOUND",
          message: "Player not found",
          resource: "player",
          id: steamId,
        });
      }

      // Update player statistics
      const updatedPlayer = await this.db.player.update({
        where: { playerId: existingPlayer.playerId },
        data: {
          ...stats,
          lastSkillChange: stats.skill
            ? Math.floor(Date.now() / 1000)
            : undefined,
        },
        include: PLAYER_INCLUDE,
      });

      return success(updatedPlayer);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to update player statistics",
        operation: "updatePlayerStats",
      });
    }
  }

  /**
   * Create a new player
   */
  async createPlayer(
    data: CreatePlayerInput
  ): Promise<Result<Player, AppError>> {
    try {
      const player = await this.db.player.create({
        data: {
          lastName: data.lastName,
          fullName: data.fullName,
          email: data.email,
          homepage: data.homepage,
          game: data.gameId,
          clanId: data.clanId,
          countryId: data.countryId,
          city: data.city,
          state: data.state,
          lastAddress: data.lastAddress,
          uniqueIds: {
            create: {
              uniqueId: data.steamId,
              game: data.gameId,
            },
          },
        },
        include: PLAYER_INCLUDE,
      });

      return success(player);
    } catch (error) {
      console.error(error);
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to create player",
        operation: "createPlayer",
      });
    }
  }

  /**
   * Build where clause for player filtering
   */
  private buildPlayerWhereClause(
    filters: PlayerFilters
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (filters.gameId) {
      where.game = filters.gameId;
    }

    if (filters.clanId) {
      where.clanId = filters.clanId;
    }

    if (filters.countryId) {
      where.countryId = filters.countryId;
    }

    if (typeof filters.hideRanking === "boolean") {
      where.hideRanking = filters.hideRanking;
    }

    if (filters.minSkill !== undefined || filters.maxSkill !== undefined) {
      where.skill = {};
      if (filters.minSkill !== undefined) {
        (where.skill as Record<string, unknown>).gte = filters.minSkill;
      }
      if (filters.maxSkill !== undefined) {
        (where.skill as Record<string, unknown>).lte = filters.maxSkill;
      }
    }

    if (filters.minKills !== undefined) {
      where.kills = {
        gte: filters.minKills,
      };
    }

    if (filters.search) {
      where.OR = [
        { lastName: { contains: filters.search, mode: "insensitive" } },
        { fullName: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  /**
   * Build order by clause for player sorting
   */
  private buildPlayerOrderBy(sort: PlayerSortInput): Record<string, string> {
    return {
      [sort.field]: sort.direction,
    };
  }
}
