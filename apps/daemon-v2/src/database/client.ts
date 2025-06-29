/**
 * Database Client for HLStats Daemon v2
 *
 * Provides a centralized database client with connection management,
 * error handling, and transaction support for the daemon services.
 *
 */

import { db, type PrismaClient } from "@repo/database/client"

export class DatabaseClient {
  private client: PrismaClient

  constructor() {
    this.client = db
  }

  /**
   * Get the Prisma client instance
   */
  get prisma(): PrismaClient {
    return this.client
  }

  /**
   * Test database connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error("Database connection test failed:", error)
      return false
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (
      tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
    ) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(callback)
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    await this.client.$disconnect()
  }
}

export const databaseClient = new DatabaseClient()
