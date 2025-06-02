import type { Context } from "../context";
import type {
  ClansQueryArgs,
  ClanQueryArgs,
  ClanStatsQueryArgs,
  TopClansQueryArgs,
} from "../types/graphql/resolvers.types";
import type { Clan } from "../types/database";
import { isSuccess } from "../types/common";
import type { ClanWithAverageSkill } from "../types/database/clan.types";

/**
 * GraphQL clan response type that matches the schema
 */
export interface GraphQLClanWithAvgSkill
  extends Omit<ClanWithAverageSkill, "_count"> {
  playerCount: number;
}

/**
 * Clan GraphQL resolvers
 */
export const clanResolvers = {
  Query: {
    clans: async (
      _parent: unknown,
      args: ClansQueryArgs,
      context: Context,
    ): Promise<Clan[]> => {
      const result = await context.services.clan.getClans(args.filters);

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data as Clan[];
    },

    clan: async (
      _parent: unknown,
      args: ClanQueryArgs,
      context: Context,
    ): Promise<Clan | null> => {
      const result = await context.services.clan.getClan(args.id);

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      const clan = result.data;
      if (!clan) return null;

      return clan;
    },

    clanStats: async (
      _parent: unknown,
      args: ClanStatsQueryArgs,
      context: Context,
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
      context: Context,
    ): Promise<GraphQLClanWithAvgSkill[]> => {
      const result = await context.services.clan.getTopClans(
        args.gameId,
        args.limit,
      );

      if (!isSuccess(result)) {
        throw new Error(result.error.message);
      }

      return result.data.map(
        (clan): GraphQLClanWithAvgSkill => ({
          ...clan,
          playerCount: clan._count.players,
        }),
      );
    },
  },

  // Field resolvers for clan computed fields
  Clan: {
    // Field resolvers can be added here if needed for computed fields
  },
};
