import { db } from "@repo/database"

/**
 * GraphQL context interface with strict typing
 */
export interface Context {
  readonly prisma: typeof db
}

/**
 * Create GraphQL context with dependency injection
 */
export function createContext(): Context {
  return {
    prisma: db,
  }
}
