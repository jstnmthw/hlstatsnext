import { builder } from "../../builder"
import type { Server } from "@repo/database/client"

// Input type for updating servers
const UpdateServerInput = builder.inputType("UpdateServerInput", {
  fields: (t) => ({
    name: t.string({ required: false }),
    address: t.string({ required: false }),
    port: t.int({ required: false }),
    publicAddress: t.string({ required: false }),
    statusUrl: t.string({ required: false }),
    game: t.string({ required: false }),
    mod: t.string({ required: false }),
    rconPassword: t.string({ required: false }),
    connectionType: t.string({ required: false }),
    dockerHost: t.string({ required: false }),
    sortOrder: t.int({ required: false }),
  }),
})

// Input type for creating servers
const CreateServerInput = builder.inputType("CreateServerInput", {
  fields: (t) => ({
    name: t.string({ required: false }), // Has database default
    address: t.string({ required: false }), // Has database default
    port: t.int({ required: true }),
    rconPassword: t.string({ required: true }),
    game: t.string({ required: false }),
    mod: t.string({ required: false }),
    publicAddress: t.string({ required: false }),
    statusUrl: t.string({ required: false }),
    connectionType: t.string({ required: false }), // Has database default "external"
    dockerHost: t.string({ required: false }), // Optional for Docker servers
    sortOrder: t.int({ required: false }),
  }),
})

// Safe server type without RCON password
const SafeServer = builder.objectRef<Omit<Server, "rconPassword">>("SafeServer")

SafeServer.implement({
  fields: (t) => ({
    serverId: t.exposeInt("serverId"),
    name: t.exposeString("name"),
    address: t.exposeString("address"),
    port: t.exposeInt("port"),
    game: t.exposeString("game"),
    publicAddress: t.exposeString("publicAddress"),
    statusUrl: t.exposeString("statusUrl", { nullable: true }),
    connectionType: t.exposeString("connectionType"),
    dockerHost: t.exposeString("dockerHost", { nullable: true }),
    sortOrder: t.exposeInt("sortOrder"),
  }),
})

// Result types for server operations
const ServerOperationResult = builder.objectRef<{
  success: boolean
  message: string
  server: Omit<Server, "rconPassword"> | null
  configsCount: number
}>("ServerOperationResult")

ServerOperationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    message: t.exposeString("message"),
    server: t.field({
      type: SafeServer,
      nullable: true,
      resolve: (result) => result.server,
    }),
    configsCount: t.exposeInt("configsCount"),
  }),
})

// Update server mutation
builder.mutationField("updateServerWithConfig", (t) =>
  t.field({
    type: ServerOperationResult,
    args: {
      serverId: t.arg.int({ required: true }),
      data: t.arg({ type: UpdateServerInput, required: true }),
    },
    resolve: async (_, { serverId, data }, context) => {
      try {
        // Use injected server service
        const serverService = context.services.server

        // Filter out null/undefined values and convert to the format expected by service
        const updateData: Record<string, string | number> = {}

        if (data.name !== null && data.name !== undefined) updateData.name = data.name
        if (data.address !== null && data.address !== undefined) updateData.address = data.address
        if (data.port !== null && data.port !== undefined) updateData.port = data.port
        if (data.publicAddress !== null && data.publicAddress !== undefined)
          updateData.publicAddress = data.publicAddress
        if (data.statusUrl !== null && data.statusUrl !== undefined)
          updateData.statusUrl = data.statusUrl
        if (data.game !== null && data.game !== undefined) updateData.game = data.game

        const server = await serverService.updateServer(serverId, updateData)

        // Remove RCON password from response for security
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { rconPassword, ...serverWithoutPassword } = server

        return {
          success: true,
          message: "Server updated successfully",
          server: serverWithoutPassword,
          configsCount: 0,
        }
      } catch (error) {
        return {
          success: false,
          message: `Failed to update server: ${error instanceof Error ? error.message : "Unknown error"}`,
          server: null,
          configsCount: 0,
        }
      }
    },
  }),
)

// Create server mutation
builder.mutationField("createServerWithConfig", (t) =>
  t.field({
    type: ServerOperationResult,
    args: {
      data: t.arg({ type: CreateServerInput, required: true }),
    },
    resolve: async (_, { data }, context) => {
      console.log("=== CREATE SERVER MUTATION START ===")
      console.log("Input data:", JSON.stringify(data, null, 2))
      console.log("Context services available:", Object.keys(context.services))
      try {
        // Use injected server service
        const serverService = context.services.server

        // Prepare input for createServerWithConfig
        const input = {
          name: data.name || undefined,
          address: data.address || undefined,
          port: data.port,
          game: data.game || "valve",
          mod: data.mod || undefined,
          rconPassword: data.rconPassword || undefined,
          publicAddress: data.publicAddress || undefined,
          statusUrl: data.statusUrl || undefined,
          connectionType: data.connectionType || undefined,
          dockerHost: data.dockerHost || undefined,
          sortOrder: data.sortOrder || undefined,
        }

        console.log("Creating server with config using input:", input)
        const result = await serverService.createServerWithConfig(input)
        console.log("Server created successfully with configs:", result.configsCount)

        // Remove RCON password from response for security
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { rconPassword, ...serverWithoutPassword } = result.server

        return {
          success: true,
          message: `Server created successfully with ${result.configsCount} configuration entries`,
          server: serverWithoutPassword,
          configsCount: result.configsCount,
        }
      } catch (error) {
        console.error("Error creating server:", error)
        console.error("Error details:", JSON.stringify(error, null, 2))
        if (error instanceof Error) {
          console.error("Error stack:", error.stack)
        }
        return {
          success: false,
          message: `Failed to create server: ${error instanceof Error ? error.message : "Unknown error"}`,
          server: null,
          configsCount: 0,
        }
      }
    },
  }),
)
