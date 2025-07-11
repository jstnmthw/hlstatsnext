import { builder } from "./builder"
import { GraphQL } from "@repo/database"

// Generate all CRUD operations
GraphQL.generateAllCrud()

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
