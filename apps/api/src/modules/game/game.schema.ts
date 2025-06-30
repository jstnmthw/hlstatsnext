import { builder } from "@/builder"
import { Player } from "@/modules/player/player.schema"
import { mapAppErrorToGraphQLError } from "@/shared/types/graphql-errors.types"
import type { Player as PrismaPlayer } from "@repo/database/client"
import type { CreateGameInput as CreateGameInputType, UpdateGameInput as UpdateGameInputType } from "./game.types"

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
})

// Define GameStatistics type for complex queries
const GameStatistics = builder.objectRef<{
  totalPlayers: number
  activePlayers: number
  totalKills: number
  totalDeaths: number
  averageSkill: number
  topPlayers: readonly PrismaPlayer[]
}>("GameStatistics")

GameStatistics.implement({
  fields: (t) => ({
    totalPlayers: t.exposeInt("totalPlayers"),
    activePlayers: t.exposeInt("activePlayers"),
    totalKills: t.exposeInt("totalKills"),
    totalDeaths: t.exposeInt("totalDeaths"),
    averageSkill: t.exposeInt("averageSkill"),
    topPlayers: t.field({
      type: [Player],
      resolve: (stats) => stats.topPlayers,
    }),
  }),
})

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
      })
    },
  }),
)

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
      })
    },
  }),
)

// Query to get game statistics using the service for complex business logic
builder.queryField("gameStats", (t) =>
  t.field({
    type: GameStatistics,
    args: {
      gameId: t.arg.string({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.game.getGameStats(args.gameId)
      if (!result.success) {
        throw mapAppErrorToGraphQLError(result.error)
      }
      return result.data
    },
  }),
)

// Input for creating a game
const CreateGameInput = builder.inputType("CreateGameInput", {
  fields: (t) => ({
    code: t.string({ required: true }),
    name: t.string({ required: true }),
    realgame: t.string({ required: true }),
    hidden: t.boolean({ required: false, defaultValue: false }),
  }),
})

// Input for updating a game
const UpdateGameInput = builder.inputType("UpdateGameInput", {
  fields: (t) => ({
    name: t.string({ required: false }),
    realgame: t.string({ required: false }),
    hidden: t.boolean({ required: false }),
  }),
})

// Mutation to create a game
builder.mutationField("createGame", (t) =>
  t.field({
    type: Game,
    args: {
      input: t.arg({ type: CreateGameInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.game.createGame(args.input as CreateGameInputType)
      if (!result.success) {
        throw mapAppErrorToGraphQLError(result.error)
      }
      return result.data
    },
  }),
)

// Mutation to update a game
builder.mutationField("updateGame", (t) =>
  t.field({
    type: Game,
    args: {
      code: t.arg.string({ required: true }),
      input: t.arg({ type: UpdateGameInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.game.updateGame(args.code, args.input as UpdateGameInputType)
      if (!result.success) {
        throw mapAppErrorToGraphQLError(result.error)
      }
      return result.data
    },
  }),
)

export { Game }
