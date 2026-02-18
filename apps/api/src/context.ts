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
