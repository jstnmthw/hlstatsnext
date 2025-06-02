import type { HealthStatusResponse } from "./types/graphql/resolvers.types";
import { gameResolvers } from "./game/game.resolver";
import { playerResolvers } from "./player/player.resolver";
import { clanResolvers } from "./clan/clan.resolver";
import { countryResolvers } from "./country/country.resolver";

/**
 * GraphQL resolvers with strict TypeScript typing
 */
export const resolvers = {
  Query: {
    health: (): HealthStatusResponse => ({
      status: "OK",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    }),

    // Merge all query resolvers
    ...gameResolvers.Query,
    ...playerResolvers.Query,
    ...clanResolvers.Query,
    ...countryResolvers.Query,
  },

  Mutation: {
    // Merge all mutation resolvers
    ...playerResolvers.Mutation,
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
  Player: playerResolvers.Player,
  Game: gameResolvers.Game,
  Clan: clanResolvers.Clan,
};

export type Resolvers = typeof resolvers;
