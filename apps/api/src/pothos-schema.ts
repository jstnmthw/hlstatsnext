import { generateAllMutations, generateAllObjects, generateAllQueries } from "@repo/db/graphql/crud"
import { type GraphQLObjectType, isObjectType } from "graphql"
import { builder } from "./builder"
import { type Context, requireAdmin } from "./context"

// Import custom secure object definitions (must come before generateAllObjects)
import "./modules/event-connect/event-connect.object"
import "./modules/event-rcon/event-rcon.object"
import "./modules/player/player.object"
import "./modules/server/server.object"
import "./modules/user/user.object"

// Import custom resolvers
import "./modules/player/player.resolver"
import "./modules/server-token/server-token.resolver"
import "./modules/server/server.resolver"

// Define the base Query and Mutation types first
builder.queryType({})
builder.mutationType({})

// ─── Security: Model Exclusion Lists ────────────────────────────────────────
// Auth models managed by Better Auth — never expose via GraphQL
const AUTH_MODELS = ["Session", "Account", "Verification"] as const
// Models with fully custom resolvers that replace all auto-generated CRUD
const CUSTOM_MODELS = ["ServerToken"] as const
// Models with custom objects that strip sensitive fields (PII, credentials).
// Public queries remain enabled — the auto-generated `*WhereInput` types are
// post-processed by scripts/sanitize-pothos-inputs to strip filters on the
// same sensitive columns, preventing enumeration via filter binary-search.
const SENSITIVE_MODELS = ["Server", "EventRcon", "Player", "EventConnect"] as const
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
// admin-only models (those are registered separately with an auth guard).
// Note: SENSITIVE_MODELS queries are deliberately kept public — server lists
// are leaderboard data. Output-side protection comes from the custom secure
// objects above; input-side protection comes from the sanitize-pothos-inputs
// step that strips sensitive columns from auto-generated `*WhereInput` types.
generateAllQueries({ exclude: [...EXCLUDE_FROM_ALL, ...ADMIN_ONLY_MODELS] })

// Register admin-only queries (User) — gate every query behind requireAdmin
generateAllQueries({
  include: [...ADMIN_ONLY_MODELS],
  handleResolver: ({ field, type, isPrismaField }) =>
    type === "Query" ? requireAdminResolver({ field, isPrismaField }) : field,
})

// Register mutations — require admin auth on all auto-generated mutations
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

// ─── Runtime invariant: catch accidental sensitive-field exposure ───────────
// Defense in depth. If a contributor regenerates a custom secure object from
// the auto-gen template, this check throws at startup rather than silently
// shipping a credential through GraphQL.
const SENSITIVE_FIELD_PATTERN = /password|secret|token|hash|apikey/i
// Field allowlist — keep tightly scoped. These are non-credential fields that
// happen to match the pattern (e.g. `hasRconPassword` is a boolean, not a value).
const ALLOWED_FIELDS = new Set<`${string}.${string}`>([
  // ServerToken relation on Server — links to ServerToken object which itself
  // hides credentials (tokenHash, rconPassword) via its custom prismaObject.
  "Server.authToken",
  // FK column for the ServerToken relation — just an integer ID, not a credential.
  "Server.authTokenId",
  // ServerToken object's safe-by-design fields.
  "ServerToken.tokenPrefix",
  "ServerToken.hasRconPassword",
])

const SENSITIVE_OBJECT_TYPES = ["Player", "Server", "EventRcon", "EventConnect", "User"]

for (const typeName of SENSITIVE_OBJECT_TYPES) {
  const objectType = schema.getType(typeName)
  if (!objectType || !isObjectType(objectType)) continue
  const fields = (objectType as GraphQLObjectType).getFields()
  for (const fieldName of Object.keys(fields)) {
    const qualified = `${typeName}.${fieldName}` as const
    if (ALLOWED_FIELDS.has(qualified)) continue
    if (SENSITIVE_FIELD_PATTERN.test(fieldName)) {
      throw new Error(
        `[pothos-schema] Sensitive field "${qualified}" exposed via GraphQL. ` +
          `Field name matches /password|secret|token|hash|apiKey/i. ` +
          `Either remove the field from the custom object or add "${qualified}" to ALLOWED_FIELDS.`,
      )
    }
  }
}
