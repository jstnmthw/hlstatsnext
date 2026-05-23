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

import { getEnvironmentConfig } from "@/config/environment.config"
import type { AppContext } from "@/context"
import { getAppContext, initializeQueueInfrastructure } from "@/context"
import { DatabaseConnectionService } from "@/database/connection.service"
import type { IRconScheduleService } from "@/modules/rcon/types/schedule.types"
import { getUuidService } from "@/shared/infrastructure/messaging/queue/utils/message-utils"
import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
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
   * Memoized shutdown promise. A SIGTERM followed by SIGINT (or any re-entrant
   * stop()) must not double-close subsystems — Prisma, RabbitMQ, and Garnet all
   * throw on second close.
   */
  private shutdownPromise: Promise<boolean> | null = null

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
        rabbitmq: this.context.queueModule?.getStatus().connected ?? false,
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

    // 2. Verify event publisher is available
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
        // Queue depth: live count of ready messages across all consumed queues
        if (this.context.rabbitmqConsumer) {
          const queueDepth = await this.context.rabbitmqConsumer.getQueueDepth()
          this.context.metrics.setGauge("queue_depth", {}, queueDepth)
        }

        // Active players/bots: live count of open player sessions (event-driven,
        // RCON-synced). Avoids the drift of the Server.activePlayers column.
        // Bots are tracked separately as they still incur processing load when
        // a server's IgnoreBots config is disabled.
        const sessionStats = await this.context.sessionService.getSessionStats()
        this.context.metrics.setGauge("active_players_count", {}, sessionStats.realPlayerSessions)
        this.context.metrics.setGauge("active_bots_count", {}, sessionStats.botSessions)
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
  async stop(): Promise<boolean> {
    if (this.shutdownPromise) {
      return this.shutdownPromise
    }
    this.shutdownPromise = this.runShutdown()
    return this.shutdownPromise
  }

  private async runShutdown(): Promise<boolean> {
    this.logger.shutdown()

    // Per-phase timeout. A wedged Prisma transaction or AMQP close should not
    // block the supervisor's grace window — better to abandon the phase, log,
    // and let SIGKILL clean up than to look hung indefinitely.
    const PHASE_TIMEOUT_MS = 5_000

    let success = true

    const runPhase = async <T>(name: string, work: Promise<T>): Promise<void> => {
      try {
        await withTimeout(work, PHASE_TIMEOUT_MS, name)
      } catch (error) {
        success = false
        this.logger.failed(
          `Shutdown phase failed: ${name}`,
          error instanceof Error ? error.message : String(error),
        )
      }
    }

    // Stop metrics collection interval (synchronous, no timeout needed)
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval)
      this.metricsCollectionInterval = null
    }

    // Phase 1: stop accepting new work (UDP + scheduler) before tearing down
    // dependencies they may still call into.
    await runPhase("rconScheduler.stop", this.rconScheduler.stop())
    await runPhase("ingressService.stop", this.context.ingressService.stop())

    // Phase 2: close peripheral subsystems in parallel. None depend on each
    // other for shutdown.
    await Promise.all([
      runPhase("rconService.disconnectAll", this.context.rconService.disconnectAll()),
      runPhase("queueModule.shutdown", this.context.queueModule?.shutdown() ?? Promise.resolve()),
      runPhase("cache.disconnect", this.context.cache.disconnect()),
      runPhase("metricsServer.stop", this.metricsServer.stop()),
    ])

    // Phase 3: database last — every other subsystem may still issue queries
    // during its own shutdown.
    await runPhase("databaseConnection.disconnect", this.databaseConnection.disconnect())

    if (success) {
      this.logger.shutdownComplete()
    } else {
      this.logger.failed(
        "Shutdown completed with errors",
        "One or more subsystems failed to shut down cleanly",
      )
    }

    return success
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
      const queueHealthy = this.context.queueModule?.getStatus().connected ?? false
      return dbHealthy && queueHealthy ? "healthy" : "degraded"
    } catch {
      return "unhealthy"
    }
  }
}

/**
 * Wrap a promise with a timeout. If `work` does not settle within `ms`, the
 * returned promise rejects — the original task is left running (we cannot
 * forcibly cancel an in-flight Prisma/AMQP call) but the caller is unblocked.
 */
function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
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
    // Overall shutdown deadline: docker stop grace is typically 10s, k8s default
    // terminationGracePeriodSeconds is 30s. 25s leaves headroom before SIGKILL.
    const SHUTDOWN_DEADLINE_MS = 25_000
    let success = false
    try {
      success = await withShutdownDeadline(daemon.stop(), SHUTDOWN_DEADLINE_MS)
    } catch (error) {
      daemon
        .getContext()
        .logger.failed(
          "Shutdown deadline exceeded",
          error instanceof Error ? error.message : String(error),
        )
      success = false
    }
    process.exit(success ? 0 : 1)
  }
}

function withShutdownDeadline(work: Promise<boolean>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Shutdown exceeded overall deadline of ${ms}ms`)), ms)
  })
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
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

    // Catch detached promise rejections so a single unawaited error does not
    // take the daemon down without observability or a clean shutdown.
    process.on("unhandledRejection", (reason, promise) => {
      const message = reason instanceof Error ? reason.stack || reason.message : String(reason)
      daemon.getContext().logger.error(`Unhandled promise rejection: ${message}`, {
        promise: String(promise),
      })
    })

    // Uncaught exceptions are unrecoverable — log with context and run a best-
    // effort shutdown before exiting.
    process.on("uncaughtException", async (error) => {
      const ctx = daemon.getContext()
      ctx.logger.error(`Uncaught exception: ${error.stack ?? error.message}`)
      try {
        await daemon.stop()
      } catch {
        // shutdown already logged its own failures; nothing useful to add here
      }
      process.exit(1)
    })

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
