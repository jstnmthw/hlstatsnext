import type { Context } from "../context";
import type { CountryQueryArgs } from "../types/graphql/resolvers.types";

/**
 * Country GraphQL resolvers
 */
export const countryResolvers = {
  Query: {
    countries: async (
      _parent: unknown,
      _args: Record<string, never>,
      context: Context,
    ) => {
      return context.db.country.findMany({
        orderBy: { name: "asc" },
      });
    },

    country: async (
      _parent: unknown,
      args: CountryQueryArgs,
      context: Context,
    ) => {
      return context.db.country.findUnique({
        where: { flag: args.id },
      });
    },
  },
};
