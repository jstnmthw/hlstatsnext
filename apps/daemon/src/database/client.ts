/**
 * Database Client for HLStats Daemon
 *
 * Wraps the shared singleton PrismaClient from @repo/database/client
 * with optional support for extended clients (e.g., with metrics).
 */

import { db, type PrismaClient } from "@repo/database/client"
import type { PrismaWithMetrics } from "@repo/observability"

export type TransactionalPrisma = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

/**
 * Daemon-specific database client wrapper
 *
 * Provides a wrapper around the shared db singleton with
 * optional support for extended Prisma clients (e.g., with metrics).
 */
export class DatabaseClient {
  private _prismaWithMetrics?: PrismaWithMetrics

  /**
   * Set the extended Prisma client (with metrics or other extensions)
   */
  setExtendedClient(extendedClient: PrismaWithMetrics): void {
    this._prismaWithMetrics = extendedClient
  }

  /**
   * Get the Prisma client instance
   * Returns extended client if available, otherwise base client
   */
  get prisma(): PrismaClient {
    return (this._prismaWithMetrics || db) as PrismaClient
  }

  /**
   * Execute a transaction with proper typing
   */
  async transaction<T>(callback: (tx: TransactionalPrisma) => Promise<T>): Promise<T> {
    const client = (this._prismaWithMetrics || db) as PrismaClient
    return client.$transaction(callback)
  }

  /**
   * Test database connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await db.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error("Database connection test failed:", error)
      return false
    }
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    await db.$disconnect()
  }
}

export const databaseClient = new DatabaseClient()
