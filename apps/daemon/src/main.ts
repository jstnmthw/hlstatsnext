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
 * - Managing RCON connections for server monitoring
 * - Publishing events to message queues for processing
 *
 * @author HLStatsNext Team
 * @since 1.0.0
 * @version 1.0.0
 */

// Load environment variables from .env file
import dotenv from "dotenv"
dotenv.config()

import { getAppContext, initializeQueueInfrastructure } from "@/context"
import type { AppContext } from "@/context"
import type { ILogger } from "@/shared/utils/logger.types"
import type { BaseEvent } from "@/shared/types/events"
import { getEnvironmentConfig } from "@/config/environment.config"
import { RconMonitorService } from "@/modules/rcon/rcon-monitor.service"
import { DatabaseConnectionService } from "@/database/connection.service"
import { getUuidService } from "@/shared/infrastructure/messaging/queue/utils/message-utils"

/**
 * Main daemon class for the HLStatsNext statistics collection system.
 *
 * This class orchestrates all components of the daemon including:
 * - Database connectivity management
 * - RCON monitoring for game servers
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

  /** RCON monitoring service for server status checks */
  private rconMonitor: RconMonitorService

  /** Database connection management service */
  private databaseConnection: DatabaseConnectionService

  /**
   * Creates a new HLStatsDaemon instance.
   *
   * Initializes all required services and dependencies based on environment
   * configuration. The constructor handles:
   * - Environment configuration parsing
   * - Application context creation with dependency injection
   * - Service instantiation (RCON monitor, database connection)
   *
   * @throws {Error} When environment configuration is invalid
   * @throws {Error} When required services cannot be initialized
   */
  constructor() {
    const config = getEnvironmentConfig()

    this.context = getAppContext(config.ingressOptions)
    this.logger = this.context.logger
    this.rconMonitor = new RconMonitorService(
      this.context,
      config.rconConfig,
      this.context.serverStatusEnricher,
    )
    this.databaseConnection = new DatabaseConnectionService(this.context)

    this.logger.info("Initializing HLStatsNext Daemon...")
  }

  /**
   * Starts the HLStatsNext daemon and all its services.
   *
   * This method performs the complete startup sequence:
   * 1. Tests database connectivity
   * 2. Initializes message queue infrastructure
   * 3. Starts all core services (ingress, RCON monitoring)
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
   * - Ingress service (UDP packet reception)
   * - RCON monitoring service (server status checks)
   *
   * Services are started with proper dependency ordering to ensure
   * the system comes online in a stable state.
   *
   * @private
   * @returns Promise that resolves when all services are started
   */
  private async startServices(): Promise<void> {
    await Promise.all([this.context.ingressService.start()])

    this.rconMonitor.start()
  }

  /**
   * Gracefully shuts down the daemon and all its services.
   *
   * This method performs a clean shutdown sequence:
   * 1. Stops RCON monitoring
   * 2. Stops ingress service and disconnects RCON connections
   * 3. Shuts down message queue infrastructure
   * 4. Closes database connections
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
      this.rconMonitor.stop()

      await Promise.all([
        this.context.ingressService.stop(),
        this.context.rconService.disconnectAll(),
        this.context.queueModule?.shutdown() || Promise.resolve(),
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
function main() {
  const daemon = new HLStatsDaemon()

  process.on("SIGINT", createSignalHandler(daemon, "SIGINT"))
  process.on("SIGTERM", createSignalHandler(daemon, "SIGTERM"))

  daemon.start().catch((error) => {
    daemon.getContext().logger.fatal(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
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
