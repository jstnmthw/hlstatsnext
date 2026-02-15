/**
 * Server Monitoring Command
 *
 * Scheduled command that monitors active servers via RCON,
 * enriches server status, and manages player sessions.
 */

import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IRconService, RconConfig, ServerFailureState } from "@/modules/rcon/types/rcon.types"
import type { IServerStatusEnricher } from "@/modules/server/enrichers/server-status-enricher"
import type { IServerService, ServerInfo } from "@/modules/server/server.types"
import type { ILogger } from "@/shared/utils/logger.types"
import { RetryBackoffCalculatorService } from "../../services/retry-backoff-calculator.service"
import type {
  IScheduledCommandExecutor,
  ScheduledCommand,
  ScheduleExecutionContext,
} from "../../types/schedule.types"

export interface ServerMonitoringConfig {
  maxConsecutiveFailures?: number
  backoffMultiplier?: number
  maxBackoffMinutes?: number
  dormantRetryMinutes?: number
}

/**
 * Server Monitoring Command
 *
 * Implements server monitoring as a scheduled command that can be run on a cron schedule.
 * This replaces the separate RconMonitorService with a cleaner scheduled approach.
 */
export class ServerMonitoringCommand implements IScheduledCommandExecutor {
  private readonly retryCalculator: RetryBackoffCalculatorService

  constructor(
    private readonly logger: ILogger,
    private readonly rconService: IRconService,
    private readonly serverService: IServerService,
    private readonly serverStatusEnricher: IServerStatusEnricher,
    private readonly sessionService: IPlayerSessionService,
    config: ServerMonitoringConfig = {},
  ) {
    // Create a valid RconConfig with required properties and optional overrides
    const rconConfig: RconConfig = {
      enabled: true,
      statusInterval: 30000,
      timeout: 5000,
      maxRetries: 3,
      maxConnectionsPerServer: 1,
      maxConsecutiveFailures: config.maxConsecutiveFailures ?? 10,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      maxBackoffMinutes: config.maxBackoffMinutes ?? 30,
      dormantRetryMinutes: config.dormantRetryMinutes ?? 60,
    }
    this.retryCalculator = new RetryBackoffCalculatorService(this.logger, rconConfig)
  }

  /**
   * Get command type identifier
   */
  getType(): string {
    return "server-monitoring"
  }

  /**
   * Validate the server monitoring command configuration
   */
  async validate(schedule: ScheduledCommand): Promise<boolean> {
    // Server monitoring doesn't need specific validation beyond basic checks
    if (!schedule.enabled) {
      this.logger.debug(`Server monitoring schedule ${schedule.id} is disabled`)
      return false
    }

    return true
  }

  /**
   * Execute server monitoring
   */
  async execute(context: ScheduleExecutionContext): Promise<{
    serversProcessed: number
    commandsSent: number
  }> {
    try {
      this.logger.debug("Starting server monitoring execution", {
        scheduleId: context.schedule.id,
        executionId: context.executionId,
      })

      // Discover active servers
      const servers = await this.discoverActiveServers()

      if (servers.length === 0) {
        this.logger.info("No active servers found for monitoring")
        return {
          serversProcessed: 0,
          commandsSent: 0,
        }
      }

      this.logger.debug(`Discovered ${servers.length} servers for monitoring`)

      // Filter servers based on retry logic
      const serversToMonitor = servers.filter((server) => {
        const failureState = this.retryCalculator.getFailureState(server.serverId)
        return this.retryCalculator.shouldRetry(failureState)
      })

      const skippedCount = servers.length - serversToMonitor.length
      if (skippedCount > 0) {
        this.logger.debug(`Skipped ${skippedCount} servers in backoff period`)
      }

      // Monitor each server
      const monitoringResults = await Promise.allSettled(
        serversToMonitor.map((server) => this.monitorSingleServer(server)),
      )

      // Process results
      let successCount = 0
      let errorCount = 0

      for (let i = 0; i < monitoringResults.length; i++) {
        const monitorResult = monitoringResults[i]
        const server = serversToMonitor[i]

        if (!monitorResult || !server) {
          continue
        }

        if (monitorResult.status === "fulfilled") {
          successCount++
          // Reset failure state on success
          this.retryCalculator.resetFailureState(server.serverId)
        } else {
          errorCount++
          // Record failure
          const failureState = this.retryCalculator.recordFailure(server.serverId)
          const errorMessage =
            monitorResult.reason instanceof Error
              ? monitorResult.reason.message
              : String(monitorResult.reason)

          // Log server error
          this.logger.error(`Server ${server.serverId}: ${errorMessage}`)

          await this.handleServerError(server, monitorResult.reason, failureState)
        }
      }

      this.logger.debug(`Server monitoring completed`, {
        scheduleId: context.schedule.id,
        totalServers: servers.length,
        monitored: serversToMonitor.length,
        successful: successCount,
        errors: errorCount,
        skipped: skippedCount,
      })

      return {
        serversProcessed: serversToMonitor.length,
        commandsSent: successCount,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Server monitoring execution failed: ${errorMessage}`, {
        scheduleId: context.schedule.id,
        error: errorMessage,
      })

      return {
        serversProcessed: 0,
        commandsSent: 0,
      }
    }
  }

  /**
   * Discover active servers that need monitoring
   */
  private async discoverActiveServers(): Promise<ServerInfo[]> {
    // Get servers with recent events and RCON credentials
    const recentlyActiveServers = await this.serverService.findActiveServersWithRcon()
    return recentlyActiveServers
  }

  /**
   * Monitor a single server
   */
  private async monitorSingleServer(server: ServerInfo): Promise<void> {
    // Ensure RCON connection
    await this.ensureServerConnection(server)

    // Enrich server status
    await this.enrichServerStatus(server)

    this.logger.debug(`Successfully monitored server ${server.serverId} (${server.name})`)
  }

  /**
   * Ensure server has an active RCON connection
   */
  private async ensureServerConnection(server: ServerInfo): Promise<void> {
    if (!this.rconService.isConnected(server.serverId)) {
      this.logger.info(
        `Establishing RCON connection to server ${server.serverId} (${server.address}:${server.port})`,
      )
      await this.rconService.connect(server.serverId)
    } else {
      this.logger.debug(`RCON already connected to server ${server.serverId}`)
    }
  }

  /**
   * Enrich server status via RCON
   */
  private async enrichServerStatus(server: ServerInfo): Promise<void> {
    await this.serverStatusEnricher.enrichServerStatus(server.serverId)
    this.logger.debug(`Enriched status for server ${server.serverId}`)
  }

  /**
   * Handle server monitoring errors
   */
  private async handleServerError(
    server: ServerInfo,
    error: unknown,
    failureState: ServerFailureState,
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const engineType = await this.rconService.getEngineDisplayNameForServer(server.serverId)

    this.logger.debug(
      `${engineType} RCON monitoring failed for server ${server.serverId} (${server.name}): ${errorMessage}`,
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

    // Attempt to disconnect on error
    try {
      await this.rconService.disconnect(server.serverId)
    } catch (disconnectError) {
      this.logger.debug(`Error disconnecting from server ${server.serverId}: ${disconnectError}`)
    }
  }

  /**
   * Connect to server immediately for newly authenticated servers
   * This can be called outside of scheduled execution for immediate response
   */
  async connectToServerImmediately(serverId: number): Promise<void> {
    try {
      const server = await this.serverService.findById(serverId)
      if (!server) {
        this.logger.warn(`Server ${serverId} not found for immediate RCON connection`)
        return
      }

      const hasRcon = await this.serverService.hasRconCredentials(serverId)
      if (!hasRcon) {
        this.logger.debug(
          `Server ${serverId} has no RCON credentials, skipping immediate connection`,
        )
        return
      }

      const failureState = this.retryCalculator.getFailureState(serverId)
      if (!this.retryCalculator.shouldRetry(failureState)) {
        this.logger.debug(
          `Server ${serverId} is in backoff period, skipping immediate connection attempt`,
        )
        return
      }

      const wasAlreadyConnected = this.rconService.isConnected(serverId)

      this.logger.info(
        `Attempting immediate RCON connection for newly authenticated server ${serverId}`,
      )

      await this.ensureServerConnection(server)

      // Only enrich status if we actually made a new connection
      if (!wasAlreadyConnected) {
        await this.enrichServerStatus(server)

        // Synchronize player sessions to ensure BOTs and players have sessions created
        try {
          this.logger.debug(`Synchronizing player sessions for newly connected server ${serverId}`)
          const sessionCount = await this.sessionService.synchronizeServerSessions(serverId)
          this.logger.debug(`Created ${sessionCount} player sessions for server ${serverId}`)
        } catch (error) {
          this.logger.warn(`Failed to synchronize sessions for server ${serverId}: ${error}`)
        }
      }

      // Reset failure state on successful operations
      this.retryCalculator.resetFailureState(serverId)
    } catch (error) {
      this.logger.error(`Error in immediate RCON connection for server ${serverId}: ${error}`)
    }
  }

  /**
   * Get retry statistics for monitoring
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
   * Get all failure states
   */
  getAllFailureStates(): ServerFailureState[] {
    return this.retryCalculator.getAllFailureStates()
  }
}
