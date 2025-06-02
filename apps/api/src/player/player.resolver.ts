import type { Context } from "../context";
import type {
  PlayersQueryArgs,
  PlayerQueryArgs,
  PlayerBySteamIdQueryArgs,
  PlayerStatsQueryArgs,
  TopPlayersQueryArgs,
  CreatePlayerMutationArgs,
  UpdatePlayerStatsMutationArgs,
} from "../types/graphql/resolvers.types";
import {
  GraphQLPlayerSortFieldMap,
  GraphQLSortDirectionMap,
} from "../types/graphql/resolvers.types";
import type { Player } from "../types/database";
import { isSuccess } from "../types/common";

/**
 * Player GraphQL resolvers
 */
export const playerResolvers = {
  Query: {
    players: async (
      _parent: unknown,
      args: PlayersQueryArgs,
      context: Context,
    ) => {
      const sort = args.sort
        ? {
            field:
              GraphQLPlayerSortFieldMap[
                args.sort.field as keyof typeof GraphQLPlayerSortFieldMap
              ],
            direction:
              GraphQLSortDirectionMap[
                args.sort.direction as keyof typeof GraphQLSortDirectionMap
              ],
          }
        : undefined;

      const result = await context.services.player.getPlayers(
        args.filters,
        sort,
        args.pagination,
      );

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return {
        players: result.data.items,
        total: result.data.pagination.totalItems,
        page: result.data.pagination.currentPage,
        totalPages: result.data.pagination.totalPages,
      };
    },

    player: async (
      _parent: unknown,
      args: PlayerQueryArgs,
      context: Context,
    ): Promise<Player | null> => {
      const result = await context.services.player.getPlayer(args.id);

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    playerBySteamId: async (
      _parent: unknown,
      args: PlayerBySteamIdQueryArgs,
      context: Context,
    ): Promise<Player | null> => {
      const result = await context.services.player.getPlayerBySteamId(
        args.steamId,
        args.gameId,
      );

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    playerStats: async (
      _parent: unknown,
      args: PlayerStatsQueryArgs,
      context: Context,
    ) => {
      const result = await context.services.player.getPlayerStats(
        args.playerId,
      );

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    topPlayers: async (
      _parent: unknown,
      args: TopPlayersQueryArgs,
      context: Context,
    ): Promise<readonly Player[]> => {
      const result = await context.services.player.getTopPlayers(
        args.gameId,
        args.limit,
      );

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
  },

  Mutation: {
    createPlayer: async (
      _parent: unknown,
      args: CreatePlayerMutationArgs,
      context: Context,
    ): Promise<Player> => {
      const result = await context.services.player.createPlayer(args.input);

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    updatePlayerStats: async (
      _parent: unknown,
      args: UpdatePlayerStatsMutationArgs,
      context: Context,
    ): Promise<Player> => {
      const result = await context.services.player.updatePlayerStats(
        args.input.steamId,
        args.input.gameId,
        args.input,
      );

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
  },

  // Field resolvers for player computed fields
  Player: {
    // These are computed fields that don't exist in the database
    killDeathRatio: (player: { kills: number; deaths: number }): number => {
      return player.deaths > 0
        ? Math.round((player.kills / player.deaths) * 100) / 100
        : player.kills;
    },

    accuracy: (player: { hits: number; shots: number }): number => {
      return player.shots > 0
        ? Math.round((player.hits / player.shots) * 10000) / 100
        : 0;
    },

    headshotRatio: (player: { headshots: number; kills: number }): number => {
      return player.kills > 0
        ? Math.round((player.headshots / player.kills) * 10000) / 100
        : 0;
    },
  },
};
