import "dotenv/config"
import type { PrismaClient as BasePrismaClient } from "../generated/prisma/client"
import { PrismaClient } from "../generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { ConnectionPool, type ConnectionPoolConfig, type DatabaseLogger } from "./connection-pool"

export function createAdapter(): PrismaMariaDb {
  return new PrismaMariaDb(process.env.DATABASE_URL!)
}

declare global {
  var cachedPrisma: BasePrismaClient
  var cachedConnectionPool: ConnectionPool
}

let prisma: BasePrismaClient
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({ adapter: createAdapter() })
} else {
  if (!global.cachedPrisma) {
    global.cachedPrisma = new PrismaClient({ adapter: createAdapter() })
  }
  prisma = global.cachedPrisma
}

export const db = prisma

/**
 * Enhanced database client with connection pooling support
 * Note: When using extensions, the extended client is stored internally
 * but returned as BasePrismaClient type for compatibility
 */
export class DatabaseClient {
  private client: BasePrismaClient
  private connectionPool?: ConnectionPool
  private isUsingPool = false
  private connectionMap = new Map<BasePrismaClient, string>()
  private poolLogger?: DatabaseLogger
  private poolConfig?: Partial<ConnectionPoolConfig>

  constructor(client: BasePrismaClient = db) {
    this.client = client
  }

  /**
   * Initialize connection pooling (lazy initialization)
   */
  private initializeConnectionPoolSync(
    logger: DatabaseLogger,
    config?: Partial<ConnectionPoolConfig>,
  ): void {
    if (this.isUsingPool) {
      return
    }

    // Use cached pool in development to prevent multiple pools
    if (process.env.NODE_ENV !== "production" && global.cachedConnectionPool) {
      this.connectionPool = global.cachedConnectionPool
      this.isUsingPool = true
      logger.debug("Using cached database connection pool")
      return
    }

    this.connectionPool = new ConnectionPool(config || {}, logger)
    this.isUsingPool = true

    // Cache in development
    if (process.env.NODE_ENV !== "production") {
      global.cachedConnectionPool = this.connectionPool
    }

    logger.debug("Database connection pool initialized")
  }

  /**
   * Configure connection pooling (call this during setup)
   */
  configureConnectionPool(logger: DatabaseLogger, config?: Partial<ConnectionPoolConfig>): void {
    this.poolLogger = logger
    this.poolConfig = config
  }

  /**
   * Get the default Prisma client instance
   */
  get prisma(): BasePrismaClient {
    return this.client
  }

  /**
   * Get a pooled connection (if pooling is enabled)
   */
  async getPooledConnection(): Promise<BasePrismaClient> {
    // Lazy initialization of connection pool
    if (!this.connectionPool && this.poolLogger) {
      this.initializeConnectionPoolSync(this.poolLogger, this.poolConfig)
    }

    if (!this.connectionPool) {
      // Return default client if pooling not configured
      return this.client
    }
    const connection = await this.connectionPool.acquire()
    this.connectionMap.set(connection.client, connection.id)
    return connection.client
  }

  /**
   * Release a pooled connection
   */
  releasePooledConnection(client: BasePrismaClient): void {
    if (!this.connectionPool) {
      // No-op if pooling not enabled
      return
    }

    const connectionId = this.connectionMap.get(client)
    if (!connectionId) {
      throw new Error("Connection not found in pool tracking map")
    }

    // Find and release the connection
    const connections = this.connectionPool.connections
    const connection = connections.get(connectionId)

    if (connection) {
      this.connectionPool.release(connection)
      this.connectionMap.delete(client)
    }
  }

  /**
   * Get connection pool metrics
   */
  getPoolMetrics() {
    if (!this.connectionPool) {
      throw new Error("Connection pool not initialized.")
    }
    return this.connectionPool.getMetrics()
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
      tx: Omit<BasePrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">,
    ) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(callback)
  }

  /**
   * Close database connection and pool
   */
  async disconnect(): Promise<void> {
    if (this.connectionPool) {
      await this.connectionPool.shutdown()
      this.connectionPool = undefined
      this.isUsingPool = false
      this.connectionMap.clear()
    }

    await this.client.$disconnect()
  }
}

export { PrismaClient } from "../generated/prisma/client"
export { Prisma } from "../generated/prisma/client"
export type * from "../generated/prisma/client"
export { ConnectionPool, type ConnectionPoolConfig, type DatabaseLogger } from "./connection-pool"
