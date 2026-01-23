/**
 * Database Client for HLStats Daemon
 *
 * Re-exports the shared DatabaseClient from @repo/database/client.
 * Provides type-safe access to Prisma client with optional extensions.
 */

import { DatabaseClient as SharedDatabaseClient, type PrismaClient } from "@repo/database/client"
import type { PrismaWithMetrics } from "@repo/observability"

export type TransactionalPrisma = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

/**
 * Daemon-specific database client wrapper
 *
 * Provides a simple wrapper around the shared DatabaseClient with
 * optional support for extended Prisma clients (e.g., with metrics).
 */
export class DatabaseClient {
  private _prismaWithMetrics?: PrismaWithMetrics

  constructor(private sharedClient: SharedDatabaseClient = new SharedDatabaseClient()) {}

  /**
   * Set the extended Prisma client (with metrics or other extensions)
   */
  setExtendedClient(extendedClient: PrismaWithMetrics): void {
    this._prismaWithMetrics = extendedClient
  }

  /**
   * Get the Prisma client instance
   * Returns extended client if available, otherwise base client
   * The return type is always treated as base PrismaClient for compatibility
   */
  get prisma(): PrismaClient {
    return (this._prismaWithMetrics || this.sharedClient.prisma) as PrismaClient
  }

  /**
   * Get the Prisma client instance for transactions
   */
  get transactionalPrisma(): TransactionalPrisma {
    const client = this._prismaWithMetrics || this.sharedClient.prisma
    return client as unknown as TransactionalPrisma
  }

  /**
   * Execute a transaction with proper typing
   */
  async transaction<T>(callback: (tx: TransactionalPrisma) => Promise<T>): Promise<T> {
    const client = (this._prismaWithMetrics || this.sharedClient.prisma) as PrismaClient
    return client.$transaction(callback)
  }

  /**
   * Configure connection pooling
   */
  configureConnectionPool(
    ...args: Parameters<SharedDatabaseClient["configureConnectionPool"]>
  ): void {
    this.sharedClient.configureConnectionPool(...args)
  }

  /**
   * Test database connectivity
   */
  async testConnection(): Promise<boolean> {
    return this.sharedClient.testConnection()
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    return this.sharedClient.disconnect()
  }
}

export const databaseClient = new DatabaseClient()
