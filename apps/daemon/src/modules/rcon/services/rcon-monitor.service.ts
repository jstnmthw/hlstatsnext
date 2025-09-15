import type { AppContext } from "@/context"
import type { ILogger } from "@/shared/utils/logger.types"
import type { ServerInfo } from "@/modules/server/server.types"
import type { IServerStatusEnricher } from "@/modules/server/enrichers/server-status-enricher"
import type { RconConfig, ServerFailureState } from "../types/rcon.types"
import { RetryBackoffCalculatorService } from "./retry-backoff-calculator.service"

export interface RconMonitorConfig {
  enabled: boolean
  statusInterval: number
  maxConsecutiveFailures?: number
  backoffMultiplier?: number
  maxBackoffMinutes?: number
  dormantRetryMinutes?: number
}

export class RconMonitorService {
  private context: AppContext
  private logger: ILogger
  private config: RconMonitorConfig
  private intervalId?: NodeJS.Timeout
  private serverStatusEnricher: IServerStatusEnricher
  private retryCalculator: RetryBackoffCalculatorService

  constructor(
    context: AppContext,
    config: RconMonitorConfig,
    serverStatusEnricher: IServerStatusEnricher,
  ) {
    this.context = context
    this.logger = context.logger
    this.config = config
    this.serverStatusEnricher = serverStatusEnricher
    this.retryCalculator = new RetryBackoffCalculatorService(this.logger, config as RconConfig)
  }

  start(): void {
    if (!this.config.enabled) {
      this.logger.warn("RCON monitoring disabled by configuration")
      return
    }

    this.logger.ok(`Starting RCON status monitoring (interval: ${this.config.statusInterval}ms)`)

    // Attempt immediate connection on startup
    this.performInitialMonitoring()

    // Set up interval for subsequent checks
    this.intervalId = setInterval(async () => {
      try {
        await this.monitorActiveServers()
      } catch (error) {
        this.logger.error(`Error in RCON status monitoring: ${error}`)
      }
    }, this.config.statusInterval)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
      this.logger.info("RCON monitoring stopped")
    }
  }

  private performInitialMonitoring(): void {
    // Execute initial monitoring asynchronously without blocking startup
    setImmediate(async () => {
      try {
        this.logger.debug("Performing initial RCON connection attempt...")
        await this.monitorActiveServers()
        this.logger.debug("Initial RCON monitoring completed")
      } catch (error) {
        this.logger.error(`Error in initial RCON monitoring: ${error}`)
      }
    })
  }

  private async monitorActiveServers(): Promise<void> {
    try {
      const activeServers = await this.context.serverService.findActiveServersWithRcon()

      if (activeServers.length === 0) {
        this.logger.warn("No active servers with RCON found for monitoring")
        return
      }

      // Filter servers based on retry logic
      const serversToMonitor = activeServers.filter((server) => {
        const failureState = this.retryCalculator.getFailureState(server.serverId)
        return this.retryCalculator.shouldRetry(failureState)
      })

      const skippedCount = activeServers.length - serversToMonitor.length
      if (skippedCount > 0) {
        this.logger.debug(`Skipped ${skippedCount} servers in backoff period`)
      }

      this.logger.debug(
        `Monitoring ${serversToMonitor.length} of ${activeServers.length} active server(s) with RCON`,
      )

      // Process servers concurrently but with individual error handling
      const results = await Promise.allSettled(
        serversToMonitor.map((server) => this.monitorSingleServer(server)),
      )

      // Log any unexpected errors (individual server errors are handled in monitorSingleServer)
      const unexpectedErrors = results.filter((r) => r.status === "rejected")
      if (unexpectedErrors.length > 0) {
        this.logger.error(`${unexpectedErrors.length} servers had unexpected monitoring errors`)
      }
    } catch (error) {
      this.logger.error(`Error discovering active servers for RCON monitoring: ${error}`)
    }
  }

  private async monitorSingleServer(server: ServerInfo): Promise<void> {
    try {
      await this.ensureServerConnection(server)
      await this.enrichServerStatus(server)

      // Reset failure state on successful operations
      this.retryCalculator.resetFailureState(server.serverId)
    } catch (error) {
      // Record the failure and get updated state
      const failureState = this.retryCalculator.recordFailure(server.serverId)
      await this.handleServerError(server, error, failureState)
    }
  }

  private async ensureServerConnection(server: ServerInfo): Promise<void> {
    if (!this.context.rconService.isConnected(server.serverId)) {
      this.logger.info(
        `Attempting RCON connection to server ${server.serverId} (${server.address}:${server.port})...`,
      )
      await this.context.rconService.connect(server.serverId)
      this.logger.ok(`RCON connected to server ${server.serverId} (${server.name})`)
    } else {
      this.logger.debug(`RCON already connected to server ${server.serverId}, getting status...`)
    }
  }

  private async enrichServerStatus(server: ServerInfo): Promise<void> {
    await this.serverStatusEnricher.enrichServerStatus(server.serverId)

    this.logger.debug(`Enriched status for server ${server.serverId} (${server.name})`)
  }

  private async handleServerError(
    server: ServerInfo,
    error: unknown,
    failureState: ServerFailureState,
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Get engine type for better logging context
    const engineType = await this.context.rconService.getEngineDisplayNameForServer(server.serverId)

    this.logger.debug(
      `${engineType} RCON failed for server ${server.serverId} (${server.name}): ${errorMessage}`,
      {
        serverId: server.serverId,
        serverName: server.name,
        engineType,
        consecutiveFailures: failureState.consecutiveFailures,
        retryStatus: failureState.status,
        nextRetryAt: failureState.nextRetryAt?.toISOString(),
        error: errorMessage,
      },
    )

    try {
      await this.context.rconService.disconnect(server.serverId)
    } catch (disconnectError) {
      this.logger.debug(`Error disconnecting from server ${server.serverId}: ${disconnectError}`)
    }
  }

  /**
   * Get current retry statistics for monitoring and debugging
   */
  getRetryStatistics(): {
    totalServersInFailureState: number
    healthyServers: number
    backingOffServers: number
    dormantServers: number
  } {
    return this.retryCalculator.getRetryStatistics()
  }

  /**
   * Get detailed failure states for all servers
   */
  getAllFailureStates(): ServerFailureState[] {
    return this.retryCalculator.getAllFailureStates()
  }
}
