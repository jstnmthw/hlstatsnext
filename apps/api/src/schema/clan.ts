import { builder } from "../builder";
import type { Prisma } from "@repo/database/client";

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

    // Computed fields
    isHidden: t.boolean({
      resolve: (clan) => clan.hidden === 1,
    }),
  }),
});

// Query to get all clans with filtering
builder.queryField("clans", (t) =>
  t.prismaField({
    type: [Clan],
    args: {
      gameId: t.arg.string({ required: false }),
      includeHidden: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (query, _parent, args, context) => {
      const whereClause: Prisma.ClanWhereInput = {};

      if (args.gameId) {
        whereClause.game = args.gameId;
      }

      if (!args.includeHidden) {
        whereClause.hidden = 0;
      }

      return context.db.clan.findMany({
        ...query,
        where: whereClause,
        orderBy: [{ name: "asc" }],
      });
    },
  })
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
  })
);

// Query to get top clans for a game
builder.queryField("topClans", (t) =>
  t.prismaField({
    type: [Clan],
    args: {
      gameId: t.arg.string({ required: true }),
      limit: t.arg.int({ defaultValue: 10 }),
    },
    resolve: async (query, _parent, args, context) => {
      return context.db.clan.findMany({
        ...query,
        where: {
          game: args.gameId,
          hidden: 0,
          players: {
            some: {}, // Only clans with at least one player
          },
        },
        orderBy: [{ name: "asc" }],
        take: Math.min(args.limit ?? 10, 50),
      });
    },
  })
);
