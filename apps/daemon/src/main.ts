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

  /**
   * Stop the daemon
   */
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

  /**
   * Test the database connection
   */
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

  /**
   * Disconnect from the database
   */
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

  /**
   * Start RCON status monitoring
   */
  private async startRconStatusMonitoring(): Promise<void> {
    const statusInterval = parseInt(process.env.RCON_STATUS_INTERVAL || "30000", 10)
    const rconEnabled = process.env.RCON_ENABLED === "true"

    if (!rconEnabled) {
      this.logger.warn("RCON monitoring disabled by configuration")
      return
    }

    this.logger.ok(`Starting RCON status monitoring (interval: ${statusInterval}ms)`)

    // Start periodic status monitoring for servers with RCON configured
    setInterval(async () => {
      try {
        await this.monitorServerStatus()
      } catch (error) {
        this.logger.error(`Error in RCON status monitoring: ${error}`)
      }
    }, statusInterval)
  }

  /**
   * Monitor server status
   */
  private async monitorServerStatus(): Promise<void> {
    try {
      // Discover all active servers with RCON configured
      const activeServers = await this.context.serverService.findActiveServersWithRcon()
      
      if (activeServers.length === 0) {
        this.logger.warn("No active servers with RCON found for monitoring")
        return
      }

      this.logger.debug(`Found ${activeServers.length} active server(s) with RCON for monitoring`)

      // Monitor each active server
      for (const server of activeServers) {
        try {
          // Connect if not already connected
          if (!this.context.rconService.isConnected(server.serverId)) {
            this.logger.info(`🔌 Attempting RCON connection to server ${server.serverId} (${server.address}:${server.port})...`)
            await this.context.rconService.connect(server.serverId)
            this.logger.ok(`✅ RCON connected to server ${server.serverId} (${server.name})`)
          } else {
            this.logger.debug(`📡 RCON already connected to server ${server.serverId}, getting status...`)
          }

          // Get status and log it
          const status = await this.context.rconService.getStatus(server.serverId)

          this.logger.info(
            `📊 Server ${server.serverId} (${server.name}) - Map: ${status.map} | Players: ${status.players}/${status.maxPlayers} | FPS: ${status.fps}`,
          )

          if (status.hostname) {
            this.logger.debug(`🏷️ Server ${server.serverId} hostname: ${status.hostname}`)
          }
        } catch (error) {
          this.logger.error(
            `❌ RCON failed for server ${server.serverId} (${server.name}): ${error instanceof Error ? error.message : String(error)}`,
          )

          // Disconnect on error to force reconnection next time
          try {
            await this.context.rconService.disconnect(server.serverId)
          } catch (disconnectError) {
            this.logger.debug(`Error disconnecting from server ${server.serverId}: ${disconnectError}`)
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error discovering active servers for RCON monitoring: ${error}`)
    }
  }
}

/**
 * Main function
 */
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
