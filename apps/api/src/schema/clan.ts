import { builder } from "../builder";
import type { Prisma } from "@repo/database/client";
import { handleGraphQLResult } from "../utils/graphql-result-handler";
import type {
  CreateClanInput as CreateClanInputType,
  UpdateClanInput as UpdateClanInputType,
} from "../types/database/clan.types";

// Define Clan object using Prisma plugin
const Clan = builder.prismaObject("Clan", {
  fields: (t) => ({
    // Expose core database fields
    clanId: t.exposeInt("clanId"),
    tag: t.exposeString("tag"),
    name: t.exposeString("name"),
    homepage: t.exposeString("homepage"),
    mapregion: t.exposeString("mapregion"),
    hidden: t.exposeInt("hidden"),

    // Add GraphQL id field mapped to clanId
    id: t.string({
      resolve: (clan) => clan.clanId.toString(),
    }),

    // Game relation
    game: t.exposeString("game"),
    // gameData: t.relation("gameData"), // Enable when Game type is defined

    // Players relation count
    playerCount: t.relationCount("players"),

    // Players relation
    players: t.relation("players"), // Enable when Player type is defined

    // Simple computed fields
    isHidden: t.boolean({
      resolve: (clan) => clan.hidden === 1,
    }),
  }),
});

// Input type for clan filtering
const ClanFiltersInput = builder.inputType("ClanFiltersInput", {
  fields: (t) => ({
    gameId: t.string({ required: false }),
    includeHidden: t.boolean({ defaultValue: false }),
    search: t.string({ required: false }),
    hasPlayers: t.boolean({ required: false }),
  }),
});

// Enhanced query to get all clans with comprehensive filtering
builder.queryField("clans", (t) =>
  t.prismaField({
    type: [Clan],
    args: {
      filters: t.arg({ type: ClanFiltersInput, required: false }),
      limit: t.arg.int({ defaultValue: 50 }),
      offset: t.arg.int({ defaultValue: 0 }),
    },
    resolve: async (query, _parent, args, context) => {
      const whereClause: Prisma.ClanWhereInput = {};
      const filters = args.filters;

      if (filters?.gameId) {
        whereClause.game = filters.gameId;
      }

      if (!filters?.includeHidden) {
        whereClause.hidden = 0;
      }

      if (filters?.hasPlayers) {
        whereClause.players = {
          some: {},
        };
      }

      if (filters?.search) {
        whereClause.OR = [
          { name: { contains: filters.search } },
          { tag: { contains: filters.search } },
        ];
      }

      return context.db.clan.findMany({
        ...query,
        where: whereClause,
        orderBy: [{ name: "asc" }],
        take: Math.min(args.limit ?? 50, 100), // Cap at 100
        skip: args.offset ?? 0,
      });
    },
  }),
);

// Query to get a single clan by ID
builder.queryField("clan", (t) =>
  t.prismaField({
    type: Clan,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args, context) => {
      const clanId = parseInt(args.id);
      if (isNaN(clanId)) {
        return null;
      }

      return context.db.clan.findUnique({
        ...query,
        where: { clanId },
      });
    },
  }),
);

// Input for creating a clan
const CreateClanInput = builder.inputType("CreateClanInput", {
  fields: (t) => ({
    tag: t.string({ required: true }),
    name: t.string({ required: true }),
    gameId: t.string({ required: true }),
    homepage: t.string({ required: false }),
  }),
});

// Input for updating a clan
const UpdateClanInput = builder.inputType("UpdateClanInput", {
  fields: (t) => ({
    tag: t.string({ required: false }),
    name: t.string({ required: false }),
    homepage: t.string({ required: false }),
    hidden: t.boolean({ required: false }),
  }),
});

// Mutation to create a clan
builder.mutationField("createClan", (t) =>
  t.field({
    type: Clan,
    args: {
      input: t.arg({ type: CreateClanInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.clan.createClan(
        args.input as CreateClanInputType,
      );
      return handleGraphQLResult(result);
    },
  }),
);

// Mutation to update a clan
builder.mutationField("updateClan", (t) =>
  t.field({
    type: Clan,
    args: {
      id: t.arg.int({ required: true }),
      input: t.arg({ type: UpdateClanInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.clan.updateClan(
        args.id,
        args.input as UpdateClanInputType,
      );
      return handleGraphQLResult(result);
    },
  }),
);

export { Clan };
