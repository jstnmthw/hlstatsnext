import { generateAllMutations, generateAllObjects, generateAllQueries } from "@repo/db/graphql/crud"
import { builder } from "./builder"
import { type Context, requireAdmin } from "./context"

// Import custom secure object definitions (must come before generateAllObjects)
import "./modules/event-rcon/event-rcon.object"
import "./modules/server/server.object"
import "./modules/user/user.object"

// Import custom resolvers
import "./modules/player/player.resolver"
import "./modules/server-token/server-token.resolver"
import "./modules/server/server.resolver"

// Define the base Query and Mutation types first
builder.queryType({})
builder.mutationType({})

// ─── Security: Model Exclusion Lists (RT-001, RT-002) ───────────────────────
// Auth models managed by Better Auth — never expose via GraphQL
const AUTH_MODELS = ["Session", "Account", "Verification"] as const
// Models with fully custom resolvers that replace all auto-generated CRUD
const CUSTOM_MODELS = ["ServerToken"] as const
// Models with custom objects that strip sensitive fields (rconPassword, password)
const SENSITIVE_MODELS = ["Server", "EventRcon"] as const
// Models exposed to admins only: a custom object hides auth internals, the
// auto-generated queries are gated behind requireAdmin, and no auto-generated
// mutations are registered (user management goes through Better Auth).
const ADMIN_ONLY_MODELS = ["User"] as const

const EXCLUDE_FROM_ALL = [...AUTH_MODELS, ...CUSTOM_MODELS] as const
const EXCLUDE_FROM_OBJECTS = [
  ...EXCLUDE_FROM_ALL,
  ...SENSITIVE_MODELS,
  ...ADMIN_ONLY_MODELS,
] as const

// Wrap an auto-generated resolver so it requires admin auth before running.
// Handles both prismaField resolvers (query, root, args, context, info) and
// plain field resolvers (root, args, context, info).
const requireAdminResolver = ({
  field,
  isPrismaField,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wrapping untyped auto-generated resolvers
  field: any
  isPrismaField: boolean
}) => {
  const originalResolve = field.resolve
  if (isPrismaField) {
    return {
      ...field,
      resolve: (query: unknown, root: unknown, args: unknown, context: Context, info: unknown) => {
        requireAdmin(context)
        return originalResolve(query, root, args, context, info)
      },
    }
  }
  return {
    ...field,
    resolve: (root: unknown, args: unknown, context: Context, info: unknown) => {
      requireAdmin(context)
      return originalResolve(root, args, context, info)
    },
  }
}

// Register Pothos objects — exclude models handled by custom secure objects
generateAllObjects({ exclude: [...EXCLUDE_FROM_OBJECTS] })

// Register queries — exclude auth models, custom-resolver models, and
// admin-only models (those are registered separately with an auth guard)
generateAllQueries({ exclude: [...EXCLUDE_FROM_ALL, ...ADMIN_ONLY_MODELS] })

// Register admin-only queries (User) — gate every query behind requireAdmin
generateAllQueries({
  include: [...ADMIN_ONLY_MODELS],
  handleResolver: ({ field, type, isPrismaField }) =>
    type === "Query" ? requireAdminResolver({ field, isPrismaField }) : field,
})

// Register mutations — require admin auth on all auto-generated mutations (RT-001)
generateAllMutations({
  exclude: [...EXCLUDE_FROM_ALL, ...ADMIN_ONLY_MODELS],
  handleResolver: ({ field, type, isPrismaField }) =>
    type === "Mutation" ? requireAdminResolver({ field, isPrismaField }) : field,
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
