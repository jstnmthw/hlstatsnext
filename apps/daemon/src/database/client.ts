/**
 * Database Client for HLStats Daemon
 *
 * Provides a centralized database client with connection management,
 * error handling, and transaction support for the daemon services.
 *
 */

import { db, type PrismaClient } from "@repo/database/client"

export type TransactionalPrisma = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

export class DatabaseClient {
  private client: PrismaClient | TransactionalPrisma

  constructor(client: PrismaClient | TransactionalPrisma = db) {
    this.client = client
  }

  /**
   * Get the Prisma client instance
   */
  get prisma(): TransactionalPrisma {
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
  async transaction<T>(callback: (tx: TransactionalPrisma) => Promise<T>): Promise<T> {
    if ("$transaction" in this.client) {
      return this.client.$transaction(callback)
    }
    throw new Error("Cannot start a transaction within a transaction.")
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    if ("$disconnect" in this.client) {
      await this.client.$disconnect()
    }
  }
}

export const databaseClient = new DatabaseClient()
