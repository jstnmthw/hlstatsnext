import { db } from "@repo/database/client"

/**
 * Services container for dependency injection
 * Currently empty - all operations handled by generated CRUD resolvers
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Services {
  // Reserved for future custom services
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
    // No custom services currently needed
  }

  return {
    prisma: db,
    services,
  }
}
