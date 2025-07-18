/**
 * HLStatsNext Daemon - Main Entry Point
 *
 * Modern TypeScript rewrite of the legacy Perl HLstatsX daemon.
 * Collects and processes statistics from Half-Life dedicated game servers.
 */

import { DatabaseClient } from "./database/client"
import { IngressService } from "./services/ingress/ingress.service"
import { createEventProcessorService } from "./services/processor/processor.service"
import { RconService } from "./services/rcon/rcon.service"
import { StatisticsService } from "./services/statistics/statistics.service"
import { logger } from "./utils/logger"
import type { IEventProcessor } from "./services/processor/processor.types"

export class HLStatsDaemon {
  private db: DatabaseClient
  private ingress: IngressService
  private processor: IEventProcessor
  private rcon: RconService
  private statistics: StatisticsService

  constructor() {
    logger.info("Initializing HLStatsNext Daemon")

    this.db = new DatabaseClient()
    this.processor = createEventProcessorService()
    this.ingress = new IngressService(27500, this.processor, this.db)
    this.rcon = new RconService()
    this.statistics = new StatisticsService()
  }

  async start(): Promise<void> {
    try {
      // Test database connectivity first
      logger.connecting("database")
      const dbConnected = await this.testDatabaseConnection()

      if (!dbConnected) {
        throw new Error("Failed to connect to database")
      }

      logger.connected("database")

      // Start all services
      logger.info("Starting services")
      await Promise.all([
        this.ingress.start(),
        this.rcon.start(),
        this.statistics.start(),
      ])

      logger.ok("All services started successfully")
      logger.ready("HLStatsNext Daemon is ready to receive game server data")
    } catch (error) {
      logger.failed(
        "Failed to start daemon",
        error instanceof Error ? error.message : String(error),
      )
      process.exit(1)
    }
  }

  async stop(): Promise<void> {
    logger.shutdown()

    try {
      await Promise.all([
        this.ingress.stop(),
        this.rcon.stop(),
        this.statistics.stop(),
      ])
      await this.disconnectDatabase()

      logger.shutdownComplete()
    } catch (error) {
      logger.failed("Error during shutdown", error instanceof Error ? error.message : String(error))
    }
  }

  private async testDatabaseConnection(): Promise<boolean> {
    try {
      // Test database connectivity using the DatabaseClient method
      return await this.db.testConnection()
    } catch (error) {
      logger.failed("Database connection test failed", error instanceof Error ? error.message : String(error))
      return false
    }
  }

  private async disconnectDatabase(): Promise<void> {
    try {
      await this.db.disconnect()
      logger.info("Database connection closed")
    } catch (error) {
      logger.failed("Error closing database connection", error instanceof Error ? error.message : String(error))
    }
  }
}

function main() {
  // Handle graceful shutdown
  const daemon = new HLStatsDaemon()

  process.on("SIGINT", async () => {
    logger.received("SIGINT")
    await daemon.stop()
    process.exit(0)
  })

  process.on("SIGTERM", async () => {
    logger.received("SIGTERM")
    await daemon.stop()
    process.exit(0)
  })

  // Start the daemon
  daemon.start().catch((error) => {
    logger.fatal(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })

  logger.ok("🚀 HLStatsNext Daemon started")
}

// This allows the file to be imported for testing without executing the startup logic.
// Vitest automatically sets the process.env.VITEST variable.
if (process.env.VITEST === undefined) {
  main()
}
