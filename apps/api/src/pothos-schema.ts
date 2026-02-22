import { generateAllMutations, generateAllObjects, generateAllQueries } from "@repo/db/graphql/crud"
import { builder } from "./builder"
import { requireAdmin } from "./context"

// Import custom secure object definitions (must come before generateAllObjects)
import "./modules/event-rcon/event-rcon.object"
import "./modules/server/server.object"

// Import custom resolvers
import "./modules/player/player.resolver"
import "./modules/server-token/server-token.resolver"
import "./modules/server/server.resolver"

// Define the base Query and Mutation types first
builder.queryType({})
builder.mutationType({})

// ─── Security: Model Exclusion Lists (RT-001, RT-002) ───────────────────────
// Auth models managed by Better Auth — never expose via GraphQL
const AUTH_MODELS = ["User", "Session", "Account", "Verification"] as const
// Models with fully custom resolvers that replace all auto-generated CRUD
const CUSTOM_MODELS = ["ServerToken"] as const
// Models with custom objects that strip sensitive fields (rconPassword, password)
const SENSITIVE_MODELS = ["Server", "EventRcon"] as const

const EXCLUDE_FROM_ALL = [...AUTH_MODELS, ...CUSTOM_MODELS] as const
const EXCLUDE_FROM_OBJECTS = [...EXCLUDE_FROM_ALL, ...SENSITIVE_MODELS] as const

// Register Pothos objects — exclude models handled by custom secure objects
generateAllObjects({ exclude: [...EXCLUDE_FROM_OBJECTS] })

// Register queries — exclude auth models and models with custom resolvers
generateAllQueries({ exclude: [...EXCLUDE_FROM_ALL] })

// Register mutations — require admin auth on all auto-generated mutations (RT-001)
generateAllMutations({
  exclude: [...EXCLUDE_FROM_ALL],
  handleResolver: ({ field, type }) => {
    if (type !== "Mutation") return field
    const originalResolve = field.resolve
    return {
      ...field,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wrapping untyped auto-generated resolvers
      resolve: (query: unknown, root: unknown, args: unknown, context: any, info: unknown) => {
        requireAdmin(context)
        return originalResolve(query, root, args, context, info)
      },
    }
  },
})

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
