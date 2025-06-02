import type { Context } from "../context";
import type {
  GameQueryArgs,
  GameByCodeQueryArgs,
  GameStatsQueryArgs,
  GamesQueryArgs,
} from "../types/graphql/resolvers.types";
import type { GameWithStats } from "../types/database/game.types";
import { isSuccess } from "../types/common";

/**
 * GraphQL game response type that matches the schema
 */
export interface GraphQLGame extends Omit<GameWithStats, "_count"> {
  playerCount: number;
  clanCount: number;
}

/**
 * Game GraphQL resolvers
 */
export const gameResolvers = {
  Query: {
    games: async (
      _parent: unknown,
      args: GamesQueryArgs,
      context: Context,
    ): Promise<GraphQLGame[]> => {
      const result = await context.services.game.getGames(args.includeHidden);

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data.map(
        (game): GraphQLGame => ({
          ...game,
          playerCount: game._count.players,
          clanCount: game._count.clans,
        }),
      );
    },

    game: async (
      _parent: unknown,
      args: GameQueryArgs,
      context: Context,
    ): Promise<GraphQLGame | null> => {
      const result = await context.services.game.getGame(args.id);

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      const game = result.data;
      if (!game) return null;

      return {
        ...game,
        playerCount: game._count.players,
        clanCount: game._count.clans,
      };
    },

    gameByCode: async (
      _parent: unknown,
      args: GameByCodeQueryArgs,
      context: Context,
    ): Promise<GraphQLGame | null> => {
      const result = await context.services.game.getGameByCode(args.code);

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      const game = result.data;
      if (!game) return null;

      return {
        ...game,
        playerCount: game._count.players,
        clanCount: game._count.clans,
      };
    },

    gameStats: async (
      _parent: unknown,
      args: GameStatsQueryArgs,
      context: Context,
    ) => {
      const result = await context.services.game.getGameStats(args.gameId);

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
  },

  // Field resolvers for game computed fields
  Game: {
    // Field resolvers can be added here if needed for computed fields
  },
};
