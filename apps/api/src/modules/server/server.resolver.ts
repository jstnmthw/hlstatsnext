import { builder } from "../../builder"
import { ServerService } from "./server.service"
import type { CreateServerInput, UpdateServerInput } from "./server.types"
import type { Prisma } from "@repo/database/client"

const serverService = new ServerService()

// Define custom input type for server creation
const CreateServerInputType = builder.inputType("CreateServerInput", {
  fields: (t) => ({
    address: t.string({ required: false }),
    port: t.int({ required: true }),
    game: t.string({ required: true }),
    name: t.string({ required: false }),
    mod: t.string({ required: false }),
    rconPassword: t.string({ required: false }),
    publicAddress: t.string({ required: false }),
    statusUrl: t.string({ required: false }),
    connectionType: t.string({ required: false }),
    dockerHost: t.string({ required: false }),
    sortOrder: t.int({ required: false }),
  }),
})

// Define result type for server creation
const CreateServerResultType = builder.objectRef<{
  server: Prisma.ServerGetPayload<{
    include: {
      configs: true
    }
  }>
  configsCount: number
}>("CreateServerResult")

CreateServerResultType.implement({
  fields: (t) => ({
    server: t.prismaField({
      type: "Server",
      resolve: (query, result) => result.server,
    }),
    configsCount: t.int({
      resolve: (result) => result.configsCount,
    }),
    success: t.boolean({
      resolve: () => true,
    }),
    message: t.string({
      resolve: (result) =>
        `Server created successfully with ${result.configsCount} configuration entries`,
    }),
  }),
})

// Define input type for server updates
const UpdateServerInputType = builder.inputType("UpdateServerInput", {
  fields: (t) => ({
    name: t.string({ required: false }),
    address: t.string({ required: false }),
    port: t.int({ required: true }),
    game: t.string({ required: true }),
    mod: t.string({ required: false }),
    publicAddress: t.string({ required: false }),
    statusUrl: t.string({ required: false }),
    rconPassword: t.string({ required: false }),
    connectionType: t.string({ required: false }),
    dockerHost: t.string({ required: false }),
    sortOrder: t.int({ required: false }),
  }),
})

// Custom server creation mutation
builder.mutationField("createServerWithConfig", (t) =>
  t.field({
    type: CreateServerResultType,
    args: {
      data: t.arg({ type: CreateServerInputType, required: true }),
    },
    resolve: async (_, { data }) => {
      const input: CreateServerInput = {
        address: data.address || undefined,
        port: data.port,
        game: data.game,
        name: data.name || undefined,
        mod: data.mod || undefined,
        rconPassword: data.rconPassword || undefined,
        publicAddress: data.publicAddress || undefined,
        statusUrl: data.statusUrl || undefined,
        connectionType: data.connectionType || undefined,
        dockerHost: data.dockerHost || undefined,
        sortOrder: data.sortOrder || undefined,
      }

      return await serverService.createServerWithConfig(input)
    },
  }),
)

// Custom server update mutation
builder.mutationField("updateServerWithConfig", (t) =>
  t.prismaField({
    type: "Server",
    args: {
      serverId: t.arg.int({ required: true }),
      data: t.arg({ type: UpdateServerInputType, required: true }),
    },
    resolve: async (query, _, { serverId, data }) => {
      const input: UpdateServerInput = {
        name: data.name || undefined,
        address: data.address || undefined,
        port: data.port,
        game: data.game,
        mod: data.mod || undefined,
        publicAddress: data.publicAddress || undefined,
        statusUrl: data.statusUrl || undefined,
        rconPassword: data.rconPassword || undefined,
        connectionType: data.connectionType || undefined,
        dockerHost: data.dockerHost || undefined,
        sortOrder: data.sortOrder || undefined,
      }

      return await serverService.updateServerWithConfig(serverId, input)
    },
  }),
)
