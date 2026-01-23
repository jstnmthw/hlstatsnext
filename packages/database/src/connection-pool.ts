/**
 * Database Connection Pool
 *
 * Manages database connections with pooling, health checks, and metrics.
 */

import { db, type PrismaClient } from "./client"

// Minimal logger interface that applications must implement
// This allows the database package to be logger-agnostic
export interface DatabaseLogger {
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, meta?: any): void
  debug(message: string, meta?: any): void
  ok(message: string, meta?: any): void
}

export interface ConnectionPoolConfig {
  /** Maximum number of connections in the pool */
  maxConnections: number

  /** Minimum number of connections to maintain */
  minConnections: number

  /** Timeout in milliseconds for acquiring a connection */
  connectionTimeout: number

  /** Maximum time in milliseconds a connection can be idle */
  idleTimeout: number

  /** Health check interval in milliseconds */
  healthCheckInterval: number

  /** Maximum number of retries for connection operations */
  maxRetries: number
}

export interface ConnectionMetrics {
  /** Total connections in pool */
  totalConnections: number

  /** Currently active connections */
  activeConnections: number

  /** Currently idle connections */
  idleConnections: number

  /** Total number of connection requests */
  totalRequests: number

  /** Number of failed connection attempts */
  failedConnections: number

  /** Average connection acquisition time in milliseconds */
  avgAcquisitionTime: number

  /** Pool health status */
  healthStatus: "healthy" | "degraded" | "unhealthy"
}

interface PooledConnection {
  client: PrismaClient
  id: string
  createdAt: Date
  lastUsed: Date
  isActive: boolean
  isHealthy: boolean
}

/**
 * Database Connection Pool
 *
 * Manages a pool of database connections for optimal performance.
 */
export class ConnectionPool {
  private readonly config: ConnectionPoolConfig
  private readonly logger: DatabaseLogger
  private readonly _connections = new Map<string, PooledConnection>()

  /** Public read-only access to connections for external monitoring */
  get connections(): ReadonlyMap<string, PooledConnection> {
    return this._connections
  }
  private readonly waitingQueue: Array<{
    resolve: (connection: PooledConnection) => void
    reject: (error: Error) => void
    requestedAt: Date
  }> = []

  private healthCheckInterval?: NodeJS.Timeout
  private metrics: ConnectionMetrics
  private isShuttingDown = false

  constructor(config: Partial<ConnectionPoolConfig>, logger: DatabaseLogger) {
    this.config = {
      maxConnections: 10,
      minConnections: 2,
      connectionTimeout: 30000, // 30 seconds
      idleTimeout: 300000, // 5 minutes
      healthCheckInterval: 60000, // 1 minute
      maxRetries: 3,
      ...config,
    }

    this.logger = logger
    this.metrics = this.initializeMetrics()

    this.initialize()
  }

  /**
   * Initialize the connection pool
   */
  private async initialize(): Promise<void> {
    try {
      this.logger.info("Initializing database connection pool", {
        maxConnections: this.config.maxConnections,
        minConnections: this.config.minConnections,
      })

      // Create minimum number of connections
      for (let i = 0; i < this.config.minConnections; i++) {
        await this.createConnection()
      }

      // Start health check interval
      this.startHealthChecks()

      this.logger.ok(
        `Database connection pool initialized with ${this._connections.size} connections`,
      )
    } catch (error) {
      this.logger.error("Failed to initialize connection pool", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<PooledConnection> {
    if (this.isShuttingDown) {
      throw new Error("Connection pool is shutting down")
    }

    const startTime = Date.now()
    this.metrics.totalRequests++

    try {
      // Try to get an idle connection
      const idleConnection = this.findIdleConnection()
      if (idleConnection) {
        idleConnection.isActive = true
        idleConnection.lastUsed = new Date()
        this.updateMetrics()

        const acquisitionTime = Date.now() - startTime
        this.updateAverageAcquisitionTime(acquisitionTime)

        this.logger.debug("Acquired existing connection", {
          connectionId: idleConnection.id,
          acquisitionTime,
        })

        return idleConnection
      }

      // Create new connection if under limit
      if (this._connections.size < this.config.maxConnections) {
        const newConnection = await this.createConnection()
        newConnection.isActive = true

        const acquisitionTime = Date.now() - startTime
        this.updateAverageAcquisitionTime(acquisitionTime)

        this.logger.debug("Created new connection", {
          connectionId: newConnection.id,
          acquisitionTime,
        })

        return newConnection
      }

      // Wait for available connection
      return await this.waitForConnection(startTime)
    } catch (error) {
      this.metrics.failedConnections++
      this.logger.error("Failed to acquire connection", {
        error: error instanceof Error ? error.message : String(error),
        acquisitionTime: Date.now() - startTime,
      })
      throw error
    }
  }

  /**
   * Release a connection back to the pool
   */
  release(connection: PooledConnection): void {
    const poolConnection = this._connections.get(connection.id)
    if (!poolConnection) {
      this.logger.warn("Attempted to release unknown connection", {
        connectionId: connection.id,
      })
      return
    }

    poolConnection.isActive = false
    poolConnection.lastUsed = new Date()

    // Notify waiting requests
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()
      if (waiter) {
        poolConnection.isActive = true
        waiter.resolve(poolConnection)

        const waitTime = Date.now() - waiter.requestedAt.getTime()
        this.updateAverageAcquisitionTime(waitTime)
      }
    }

    this.updateMetrics()

    this.logger.debug("Released connection", {
      connectionId: connection.id,
      waitingQueue: this.waitingQueue.length,
    })
  }

  /**
   * Get pool metrics
   */
  getMetrics(): ConnectionMetrics {
    this.updateMetrics()
    return { ...this.metrics }
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true

    this.logger.info("Shutting down connection pool...")

    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    // Reject waiting requests
    while (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()
      if (waiter) {
        waiter.reject(new Error("Connection pool is shutting down"))
      }
    }

    // Close all connections
    const disconnectPromises = Array.from(this._connections.values()).map(async (conn) => {
      try {
        await conn.client.$disconnect()
      } catch (error) {
        this.logger.warn("Error disconnecting connection", {
          connectionId: conn.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    await Promise.allSettled(disconnectPromises)
    this._connections.clear()

    this.logger.info("Connection pool shutdown complete")
  }

  /**
   * Create a new database connection
   */
  private async createConnection(): Promise<PooledConnection> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    try {
      // Create new Prisma client instance
      const client = new (db.constructor as typeof PrismaClient)() as PrismaClient
      await client.$connect()

      const connection: PooledConnection = {
        client,
        id: connectionId,
        createdAt: new Date(),
        lastUsed: new Date(),
        isActive: false,
        isHealthy: true,
      }

      this._connections.set(connectionId, connection)
      this.updateMetrics()

      this.logger.debug("Created database connection", {
        connectionId,
        totalConnections: this._connections.size,
      })

      return connection
    } catch (error) {
      this.logger.error("Failed to create database connection", {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Find an idle connection
   */
  private findIdleConnection(): PooledConnection | null {
    for (const connection of this._connections.values()) {
      if (!connection.isActive && connection.isHealthy) {
        return connection
      }
    }
    return null
  }

  /**
   * Wait for an available connection
   */
  private async waitForConnection(startTime: number): Promise<PooledConnection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from queue
        const index = this.waitingQueue.findIndex((w) => w.resolve === resolve)
        if (index >= 0) {
          this.waitingQueue.splice(index, 1)
        }

        const waitTime = Date.now() - startTime
        reject(new Error(`Connection timeout after ${waitTime}ms`))
      }, this.config.connectionTimeout)

      this.waitingQueue.push({
        resolve: (connection) => {
          clearTimeout(timeout)
          const acquisitionTime = Date.now() - startTime
          this.updateAverageAcquisitionTime(acquisitionTime)
          resolve(connection)
        },
        reject: (error) => {
          clearTimeout(timeout)
          reject(error)
        },
        requestedAt: new Date(startTime),
      })
    })
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck()
      this.cleanupIdleConnections()
    }, this.config.healthCheckInterval)
  }

  /**
   * Perform health check on all connections
   */
  private async performHealthCheck(): Promise<void> {
    const healthCheckPromises = Array.from(this._connections.values()).map(async (conn) => {
      if (!conn.isActive) {
        try {
          await conn.client.$queryRaw`SELECT 1`
          conn.isHealthy = true
        } catch (error) {
          conn.isHealthy = false
          this.logger.warn("Connection health check failed", {
            connectionId: conn.id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    })

    await Promise.allSettled(healthCheckPromises)
    this.updateMetrics()
  }

  /**
   * Clean up idle connections that have exceeded the idle timeout
   */
  private cleanupIdleConnections(): void {
    const now = Date.now()
    const connectionsToRemove: string[] = []

    for (const [id, connection] of this._connections) {
      if (
        !connection.isActive &&
        now - connection.lastUsed.getTime() > this.config.idleTimeout &&
        this._connections.size > this.config.minConnections
      ) {
        connectionsToRemove.push(id)
      }
    }

    for (const id of connectionsToRemove) {
      const connection = this._connections.get(id)
      if (connection) {
        connection.client.$disconnect().catch(() => {
          // Ignore disconnect errors during cleanup
        })
        this._connections.delete(id)

        this.logger.debug("Cleaned up idle connection", {
          connectionId: id,
          totalConnections: this._connections.size,
        })
      }
    }

    if (connectionsToRemove.length > 0) {
      this.updateMetrics()
    }
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): ConnectionMetrics {
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      totalRequests: 0,
      failedConnections: 0,
      avgAcquisitionTime: 0,
      healthStatus: "healthy",
    }
  }

  /**
   * Update connection metrics
   */
  private updateMetrics(): void {
    this.metrics.totalConnections = this._connections.size
    this.metrics.activeConnections = Array.from(this._connections.values()).filter(
      (c) => c.isActive,
    ).length
    this.metrics.idleConnections = this.metrics.totalConnections - this.metrics.activeConnections

    // Determine health status
    const healthyConnections = Array.from(this._connections.values()).filter(
      (c) => c.isHealthy,
    ).length
    const healthRatio = healthyConnections / this.metrics.totalConnections

    if (healthRatio >= 0.8) {
      this.metrics.healthStatus = "healthy"
    } else if (healthRatio >= 0.5) {
      this.metrics.healthStatus = "degraded"
    } else {
      this.metrics.healthStatus = "unhealthy"
    }
  }

  /**
   * Update average acquisition time
   */
  private updateAverageAcquisitionTime(newTime: number): void {
    // Simple moving average
    const alpha = 0.1 // Weight for new measurements
    this.metrics.avgAcquisitionTime =
      this.metrics.avgAcquisitionTime * (1 - alpha) + newTime * alpha
  }
}
