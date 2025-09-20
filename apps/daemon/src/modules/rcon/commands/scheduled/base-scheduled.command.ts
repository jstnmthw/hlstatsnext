/**
 * Base Scheduled Command
 *
 * Abstract base class for all scheduled RCON commands.
 * Provides common functionality and enforces consistent patterns.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { IRconService } from "../../types/rcon.types"
import type { ServerInfo } from "@/modules/server/server.types"
import type {
  IScheduledCommandExecutor,
  ScheduledCommand,
  ScheduleExecutionContext,
  ScheduleExecutionResult,
} from "../../types/schedule.types"
import { ScheduleError, ScheduleErrorCode } from "../../types/schedule.types"

/**
 * Abstract base class for scheduled command executors.
 *
 * Provides common functionality like:
 * - Error handling and logging
 * - Timeout management
 * - Retry logic
 * - Result formatting
 */
export abstract class BaseScheduledCommand implements IScheduledCommandExecutor {
  protected readonly logger: ILogger
  protected readonly rconService: IRconService

  constructor(logger: ILogger, rconService: IRconService) {
    this.logger = logger
    this.rconService = rconService
  }

  /**
   * Execute the scheduled command with timeout and error handling
   */
  async execute(context: ScheduleExecutionContext): Promise<ScheduleExecutionResult> {
    const { schedule, server, attempt, isRetry } = context
    const startTime = Date.now()

    this.logger.debug(`Executing scheduled command: ${schedule.id} on server ${server.serverId}`, {
      scheduleId: schedule.id,
      serverId: server.serverId,
      serverName: server.name,
      attempt,
      isRetry,
      command: this.getResolvedCommand(schedule, server),
    })

    try {
      // Validate the command before execution
      await this.validateExecution(context)

      // Execute with timeout
      const timeoutMs = schedule.timeoutMs || 30000
      const response = await this.executeWithTimeout(context, timeoutMs)

      // Process the response
      const processedResponse = await this.processResponse(response, context)

      const result: ScheduleExecutionResult = {
        commandId: schedule.id,
        serverId: server.serverId,
        success: true,
        response: processedResponse,
        executedAt: new Date(),
        executionTimeMs: Date.now() - startTime,
        retryAttempt: isRetry ? attempt : undefined,
      }

      this.logger.debug(`Scheduled command executed successfully: ${schedule.id}`, {
        scheduleId: schedule.id,
        serverId: server.serverId,
        executionTimeMs: result.executionTimeMs,
        responseLength: response?.length || 0,
      })

      // Perform any post-execution tasks
      await this.onExecutionSuccess(result, context)

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      const result: ScheduleExecutionResult = {
        commandId: schedule.id,
        serverId: server.serverId,
        success: false,
        error: errorMessage,
        executedAt: new Date(),
        executionTimeMs: Date.now() - startTime,
        retryAttempt: isRetry ? attempt : undefined,
      }

      this.logger.warn(`Scheduled command failed: ${schedule.id}`, {
        scheduleId: schedule.id,
        serverId: server.serverId,
        serverName: server.name,
        attempt,
        error: errorMessage,
        executionTimeMs: result.executionTimeMs,
      })

      // Perform any post-execution error handling
      await this.onExecutionError(error, result, context)

      return result
    }
  }

  /**
   * Validate that the command can be executed
   */
  async validate(schedule: ScheduledCommand): Promise<boolean> {
    try {
      // Validate command structure
      if (!schedule.id || !schedule.command) {
        return false
      }

      // Validate cron expression (basic check)
      if (!this.isValidCronExpression(schedule.cronExpression)) {
        return false
      }

      // Allow subclasses to add custom validation
      return await this.validateCommand(schedule)
    } catch (error) {
      this.logger.warn(`Schedule validation failed for ${schedule.id}: ${error}`)
      return false
    }
  }

  /**
   * Get the command type identifier
   */
  abstract getType(): string

  /**
   * Validate specific command requirements (override in subclasses)
   */
  protected async validateCommand(schedule: ScheduledCommand): Promise<boolean> {
    // Base implementation - validate that command is not empty
    const command =
      typeof schedule.command === "string" ? schedule.command : schedule.command.toString()
    return command.trim().length > 0
  }

  /**
   * Validate execution context before running command
   */
  protected async validateExecution(context: ScheduleExecutionContext): Promise<void> {
    const { server, schedule } = context

    // Check if server matches filter criteria
    if (!this.serverMatchesFilter(server, schedule)) {
      throw new ScheduleError(
        `Server ${server.serverId} does not meet filter criteria`,
        ScheduleErrorCode.EXECUTION_FAILED,
        schedule.id,
        server.serverId,
      )
    }

    // Check if server is available for RCON
    if (!this.rconService.isConnected(server.serverId)) {
      throw new ScheduleError(
        `Server ${server.serverId} is not connected via RCON`,
        ScheduleErrorCode.SERVER_NOT_AVAILABLE,
        context.schedule.id,
        server.serverId,
      )
    }
  }

  /**
   * Execute the command with timeout protection
   */
  protected async executeWithTimeout(
    context: ScheduleExecutionContext,
    timeoutMs: number,
  ): Promise<string> {
    const { schedule, server } = context

    // Resolve the command (handle function-based commands)
    const command = this.getResolvedCommand(schedule, server)

    // Execute with timeout
    return await Promise.race([
      this.rconService.executeCommand(server.serverId, command),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new ScheduleError(
                `Command execution timed out after ${timeoutMs}ms`,
                ScheduleErrorCode.EXECUTION_TIMEOUT,
                schedule.id,
                server.serverId,
              ),
            ),
          timeoutMs,
        ),
      ),
    ])
  }

  /**
   * Process the command response (override in subclasses for custom processing)
   */
  protected async processResponse(
    response: string,
    context: ScheduleExecutionContext,
  ): Promise<string> {
    // Base implementation adds basic logging
    this.logger.debug(
      `Command executed for schedule ${context.schedule.id}: ${response.slice(0, 100)}...`,
    )
    return response
  }

  /**
   * Called after successful execution (override in subclasses)
   */
  protected async onExecutionSuccess(
    result: ScheduleExecutionResult,
    context: ScheduleExecutionContext,
  ): Promise<void> {
    // Base implementation logs successful execution
    this.logger.debug(
      `Schedule ${context.schedule.id} executed successfully on server ${result.serverId}`,
    )
  }

  /**
   * Called after execution error (override in subclasses)
   */
  protected async onExecutionError(
    error: unknown,
    result: ScheduleExecutionResult,
    context: ScheduleExecutionContext,
  ): Promise<void> {
    // Base implementation logs execution errors
    const errorMessage = error instanceof Error ? error.message : String(error)
    this.logger.warn(
      `Schedule ${context.schedule.id} failed on server ${result.serverId}: ${errorMessage}`,
    )
  }

  /**
   * Resolve command string or function to final command
   */
  protected getResolvedCommand(schedule: ScheduledCommand, server: ServerInfo): string {
    if (typeof schedule.command === "function") {
      return schedule.command(server)
    }
    return schedule.command
  }

  /**
   * Basic cron expression validation
   */
  protected isValidCronExpression(expression: string): boolean {
    const parts = expression.trim().split(/\s+/)
    return parts.length === 5 || parts.length === 6
  }

  /**
   * Check if a server matches the schedule's filter criteria
   */
  protected serverMatchesFilter(server: ServerInfo, schedule: ScheduledCommand): boolean {
    const filter = schedule.serverFilter
    if (!filter) {
      return true // No filter = all servers match
    }

    // Check server ID inclusion/exclusion
    if (filter.serverIds && !filter.serverIds.includes(server.serverId)) {
      return false
    }

    if (filter.excludeServerIds && filter.excludeServerIds.includes(server.serverId)) {
      return false
    }

    // Check game type filter
    if (filter.gameTypes && filter.gameTypes.length > 0) {
      // This would need to be implemented based on how game types are stored
      // For now, return true if no game type is specified on the server
    }

    // Check player count filters
    // Note: playerCount is not available in ServerInfo, would need server status
    // For now, we'll skip player count validation
    // TODO: Implement server status fetching for player count validation
    if (filter.minPlayers !== undefined || filter.maxPlayers !== undefined) {
      // Skip player count filtering until we have access to current server status
      this.logger.debug(
        `Player count filtering skipped for schedule ${schedule.id} - not implemented`,
      )
    }

    // Check tags filter
    if (filter.tags && filter.tags.length > 0) {
      // This would need to be implemented based on how tags are stored
      // For now, return true if no tags are specified on the server
    }

    return true
  }

  /**
   * Format execution time for logging
   */
  protected formatExecutionTime(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`
    }
    return `${(milliseconds / 1000).toFixed(2)}s`
  }

  /**
   * Sanitize command for logging (remove sensitive information)
   */
  protected sanitizeCommandForLogging(command: string): string {
    // Remove potential passwords or sensitive data from logs
    return command.replace(/password\s+\S+/gi, "password [REDACTED]")
  }
}
