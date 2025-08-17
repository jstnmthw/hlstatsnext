/**
 * HLStatsNext Daemon - Main Application
 *
 * Refactored to use modular architecture with dependency injection.
 */

// Load environment variables from .env file
import dotenv from "dotenv"
dotenv.config()

import { getAppContext, initializeQueueInfrastructure } from "@/context"
import type { AppContext } from "@/context"
import type { ILogger } from "@/shared/utils/logger.types"
import type { BaseEvent } from "@/shared/types/events"

export class HLStatsDaemon {
  private context: AppContext
  private logger: ILogger

  constructor() {
    // Determine environment and skip auth in development
    const appEnv = process.env.NODE_ENV ?? "development"
    const ingressOptions = {
      skipAuth: appEnv === "development",
      port: process.env.INGRESS_PORT ? parseInt(process.env.INGRESS_PORT, 10) : undefined,
    }

    this.context = getAppContext(ingressOptions)
    this.logger = this.context.logger

    this.logger.info("Initializing HLStatsNext Daemon...")
  }

  async start(): Promise<void> {
    try {
      // Test database connectivity first
      this.logger.connecting("database")
      const dbConnected = await this.testDatabaseConnection()

      if (!dbConnected) {
        throw new Error("Failed to connect to database")
      }

      this.logger.connected("database")

      // Initialize queue infrastructure (dual publishing)
      await initializeQueueInfrastructure(this.context)

      // Start all services through the context
      this.logger.info("Starting services")
      await Promise.all([
        this.context.ingressService.start(),
        this.startRconStatusMonitoring(),
        // Other services can be started here as needed
      ])

      this.logger.ok("All services started successfully")
      this.logger.ready("HLStatsNext Daemon is ready to receive game server data")
    } catch (error) {
      this.logger.failed(
        "Failed to start daemon",
        error instanceof Error ? error.message : String(error),
      )
      process.exit(1)
    }
  }

  async stop(): Promise<void> {
    this.logger.shutdown()

    try {
      await Promise.all([
        this.context.ingressService.stop(),
        this.context.rconService.disconnectAll(),
        // Shutdown queue module if available
        this.context.queueModule?.shutdown() || Promise.resolve(),
        // Other cleanup as needed
      ])
      await this.disconnectDatabase()

      this.logger.shutdownComplete()
    } catch (error) {
      this.logger.failed(
        "Error during shutdown",
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  /**
   * Emit events through the queue publisher (EventProcessor removed)
   */
  async emitEvents(events: BaseEvent[]): Promise<void> {
    if (!this.context.eventPublisher) {
      throw new Error("Event publisher not initialized")
    }

    for (const event of events) {
      await this.context.eventPublisher.publish(event)
    }
  }

  /**
   * Get access to the application context for testing or advanced usage
   */
  getContext(): AppContext {
    return this.context
  }

  private async testDatabaseConnection(): Promise<boolean> {
    try {
      return await this.context.database.testConnection()
    } catch (error) {
      this.logger.failed(
        "Database connection test failed",
        error instanceof Error ? error.message : String(error),
      )
      return false
    }
  }

  private async disconnectDatabase(): Promise<void> {
    try {
      await this.context.database.disconnect()
      this.logger.info("Database connection closed")
    } catch (error) {
      this.logger.failed(
        "Error closing database connection",
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  private async startRconStatusMonitoring(): Promise<void> {
    this.logger.info("Starting RCON status monitoring")
    
    // Start periodic status monitoring for servers with RCON configured
    setInterval(async () => {
      try {
        await this.monitorServerStatus()
      } catch (error) {
        this.logger.error(`Error in RCON status monitoring: ${error}`)
      }
    }, 30000) // Monitor every 30 seconds
  }

  private async monitorServerStatus(): Promise<void> {
    // Get all servers that have RCON configured
    // For now, we'll start with a simple implementation that checks server 1
    // This can be enhanced to discover servers from database
    
    const testServerId = 1
    
    try {
      // Check if server has RCON credentials
      const hasRcon = await this.context.serverService.hasRconCredentials(testServerId)
      if (!hasRcon) {
        this.logger.debug(`Server ${testServerId} has no RCON configured, skipping`)
        return
      }

      // Connect if not already connected
      if (!this.context.rconService.isConnected(testServerId)) {
        this.logger.info(`Connecting to server ${testServerId} via RCON`)
        await this.context.rconService.connect(testServerId)
      }

      // Get status and log it
      const status = await this.context.rconService.getStatus(testServerId)
      
      this.logger.info(`Server ${testServerId} status:`, {
        map: status.map,
        players: `${status.players}/${status.maxPlayers}`,
        fps: status.fps,
        hostname: status.hostname,
      })

    } catch (error) {
      this.logger.warn(`Failed to get status for server ${testServerId}: ${error}`)
      
      // Disconnect on error to force reconnection next time
      try {
        await this.context.rconService.disconnect(testServerId)
      } catch (disconnectError) {
        this.logger.debug(`Error disconnecting from server ${testServerId}: ${disconnectError}`)
      }
    }
  }
}

function main() {
  // Handle graceful shutdown
  const daemon = new HLStatsDaemon()

  process.on("SIGINT", async () => {
    daemon.getContext().logger.received("SIGINT")
    await daemon.stop()
    process.exit(0)
  })

  process.on("SIGTERM", async () => {
    daemon.getContext().logger.received("SIGTERM")
    await daemon.stop()
    process.exit(0)
  })

  // Start the daemon
  daemon.start().catch((error) => {
    daemon.getContext().logger.fatal(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}

// This allows the file to be imported for testing without executing the startup logic.
if (process.env.VITEST === undefined) {
  main()
}
