/**
 * @fileoverview HLStatsNext Daemon - Main Application Entry Point
 *
 * This module contains the main daemon class that orchestrates the entire HLStatsNext
 * statistics collection system. It manages service lifecycle, handles graceful shutdown,
 * and coordinates data flow between game servers and the statistics database.
 *
 * The daemon is responsible for:
 * - Receiving UDP packets from Half-Life game servers
 * - Processing game events and statistics
 * - Managing RCON connections for scheduled commands and monitoring
 * - Publishing events to message queues for processing
 *
 * @author HLStatsNext Team
 * @since 1.0.0
 * @version 1.0.0
 */

// Load environment variables from .env file
import dotenv from "dotenv"
dotenv.config()

import type { AppContext } from "@/context"
import type { ILogger } from "@/shared/utils/logger.types"
import type { BaseEvent } from "@/shared/types/events"
import type { IRconScheduleService } from "@/modules/rcon/types/schedule.types"
import { getAppContext, initializeQueueInfrastructure } from "@/context"
import { getEnvironmentConfig } from "@/config/environment.config"
import { DatabaseConnectionService } from "@/database/connection.service"
import { getUuidService } from "@/shared/infrastructure/messaging/queue/utils/message-utils"
import { MetricsServer } from "@repo/observability"

/**
 * Main daemon class for the HLStatsNext statistics collection system.
 *
 * This class orchestrates all components of the daemon including:
 * - Database connectivity management
 * - RCON monitoring for game servers
 * - RCON scheduled command execution
 * - UDP ingress service for receiving game events
 * - Event publishing to message queues
 *
 * The daemon follows a clean architecture pattern with dependency injection
 * and proper separation of concerns for maintainability and testability.
 *
 * @example
 * ```typescript
 * const daemon = new HLStatsDaemon();
 * await daemon.start();
 *
 * // Graceful shutdown
 * await daemon.stop();
 * ```
 *
 * @public
 */
export class HLStatsDaemon {
  /** Application context containing all injected dependencies */
  private context: AppContext

  /** Structured logger instance for daemon operations */
  private logger: ILogger

  /** RCON scheduled command service for automated tasks */
  private rconScheduler: IRconScheduleService

  /** Database connection management service */
  private databaseConnection: DatabaseConnectionService

  /** Metrics HTTP server for Prometheus scraping */
  private metricsServer: MetricsServer

  /** Interval handle for periodic metrics gauge collection */
  private metricsCollectionInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Creates a new HLStatsDaemon instance.
   *
   * Initializes all required services and dependencies based on environment
   * configuration. The constructor handles:
   * - Environment configuration parsing
   * - Application context creation with dependency injection
   * - Service instantiation (RCON scheduler, database connection)
   *
   * @throws {Error} When environment configuration is invalid
   * @throws {Error} When required services cannot be initialized
   */
  private constructor(context: AppContext) {
    this.context = context
    this.logger = this.context.logger

    this.rconScheduler = this.context.rconScheduleService
    this.databaseConnection = new DatabaseConnectionService(this.context)

    // Create metrics server for Prometheus scraping
    const metricsPort = Number(process.env.METRICS_PORT) || 9091
    this.metricsServer = new MetricsServer(
      this.context.metrics,
      this.logger,
      async () => ({
        status: await this.getHealthStatus(),
        database: await this.databaseConnection.testConnection(),
        rabbitmq: !!this.context.queueModule,
        uptime: process.uptime(),
      }),
      { port: metricsPort },
    )

    this.logger.info("Initializing HLStatsNext Daemon...")
  }

  /**
   * Creates a new HLStatsDaemon instance asynchronously.
   */
  static async create(): Promise<HLStatsDaemon> {
    const config = getEnvironmentConfig()
    const context = await getAppContext(config.ingressOptions)
    return new HLStatsDaemon(context)
  }

  /**
   * Starts the HLStatsNext daemon and all its services.
   *
   * This method performs the complete startup sequence:
   * 1. Tests database connectivity
   * 2. Initializes message queue infrastructure
   * 3. Starts all core services (ingress, RCON monitoring, RCON scheduler)
   * 4. Signals ready state
   *
   * The startup process is designed to fail fast if any critical component
   * cannot be initialized, ensuring the daemon only runs in a healthy state.
   *
   * @returns Promise that resolves when all services are started successfully
   * @throws {Error} When database connection fails
   * @throws {Error} When queue infrastructure initialization fails
   * @throws {Error} When service startup fails
   *
   * @example
   * ```typescript
   * const daemon = new HLStatsDaemon();
   * try {
   *   await daemon.start();
   *   console.log('Daemon started successfully');
   * } catch (error) {
   *   console.error('Failed to start daemon:', error);
   *   process.exit(1);
   * }
   * ```
   */
  async start(): Promise<void> {
    try {
      const dbConnected = await this.databaseConnection.testConnection()
      if (!dbConnected) {
        throw new Error("Failed to connect to database")
      }

      await initializeQueueInfrastructure(this.context)

      // Run preflight checks to ensure critical services are ready
      await this.runPreflightChecks()

      this.logger.info("Starting services")
      await this.startServices()

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
   * Runs preflight checks to validate critical services are properly initialized.
   *
   * This method performs essential validation before starting services:
   * - Validates UUID service is initialized for message ID generation
   * - Tests parser functionality with sample log line
   * - Ensures event publisher is available
   *
   * These checks help catch initialization issues early and prevent
   * silent failures in production.
   *
   * @private
   * @throws {Error} When critical services are not properly initialized
   */
  private async runPreflightChecks(): Promise<void> {
    this.logger.info("Running preflight checks...")

    // 1. Verify UUID service is initialized
    try {
      const uuidService = getUuidService()
      if (!uuidService) {
        throw new Error("UUID service not initialized")
      }

      // Test UUID generation
      const testId = uuidService.generateMessageId()
      if (!testId || !testId.startsWith("msg_")) {
        throw new Error("UUID service not functioning correctly")
      }

      this.logger.debug("UUID service validated successfully")
    } catch (error) {
      throw new Error(
        `UUID service preflight check failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // 2. Test parser functionality with sample log line
    try {
      if (!this.context.eventPublisher) {
        throw new Error("Event publisher not initialized - queue infrastructure may have failed")
      }

      // Test parsing with a sample CS log line
      await this.context.ingressService.processRawEvent(
        'L 01/01/2024 - 12:00:00: "TestPlayer<999><STEAM_TEST><CT>" connected',
        "127.0.0.1",
        27015,
      )

      // We expect null here (server not authenticated), but the important thing is it doesn't crash
      // If it crashes, it means UUID service or parser setup is broken
      this.logger.debug("Parser functionality validated successfully")
    } catch (error) {
      throw new Error(
        `Parser preflight check failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // 3. Verify event publisher is available
    if (!this.context.eventPublisher) {
      throw new Error("Event publisher not available - ingress service cannot publish events")
    }

    this.logger.ok("All preflight checks passed")
  }

  /**
   * Starts all daemon services in the correct order.
   *
   * This private method handles the orchestrated startup of:
   * - Metrics HTTP server (Prometheus scraping endpoint)
   * - Ingress service (UDP packet reception)
   * - RCON scheduler service (scheduled command execution and monitoring)
   *
   * Services are started with proper dependency ordering to ensure
   * the system comes online in a stable state.
   *
   * @private
   * @returns Promise that resolves when all services are started
   */
  private async startServices(): Promise<void> {
    // Start metrics server first
    await this.metricsServer.start()

    // Start periodic metrics gauge collection (every 15s to match Prometheus scrape interval)
    this.startMetricsCollection()

    await Promise.all([this.context.ingressService.start()])

    // Start RCON scheduler for scheduled commands and monitoring
    await this.rconScheduler.start()
  }

  /**
   * Starts periodic collection of gauge metrics (queue depth, active players).
   */
  private startMetricsCollection(): void {
    const collectMetrics = async () => {
      try {
        // Queue depth from consumer stats
        if (this.context.rabbitmqConsumer) {
          const stats = this.context.rabbitmqConsumer.getConsumerStats()
          this.context.metrics.setGauge("queue_depth", {}, stats.queueDepth)
        }

        // Active players from database (sum across all servers)
        const result = await this.context.database.prisma.server.aggregate({
          _sum: { activePlayers: true },
        })
        this.context.metrics.setGauge("active_players_count", {}, result._sum.activePlayers ?? 0)
      } catch (error) {
        this.logger.debug("Metrics collection error", {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Collect immediately, then every 15 seconds
    collectMetrics()
    this.metricsCollectionInterval = setInterval(collectMetrics, 15_000)
  }

  /**
   * Gracefully shuts down the daemon and all its services.
   *
   * This method performs a clean shutdown sequence:
   * 1. Stops RCON scheduler
   * 2. Stops ingress service and disconnects RCON connections
   * 3. Shuts down message queue infrastructure
   * 4. Stops metrics server
   * 5. Closes database connections
   *
   * The shutdown process is designed to be graceful, allowing ongoing
   * operations to complete where possible while preventing new work.
   *
   * @returns Promise that resolves when shutdown is complete
   *
   * @example
   * ```typescript
   * // Graceful shutdown on SIGTERM
   * process.on('SIGTERM', async () => {
   *   await daemon.stop();
   *   process.exit(0);
   * });
   * ```
   */
  async stop(): Promise<void> {
    this.logger.shutdown()

    try {
      // Stop metrics collection interval
      if (this.metricsCollectionInterval) {
        clearInterval(this.metricsCollectionInterval)
        this.metricsCollectionInterval = null
      }

      // Stop RCON services first
      await this.rconScheduler.stop()

      await Promise.all([
        this.context.ingressService.stop(),
        this.context.rconService.disconnectAll(),
        this.context.queueModule?.shutdown() || Promise.resolve(),
        this.context.cache.disconnect(),
        this.metricsServer.stop(),
      ])

      await this.databaseConnection.disconnect()
      this.logger.shutdownComplete()
    } catch (error) {
      this.logger.failed(
        "Error during shutdown",
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  /**
   * Publishes game events to the message queue system.
   *
   * This method takes an array of game events and publishes each one
   * individually to the configured event publisher. Events are processed
   * sequentially to maintain order and ensure reliable delivery.
   *
   * @param events - Array of game events to publish
   * @returns Promise that resolves when all events are published
   * @throws {Error} When event publisher is not initialized
   * @throws {Error} When event publishing fails
   *
   * @example
   * ```typescript
   * const events = [
   *   {
   *     eventType: 'PLAYER_KILL',
   *     timestamp: new Date(),
   *     serverId: 1,
   *     data: { killerId: 123, victimId: 456 }
   *   }
   * ];
   * await daemon.emitEvents(events);
   * ```
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
   * Retrieves the application context for testing or advanced usage.
   *
   * This method provides access to the internal application context,
   * primarily used for testing scenarios where direct access to
   * services and dependencies is required.
   *
   * @returns The application context containing all service dependencies
   *
   * @example
   * ```typescript
   * const daemon = new HLStatsDaemon();
   * const context = daemon.getContext();
   * const logger = context.logger;
   * ```
   */
  getContext(): AppContext {
    return this.context
  }

  /**
   * Gets the current health status of the daemon.
   *
   * @private
   * @returns Health status string
   */
  private async getHealthStatus(): Promise<string> {
    try {
      const dbHealthy = await this.databaseConnection.testConnection()
      const queueHealthy = !!this.context.queueModule
      return dbHealthy && queueHealthy ? "healthy" : "degraded"
    } catch {
      return "unhealthy"
    }
  }
}

/**
 * Creates a signal handler function for graceful daemon shutdown.
 *
 * This factory function creates a signal handler that performs a graceful
 * shutdown of the daemon when system signals (SIGINT, SIGTERM) are received.
 * The handler logs the signal receipt and ensures clean shutdown.
 *
 * @param daemon - The daemon instance to shut down
 * @param signal - The signal name for logging purposes
 * @returns An async function that handles the shutdown process
 *
 * @example
 * ```typescript
 * const daemon = new HLStatsDaemon();
 * process.on('SIGINT', createSignalHandler(daemon, 'SIGINT'));
 * process.on('SIGTERM', createSignalHandler(daemon, 'SIGTERM'));
 * ```
 */
function createSignalHandler(daemon: HLStatsDaemon, signal: string) {
  return async () => {
    daemon.getContext().logger.received(signal)
    await daemon.stop()
    process.exit(0)
  }
}

/**
 * Main entry point function for the HLStatsNext daemon.
 *
 * This function initializes the daemon, sets up signal handlers for
 * graceful shutdown, and starts the main service loop. It handles:
 * - Daemon instantiation
 * - Signal handler registration (SIGINT, SIGTERM)
 * - Startup error handling with appropriate exit codes
 *
 * The function implements the standard Node.js daemon pattern with
 * proper signal handling and error reporting.
 *
 * @example
 * ```typescript
 * // Called automatically when module is executed
 * main();
 * ```
 */
async function main() {
  try {
    const daemon = await HLStatsDaemon.create()

    process.on("SIGINT", createSignalHandler(daemon, "SIGINT"))
    process.on("SIGTERM", createSignalHandler(daemon, "SIGTERM"))

    await daemon.start()
  } catch (error) {
    console.error("Failed to start daemon:", error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

/**
 * Conditional execution guard for testing compatibility.
 *
 * This conditional check prevents the main() function from executing
 * when the module is imported during testing (when VITEST is defined).
 * This pattern allows the module to be imported for testing without
 * side effects while still functioning as an executable daemon.
 */
if (process.env.VITEST === undefined) {
  main()
}
