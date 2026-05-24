import { auth, type Session } from "@repo/auth"
import { createCryptoService, type ICryptoService } from "@repo/crypto"
import { db } from "@repo/db/client"
import { GraphQLError } from "graphql"
import { AuthService } from "./modules/auth/auth.service"
import { ServerTokenService } from "./modules/server-token/server-token.service"
import { ServerService } from "./modules/server/server.service"

/**
 * Services container for dependency injection
 */
interface Services {
  readonly crypto: ICryptoService
  readonly server: ServerService
  readonly auth: AuthService
  readonly serverToken: ServerTokenService
}

/**
 * GraphQL context interface with strict typing
 */
export interface Context {
  readonly prisma: typeof db
  readonly services: Services
  readonly session: Session | null
}

/** Throw if the request has no valid session. */
export function requireAuth(ctx: Context): NonNullable<Session> {
  if (!ctx.session) {
    throw new GraphQLError("Authentication required", {
      extensions: { code: "UNAUTHENTICATED" },
    })
  }
  return ctx.session
}

/** Throw if the request is not from an admin. */
export function requireAdmin(ctx: Context): NonNullable<Session> {
  const session = requireAuth(ctx)
  if (session.user.role !== "admin") {
    throw new GraphQLError("Admin access required", {
      extensions: { code: "FORBIDDEN" },
    })
  }
  return session
}

/**
 * Wrap a custom Pothos field config so its `resolve` runs only for admins.
 *
 * NOTE: Pothos derives the `resolve` arg/return types from the literal config
 * passed to `t.field`/`t.prismaField`. Routing the config through this generic
 * helper severs that inference, so `args` collapses to `{}` and TypeScript
 * rejects the field. Until we wrap admin gating in a real Pothos plugin /
 * field-builder method, prefer calling `requireAdmin(context)` inline inside
 * the resolver. The helper is kept for resolvers that take no args
 * (or where you're willing to annotate types manually).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- wraps untyped Pothos field configs
export function requireAdminField<TFieldConfig extends { resolve: (...args: any[]) => any }>(
  field: TFieldConfig,
): TFieldConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- internal wrapping; outer type stays TFieldConfig
  const originalResolve = field.resolve as (...args: any[]) => any
  // Detect prismaField (5 args: query, root, args, context, info) vs plain field (4 args)
  const isPrismaField = originalResolve.length === 5
  const wrappedResolve = isPrismaField
    ? (query: unknown, root: unknown, args: unknown, context: Context, info: unknown) => {
        requireAdmin(context as Context)
        return originalResolve(query, root, args, context, info)
      }
    : (root: unknown, args: unknown, context: Context, info: unknown) => {
        requireAdmin(context as Context)
        return originalResolve(root, args, context, info)
      }
  // Cast back to TFieldConfig — the wrapped resolver has a deliberately broader
  // signature than the original, but at the GraphQL boundary it is invoked
  // with the same args. Preserving TFieldConfig keeps Pothos's inferred arg
  // and return types intact at all call sites.
  return { ...field, resolve: wrappedResolve } as unknown as TFieldConfig
}

// Singleton services (created once, reused across requests)
let services: Services | null = null

function getServices(): Services {
  if (!services) {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error("ENCRYPTION_KEY environment variable is required")
    }
    const crypto = createCryptoService()
    services = {
      crypto,
      server: new ServerService(crypto),
      auth: new AuthService(crypto),
      serverToken: new ServerTokenService(crypto),
    }
  }
  return services
}

/**
 * Create GraphQL context with dependency injection and session
 */
export async function createContext({ request }: { request: Request }): Promise<Context> {
  const session = await auth.api.getSession({ headers: request.headers })

  return {
    prisma: db,
    services: getServices(),
    session,
  }
}
