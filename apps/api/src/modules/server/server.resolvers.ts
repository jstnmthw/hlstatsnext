import { builder } from "@/builder"
import {
  handleGraphQLResult,
  handleGraphQLResultNullable,
} from "@/shared/utils/graphql-result-handler"
import type { ServerWithStatus } from "./server.types"

// Define the ServerStatus type
const ServerStatus = builder.objectRef<ServerWithStatus>("ServerStatus")

ServerStatus.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    address: t.exposeString("address"),
    port: t.exposeInt("port"),
    name: t.exposeString("name", { nullable: true }),
    isOnline: t.exposeBoolean("isOnline"),
    lastActivity: t.expose("lastActivity", {
      type: "DateTime",
      nullable: true,
    }),
    playerCount: t.exposeInt("playerCount"),
  }),
})

// Add queries to the existing Query type
builder.queryFields((t) => ({
  // Get single server with status
  serverStatus: t.field({
    type: ServerStatus,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_parent, args, context) => {
      const result = await context.services.server.getServerWithStatus(args.id)
      return handleGraphQLResultNullable(result)
    },
  }),

  // Get all servers with status
  serversStatus: t.field({
    type: [ServerStatus],
    resolve: async (_parent, _args, context) => {
      const result = await context.services.server.getServersWithStatus()
      return handleGraphQLResult(result)
    },
  }),
}))
