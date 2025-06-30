import { builder } from "@/builder"
import { Player } from "@/modules/player/player.schema"
import { handleGraphQLResult, handleGraphQLResultNullable } from "@/shared/utils/graphql-result-handler"
import type { ServerDetails as ServerDetailsType } from "./server.types"
import { CreateServerInput as CreateServerInputType, UpdateServerInput as UpdateServerInputType } from "./server.types"
import { Game } from "@/modules/game/game.schema"

// Define Server object from Prisma model
const Server = builder.prismaObject("Server", {
  fields: (t) => ({
    id: t.exposeInt("serverId"),
    name: t.exposeString("name"),
    address: t.exposeString("address"),
    port: t.exposeInt("port"),
    gameId: t.exposeString("game"),
    playerCount: t.exposeInt("players"),
    maxPlayers: t.exposeInt("max_players"),
    map: t.exposeString("act_map"),
    lastEvent: t.exposeInt("last_event"),

    // Manually resolve relation to Game
    game: t.field({
      type: Game,
      resolve: async (server, _args, context) => context.db.game.findUniqueOrThrow({ where: { code: server.game } }),
    }),
  }),
})

// Define ServerDetails for the detailed query
const ServerDetails = builder.objectRef<ServerDetailsType>("ServerDetails")

ServerDetails.implement({
  fields: (t) => ({
    id: t.exposeInt("serverId"),
    name: t.exposeString("name"),
    address: t.exposeString("address"),
    port: t.exposeInt("port"),
    gameId: t.exposeString("game"),
    playerCount: t.exposeInt("playerCount"),
    maxPlayers: t.exposeInt("max_players"),
    map: t.exposeString("act_map"),
    lastEvent: t.exposeInt("last_event"),
    isOnline: t.exposeBoolean("isOnline"),

    // Relations from service
    game: t.field({
      type: Game,
      nullable: true,
      resolve: (server) => server.gameData,
    }),
    currentPlayers: t.field({
      type: [Player],
      resolve: (server) => server.currentPlayers,
    }),
  }),
})

// Input for creating a server
const CreateServerInput = builder.inputType("CreateServerInput", {
  fields: (t) => ({
    address: t.string({ required: true }),
    port: t.int({ required: true }),
    gameId: t.string({ required: true }),
    name: t.string({ required: false }),
    rconPassword: t.string({ required: false }),
    privateAddress: t.string({ required: false }),
  }),
})

// Input for updating a server
const UpdateServerInput = builder.inputType("UpdateServerInput", {
  fields: (t) => ({
    name: t.string({ required: false }),
    rconPassword: t.string({ required: false }),
    privateAddress: t.string({ required: false }),
  }),
})

// Query to get all servers
builder.queryField("servers", (t) =>
  t.field({
    type: [Server],
    resolve: async (_parent, _args, context) => {
      const result = await context.services.server.getServers()
      return handleGraphQLResult(result)
    },
  }),
)

// Query to get a single server's details
builder.queryField("server", (t) =>
  t.field({
    type: ServerDetails,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.server.getServerDetails(args.id)
      return handleGraphQLResultNullable(result)
    },
  }),
)

// Mutation to create a server
builder.mutationField("createServer", (t) =>
  t.field({
    type: Server,
    args: {
      input: t.arg({ type: CreateServerInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.server.createServer(args.input as CreateServerInputType)
      return handleGraphQLResult(result)
    },
  }),
)

// Mutation to update a server
builder.mutationField("updateServer", (t) =>
  t.field({
    type: Server,
    args: {
      id: t.arg.string({ required: true }),
      input: t.arg({ type: UpdateServerInput, required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.server.updateServer(args.id, args.input as UpdateServerInputType)
      return handleGraphQLResult(result)
    },
  }),
)
