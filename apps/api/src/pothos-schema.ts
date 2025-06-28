import { builder } from "./builder"
import { generateAllCrud } from "@repo/database/graphql/crud"

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

// Hello world query
builder.queryField("hello", (t) =>
  t.string({
    resolve: () => "Hello from HLStatsNext API!",
  }),
)

// Build and export the schema
export const schema = builder.toSchema({})
