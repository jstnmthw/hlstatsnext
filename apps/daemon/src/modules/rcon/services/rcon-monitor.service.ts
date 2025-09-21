import type { AppContext } from "@/context"
import type { ILogger } from "@/shared/utils/logger.types"
import type { ServerInfo } from "@/modules/server/server.types"
import type { IServerStatusEnricher } from "@/modules/server/enrichers/server-status-enricher"
import type { RconConfig, ServerFailureState } from "../types/rcon.types"
import { RetryBackoffCalculatorService } from "./retry-backoff-calculator.service"
import { EventType, type ServerAuthenticatedEvent } from "@/shared/types/events"

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
  private eventHandlerId?: string

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

    // Subscribe to SERVER_AUTHENTICATED events for immediate RCON connections
    this.eventHandlerId = this.context.eventBus.on(
      EventType.SERVER_AUTHENTICATED,
      this.handleServerAuthenticated.bind(this),
    )

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
    // Unsubscribe from events
    if (this.eventHandlerId) {
      this.context.eventBus.off(this.eventHandlerId)
      this.eventHandlerId = undefined
    }

    // Stop interval monitoring
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }

    this.logger.info("RCON monitoring stopped")
  }

  /**
   * Handle SERVER_AUTHENTICATED events for immediate RCON connections
   */
  private async handleServerAuthenticated(event: ServerAuthenticatedEvent): Promise<void> {
    // Execute asynchronously to avoid blocking the event emission
    setImmediate(() => {
      this.connectToServerImmediately(event.serverId).catch((error) => {
        this.logger.error(`Failed immediate RCON connection for server ${event.serverId}: ${error}`)
      })
    })
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
      // Get servers with recent events (traditional discovery)
      const recentlyActiveServers = await this.context.serverService.findActiveServersWithRcon()

      // Get currently authenticated servers (new discovery method)
      const authenticatedServerIds = this.context.ingressService.getAuthenticatedServerIds()
      const authenticatedServers =
        await this.context.serverService.findServersByIds(authenticatedServerIds)

      // Combine both sets, deduplicating by serverId
      const serverMap = new Map<number, ServerInfo>()

      // Add recently active servers
      for (const server of recentlyActiveServers) {
        serverMap.set(server.serverId, server)
      }

      // Add authenticated servers (will overwrite if duplicate, which is fine)
      for (const server of authenticatedServers) {
        serverMap.set(server.serverId, server)
      }

      const allCandidateServers = Array.from(serverMap.values())

      if (allCandidateServers.length === 0) {
        this.logger.info("No active servers with RCON found for monitoring")
        return
      }

      this.logger.debug(
        `Discovered ${allCandidateServers.length} server(s) for RCON monitoring ` +
          `(${recentlyActiveServers.length} recent events, ${authenticatedServers.length} authenticated)`,
      )

      // Filter servers based on retry logic
      const serversToMonitor = allCandidateServers.filter((server) => {
        const failureState = this.retryCalculator.getFailureState(server.serverId)
        return this.retryCalculator.shouldRetry(failureState)
      })

      const skippedCount = allCandidateServers.length - serversToMonitor.length
      if (skippedCount > 0) {
        this.logger.debug(`Skipped ${skippedCount} servers in backoff period`)
      }

      this.logger.debug(
        `Monitoring ${serversToMonitor.length} of ${allCandidateServers.length} server(s) with RCON`,
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

  /**
   * Immediately attempt RCON connection for a specific server
   * Used for newly authenticated servers to avoid waiting for periodic check
   */
  async connectToServerImmediately(serverId: number): Promise<void> {
    try {
      const server = await this.context.serverService.findById(serverId)
      if (!server) {
        this.logger.warn(`Server ${serverId} not found for immediate RCON connection`)
        return
      }

      // Check if server has RCON credentials
      const hasRcon = await this.context.serverService.hasRconCredentials(serverId)
      if (!hasRcon) {
        this.logger.debug(
          `Server ${serverId} has no RCON credentials, skipping immediate connection`,
        )
        return
      }

      // Check retry logic before attempting connection
      const failureState = this.retryCalculator.getFailureState(serverId)
      if (!this.retryCalculator.shouldRetry(failureState)) {
        this.logger.debug(
          `Server ${serverId} is in backoff period, skipping immediate connection attempt`,
        )
        return
      }

      // Check if server is already connected (from initial monitoring)
      const wasAlreadyConnected = this.context.rconService.isConnected(serverId)

      this.logger.info(
        `Attempting immediate RCON connection for newly authenticated server ${serverId}`,
      )
      await this.ensureServerConnection(server)

      // Only enrich status if we actually made a new connection
      // If already connected, initial monitoring already handled the enrichment
      if (!wasAlreadyConnected) {
        await this.enrichServerStatus(server)

        // Synchronize player sessions to ensure BOTs and players have sessions created
        try {
          this.logger.debug(`Synchronizing player sessions for newly connected server ${serverId}`)
          const sessionCount = await this.context.sessionService.synchronizeServerSessions(serverId)
          this.logger.debug(`Created ${sessionCount} player sessions for server ${serverId}`)
        } catch (error) {
          this.logger.warn(`Failed to synchronize sessions for server ${serverId}: ${error}`)
        }
      }

      // Reset failure state on successful operations
      this.retryCalculator.resetFailureState(server.serverId)
    } catch (error) {
      this.logger.error(`Error in immediate RCON connection for server ${serverId}: ${error}`)
    }
  }
}
