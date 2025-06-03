import { builder } from "../builder";

// Define Game object using Prisma plugin - automatically maps all Prisma fields
const Game = builder.prismaObject("Game", {
  fields: (t) => ({
    // Expose all database fields automatically
    code: t.exposeString("code"),
    name: t.exposeString("name"),
    realgame: t.exposeString("realgame"),
    hidden: t.exposeString("hidden"),

    // Add GraphQL id field mapped to code
    id: t.string({
      resolve: (game) => game.code,
    }),

    // Add computed boolean for hidden status
    isHidden: t.boolean({
      resolve: (game) => game.hidden === "1",
    }),

    // Automatically expose relations with full Prisma support
    players: t.relation("players"),
    clans: t.relation("clans"),

    // Expose relation counts
    playerCount: t.relationCount("players"),
    clanCount: t.relationCount("clans"),
  }),
});

// Query to get all games with automatic Prisma integration
builder.queryField("games", (t) =>
  t.prismaField({
    type: [Game],
    args: {
      includeHidden: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (query, _parent, args, _context) => {
      // Pothos automatically handles the query selection and includes
      return _context.db.game.findMany({
        ...query,
        where: args.includeHidden ? {} : { hidden: "0" },
      });
    },
  })
);

// Query to get a single game with automatic Prisma integration
builder.queryField("game", (t) =>
  t.prismaField({
    type: Game,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args, _context) => {
      // Pothos automatically handles the query selection and includes
      return _context.db.game.findUnique({
        ...query,
        where: { code: args.id },
      });
    },
  })
);
