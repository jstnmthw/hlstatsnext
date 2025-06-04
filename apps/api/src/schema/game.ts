import { builder } from "../builder";
import { Player } from "./player";

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

    // Relation counts
    playerCount: t.relationCount("players"),
    clanCount: t.relationCount("clans"),

    // Relations
    players: t.relation("players"),
    clans: t.relation("clans"),
  }),
});

// Define GameStatistics type for complex queries
const GameStatistics = builder.objectRef<{
  totalPlayers: number;
  activePlayers: number;
  totalKills: number;
  totalDeaths: number;
  averageSkill: number;
  topPlayers: readonly Player[];
}>("GameStatistics");

GameStatistics.implement({
  fields: (t) => ({
    totalPlayers: t.exposeInt("totalPlayers"),
    activePlayers: t.exposeInt("activePlayers"),
    totalKills: t.exposeInt("totalKills"),
    totalDeaths: t.exposeInt("totalDeaths"),
    averageSkill: t.exposeInt("averageSkill"),
    topPlayers: t.expose("topPlayers", { type: [Player] }),
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

// Query to get game statistics using the service for complex business logic
builder.queryField("gameStats", (t) =>
  t.field({
    type: GameStatistics,
    args: {
      gameId: t.arg.string({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.game.getGameStats(args.gameId);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
  })
);

export { Game };
