import { db, type Server } from "@repo/db/client"
import { builder } from "../../builder"
import { requireAdmin } from "../../context"

// Input type for updating servers
const UpdateServerInput = builder.inputType("UpdateServerInput", {
  fields: (t) => ({
    name: t.string({ required: false }),
    address: t.string({ required: false }),
    port: t.int({ required: false }),
    publicAddress: t.string({ required: false }),
    rconAddress: t.string({ required: false }),
    statusUrl: t.string({ required: false }),
    game: t.string({ required: false }),
    mod: t.string({ required: false }),
    rconPassword: t.string({ required: false }),
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
    rconAddress: t.string({ required: false }),
    statusUrl: t.string({ required: false }),
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
    rconAddress: t.exposeString("rconAddress"),
    statusUrl: t.exposeString("statusUrl", { nullable: true }),
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
      requireAdmin(context)

      try {
        const serverService = context.services.server

        // Filter out null/undefined values and convert to the format expected by service
        const updateData: Record<string, string | number | null> = {}

        if (data.name !== null && data.name !== undefined) updateData.name = data.name
        if (data.address !== null && data.address !== undefined) updateData.address = data.address
        if (data.port !== null && data.port !== undefined) updateData.port = data.port
        if (data.publicAddress !== null && data.publicAddress !== undefined)
          updateData.publicAddress = data.publicAddress
        if (data.rconAddress !== null && data.rconAddress !== undefined)
          updateData.rconAddress = data.rconAddress
        if (data.statusUrl !== null && data.statusUrl !== undefined)
          updateData.statusUrl = data.statusUrl
        if (data.game !== null && data.game !== undefined) updateData.game = data.game
        if (data.mod !== null && data.mod !== undefined) updateData.mod = data.mod
        if (data.rconPassword !== null && data.rconPassword !== undefined)
          updateData.rconPassword = data.rconPassword
        if (data.sortOrder !== null && data.sortOrder !== undefined)
          updateData.sortOrder = data.sortOrder

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
        // Don't leak Prisma column/constraint names to the client. Log inner
        // error for diagnostics; return a generic user-facing message.
        console.error(
          "[server.resolver] updateServerWithConfig failed:",
          error instanceof Error ? error.message : String(error),
        )
        return {
          success: false,
          message: "Failed to update server",
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
      requireAdmin(context)

      try {
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
          rconAddress: data.rconAddress || undefined,
          statusUrl: data.statusUrl || undefined,
          sortOrder: data.sortOrder || undefined,
        }

        const result = await serverService.createServerWithConfig(input)

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
        console.error(
          "[server.resolver] createServerWithConfig failed:",
          error instanceof Error ? error.message : String(error),
        )
        return {
          success: false,
          message: "Failed to create server",
          server: null,
          configsCount: 0,
        }
      }
    },
  }),
)

// Total kills across all servers — single aggregate query rather than the
// previous client-side sum over `findManyServer { kills }` which loaded
// every server row just to add up one column.
builder.queryField("getTotalKills", (t) =>
  t.int({
    resolve: async () => {
      const result = await db.server.aggregate({ _sum: { kills: true } })
      return result._sum.kills ?? 0
    },
  }),
)
