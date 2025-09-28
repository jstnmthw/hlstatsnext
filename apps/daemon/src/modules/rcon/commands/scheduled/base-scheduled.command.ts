/**
 * Base Scheduled Command
 *
 * Abstract base class for all scheduled RCON commands.
 * Provides common functionality and enforces consistent patterns.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { IRconService } from "../../types/rcon.types"
import type {
  IScheduledCommandExecutor,
  ScheduledCommand,
  ScheduleExecutionContext,
} from "../../types/schedule.types"

/**
 * Abstract base class for scheduled command executors.
 *
 * Provides common functionality like:
 * - Error handling and logging
 * - Command validation
 * - Execution tracking
 */
export abstract class BaseScheduledCommand implements IScheduledCommandExecutor {
  protected readonly logger: ILogger
  protected readonly rconService: IRconService

  constructor(logger: ILogger, rconService: IRconService) {
    this.logger = logger
    this.rconService = rconService
  }

  /**
   * Execute the scheduled command across all applicable servers
   */
  async execute(context: ScheduleExecutionContext): Promise<{
    serversProcessed: number
    commandsSent: number
  }> {
    const { schedule, scheduleId, executionId } = context

    this.logger.debug(`Executing scheduled command: ${scheduleId}`, {
      scheduleId,
      executionId,
      scheduleName: schedule.name,
      commandType: this.getType(),
    })

    try {
      // Delegate to subclass for actual execution
      const result = await this.executeCommand(context)

      this.logger.debug(`Scheduled command completed: ${scheduleId}`, {
        scheduleId,
        executionId,
        serversProcessed: result.serversProcessed,
        commandsSent: result.commandsSent,
      })

      return result
    } catch (error) {
      this.logger.error(`Scheduled command failed: ${scheduleId}`, {
        scheduleId,
        executionId,
        error: error instanceof Error ? error.message : String(error),
      })

      // Return zero counts on error
      return {
        serversProcessed: 0,
        commandsSent: 0,
      }
    }
  }

  /**
   * Abstract method for subclasses to implement specific command execution
   */
  protected abstract executeCommand(context: ScheduleExecutionContext): Promise<{
    serversProcessed: number
    commandsSent: number
  }>

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
    // Base implementation - validate that command has a type
    return !!(schedule.command && typeof schedule.command === "object" && schedule.command.type)
  }

  /**
   * Basic cron expression validation
   */
  protected isValidCronExpression(expression: string): boolean {
    const parts = expression.trim().split(/\s+/)
    return parts.length === 5 || parts.length === 6
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
}
