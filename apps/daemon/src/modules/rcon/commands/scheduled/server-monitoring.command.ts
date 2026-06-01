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
   * Monitor the single server targeted by this scheduled execution.
   *
   * The executor fans out across every active server and invokes this once
   * per server, so we only ever touch `context.server`. Re-discovering the
   * full server list here would re-monitor every server on every invocation —
   * an N² fan-out that floods the logs and hammers RCON.
   */
  async execute(context: ScheduleExecutionContext): Promise<{
    serversProcessed: number
    commandsSent: number
  }> {
    const { server } = context

    this.logger.debug("Starting server monitoring execution", {
      scheduleId: context.schedule.id,
      executionId: context.executionId,
      serverId: server.serverId,
    })

    const failureState = this.retryCalculator.getFailureState(server.serverId)
    if (!this.retryCalculator.shouldRetry(failureState)) {
      this.logger.debug(`Skipped server ${server.serverId} in backoff period`)
      return { serversProcessed: 0, commandsSent: 0 }
    }

    try {
      await this.monitorSingleServer(server)
      this.retryCalculator.resetFailureState(server.serverId)
      return { serversProcessed: 1, commandsSent: 1 }
    } catch (error) {
      const newFailureState = this.retryCalculator.recordFailure(server.serverId)
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Server ${server.serverId}: ${errorMessage}`)
      await this.handleServerError(server, error, newFailureState)
      return { serversProcessed: 1, commandsSent: 0 }
    }
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
