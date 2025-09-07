import { db } from "@repo/database/client"
import { createCryptoService, type ICryptoService } from "@repo/crypto"
import { ServerService } from "./modules/server/server.service"
import { AuthService } from "./modules/auth/auth.service"

/**
 * Services container for dependency injection
 */
interface Services {
  readonly crypto: ICryptoService
  readonly server: ServerService
  readonly auth: AuthService
}

/**
 * GraphQL context interface with strict typing
 */
export interface Context {
  readonly prisma: typeof db
  readonly services: Services
}

/**
 * Create GraphQL context with dependency injection
 */
export function createContext(): Context {
  // Require encryption key in all environments
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY environment variable is required")
  }

  const crypto = createCryptoService()

  const services: Services = {
    crypto,
    server: new ServerService(crypto),
    auth: new AuthService(crypto),
  }

  return {
    prisma: db,
    services,
  }
}
