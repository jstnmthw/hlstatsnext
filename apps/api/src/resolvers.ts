import type { Context } from "./context";
import type {
  GameQueryArgs,
  GameByCodeQueryArgs,
  GameStatsQueryArgs,
  GamesQueryArgs,
  PlayersQueryArgs,
  PlayerQueryArgs,
  PlayerBySteamIdQueryArgs,
  PlayerStatsQueryArgs,
  TopPlayersQueryArgs,
  ClansQueryArgs,
  ClanQueryArgs,
  ClanStatsQueryArgs,
  TopClansQueryArgs,
  CountryQueryArgs,
  CreatePlayerMutationArgs,
  UpdatePlayerStatsMutationArgs,
  HealthStatusResponse,
} from "./types/graphql/resolvers.types";
import {
  GraphQLPlayerSortFieldMap,
  GraphQLSortDirectionMap,
} from "./types/graphql/resolvers.types";
import type {
  PlayerWithRelations,
  GameWithStats,
  ClanWithRelations,
  ClanWithAverageSkill,
} from "./types/database";
import { isSuccess } from "./types/common";

/**
 * GraphQL game response type that matches the schema
 */
interface GraphQLGame extends Omit<GameWithStats, "_count"> {
  playerCount: number;
  clanCount: number;
}

/**
 * GraphQL clan response type that matches the schema
 */
interface GraphQLClan extends Omit<ClanWithRelations, "_count"> {
  playerCount: number;
}

/**
 * GraphQL clan with average skill response type
 */
interface GraphQLClanWithAvgSkill extends Omit<ClanWithAverageSkill, "_count"> {
  playerCount: number;
}

/**
 * GraphQL resolvers with strict TypeScript typing
 */
export const resolvers = {
  Query: {
    hello: (): string => "Hello from HLStatsX Next.js API!",

    health: (): HealthStatusResponse => ({
      status: "OK",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    }),

    // Game queries
    games: async (
      _parent: unknown,
      args: GamesQueryArgs,
      context: Context
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
        })
      );
    },

    game: async (
      _parent: unknown,
      args: GameQueryArgs,
      context: Context
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
      context: Context
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
      context: Context
    ) => {
      const result = await context.services.game.getGameStats(args.gameId);

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    // Player queries
    players: async (
      _parent: unknown,
      args: PlayersQueryArgs,
      context: Context
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
        args.pagination
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
      context: Context
    ): Promise<PlayerWithRelations | null> => {
      const result = await context.services.player.getPlayer(args.id);

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    playerBySteamId: async (
      _parent: unknown,
      args: PlayerBySteamIdQueryArgs,
      context: Context
    ): Promise<PlayerWithRelations | null> => {
      const result = await context.services.player.getPlayerBySteamId(
        args.steamId,
        args.gameId
      );

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    playerStats: async (
      _parent: unknown,
      args: PlayerStatsQueryArgs,
      context: Context
    ) => {
      const result = await context.services.player.getPlayerStats(
        args.playerId
      );

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    topPlayers: async (
      _parent: unknown,
      args: TopPlayersQueryArgs,
      context: Context
    ): Promise<readonly PlayerWithRelations[]> => {
      const result = await context.services.player.getTopPlayers(
        args.gameId,
        args.limit
      );

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    // Clan queries
    clans: async (
      _parent: unknown,
      args: ClansQueryArgs,
      context: Context
    ): Promise<GraphQLClan[]> => {
      const result = await context.services.clan.getClans(args.filters);

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data.map(
        (clan): GraphQLClan => ({
          ...clan,
          playerCount: clan._count.players,
        })
      );
    },

    clan: async (
      _parent: unknown,
      args: ClanQueryArgs,
      context: Context
    ): Promise<GraphQLClan | null> => {
      const result = await context.services.clan.getClan(args.id);

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      const clan = result.data;
      if (!clan) return null;

      return {
        ...clan,
        playerCount: clan._count.players,
      };
    },

    clanStats: async (
      _parent: unknown,
      args: ClanStatsQueryArgs,
      context: Context
    ) => {
      const result = await context.services.clan.getClanStats(args.clanId);

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    topClans: async (
      _parent: unknown,
      args: TopClansQueryArgs,
      context: Context
    ): Promise<GraphQLClanWithAvgSkill[]> => {
      const result = await context.services.clan.getTopClans(
        args.gameId,
        args.limit
      );

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data.map(
        (clan): GraphQLClanWithAvgSkill => ({
          ...clan,
          playerCount: clan._count.players,
        })
      );
    },

    // Country queries
    countries: async (
      _parent: unknown,
      _args: Record<string, never>,
      context: Context
    ) => {
      return context.db.country.findMany({
        orderBy: { name: "asc" },
      });
    },

    country: async (
      _parent: unknown,
      args: CountryQueryArgs,
      context: Context
    ) => {
      return context.db.country.findUnique({
        where: { id: args.id },
      });
    },
  },

  Mutation: {
    createPlayer: async (
      _parent: unknown,
      args: CreatePlayerMutationArgs,
      context: Context
    ): Promise<PlayerWithRelations> => {
      const result = await context.services.player.createPlayer(args.input);

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    updatePlayerStats: async (
      _parent: unknown,
      args: UpdatePlayerStatsMutationArgs,
      context: Context
    ): Promise<PlayerWithRelations> => {
      const result = await context.services.player.updatePlayerStats(
        args.input.steamId,
        args.input.gameId,
        args.input
      );

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
  },

  Subscription: {
    // Real-time subscriptions will be implemented in future phases
    // These would use GraphQL subscriptions with PubSub for live updates
    playerUpdated: {
      // subscribe: () => pubsub.asyncIterator(['PLAYER_UPDATED']),
    },
    gameStatsUpdated: {
      // subscribe: () => pubsub.asyncIterator(['GAME_STATS_UPDATED']),
    },
  },

  // Field resolvers for nested data
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

  Game: {
    // Field resolvers can be added here if needed for computed fields
  },

  Clan: {
    // Field resolvers can be added here if needed for computed fields
  },
};

export type Resolvers = typeof resolvers;
