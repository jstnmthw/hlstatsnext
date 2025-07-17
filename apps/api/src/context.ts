import { db } from "@repo/database/client"
import { ServerService } from "@/modules/server"

/**
 * Services container for dependency injection
 */
interface Services {
  readonly server: ServerService
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
  const services: Services = {
    server: new ServerService(db),
  }

  return {
    prisma: db,
    services,
  }
}
