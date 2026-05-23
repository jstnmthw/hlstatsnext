/**
 * Database Client for HLStats Daemon
 *
 * Wraps the shared singleton PrismaClient from @repo/db/client
 * with optional support for extended clients (e.g., with metrics).
 */

import { db, type PrismaClient } from "@repo/db/client"
import type { PrismaWithMetrics } from "@repo/observability"

export type TransactionalPrisma = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

/**
 * Options for interactive transactions. Defaults stay conservative (Prisma
 * defaults are `maxWait: 2_000`, `timeout: 5_000` ms) but bursty writers
 * under DB contention need more headroom; expose the knob.
 */
export interface TransactionOptions {
  /** Max ms a tx may wait for a free connection before throwing. */
  maxWait?: number
  /** Max ms a tx may stay open before Prisma auto-rolls back. */
  timeout?: number
  /** Isolation level passed through to Prisma. */
  isolationLevel?: "ReadUncommitted" | "ReadCommitted" | "RepeatableRead" | "Serializable"
}

/**
 * Daemon-specific database client wrapper
 *
 * Provides a wrapper around the shared db singleton with
 * optional support for extended Prisma clients (e.g., with metrics).
 */
export class DatabaseClient {
  private _prismaWithMetrics?: PrismaWithMetrics
  private lastConnectionCheck = 0
  private lastConnectionResult = false
  private static readonly CONNECTION_CHECK_CACHE_MS = 5_000

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
   * Execute a transaction with proper typing. Callers can override Prisma's
   * tight defaults (`maxWait: 2s`, `timeout: 5s`) when contention or batched
   * writes warrant it.
   */
  async transaction<T>(
    callback: (tx: TransactionalPrisma) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    const client = (this._prismaWithMetrics || db) as PrismaClient
    return client.$transaction(callback, options)
  }

  /**
   * Test database connectivity. Cached for 5s so the per-scrape Prometheus
   * call and k8s liveness probe don't each fire `SELECT 1` against the
   * primary.
   */
  async testConnection(): Promise<boolean> {
    const now = Date.now()
    if (now - this.lastConnectionCheck < DatabaseClient.CONNECTION_CHECK_CACHE_MS) {
      return this.lastConnectionResult
    }
    this.lastConnectionCheck = now
    try {
      const client = (this._prismaWithMetrics || db) as PrismaClient
      await client.$queryRaw`SELECT 1`
      this.lastConnectionResult = true
      return true
    } catch (error) {
      console.error("Database connection test failed:", error)
      this.lastConnectionResult = false
      return false
    }
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    const client = (this._prismaWithMetrics || db) as PrismaClient
    await client.$disconnect()
  }
}

export const databaseClient = new DatabaseClient()
