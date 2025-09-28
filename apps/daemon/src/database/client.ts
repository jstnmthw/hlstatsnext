/**
 * Database Client for HLStats Daemon
 *
 * Re-exports the shared DatabaseClient from @repo/database/client
 * with daemon-specific configurations and types.
 */

import { DatabaseClient as SharedDatabaseClient, type PrismaClient } from "@repo/database/client"

export type TransactionalPrisma = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

/**
 * Daemon-specific database client extending the shared implementation
 */
export class DatabaseClient extends SharedDatabaseClient {
  /**
   * Get the Prisma client instance with transaction support
   */
  get prisma(): PrismaClient {
    return super.prisma
  }

  /**
   * Get the Prisma client instance for transactions (subset of methods)
   */
  get transactionalPrisma(): TransactionalPrisma {
    return super.prisma as TransactionalPrisma
  }

  /**
   * Execute a transaction with proper typing
   */
  async transaction<T>(callback: (tx: TransactionalPrisma) => Promise<T>): Promise<T> {
    return super.transaction(callback)
  }
}

export const databaseClient = new DatabaseClient()
