import { builder } from "./builder"
import { generateAllCrud } from "@repo/database/graphql/crud"

// Import custom resolvers (none currently needed)

// Define the base Query and Mutation types first
builder.queryType({})
builder.mutationType({})

// Generate all CRUD operations
generateAllCrud()

// Define HealthStatus type
const HealthStatus = builder.objectRef<{
  status: string
  timestamp: string
  version: string
}>("HealthStatus")

HealthStatus.implement({
  fields: (t) => ({
    status: t.exposeString("status"),
    timestamp: t.exposeString("timestamp"),
    version: t.exposeString("version"),
  }),
})

// Basic health check query
builder.queryField("health", (t) =>
  t.field({
    type: HealthStatus,
    resolve: () => ({
      status: "OK",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    }),
  }),
)

// Build and export the schema
export const schema = builder.toSchema({})
