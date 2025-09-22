/**
 * RCON Schedule Service
 *
 * Manages scheduled RCON command execution using node-cron.
 * Handles job lifecycle, execution tracking, and error recovery.
 */

import * as cron from "node-cron"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IServerService, ServerInfo } from "@/modules/server/server.types"
import type { IRconService } from "../types/rcon.types"
import type {
  IRconScheduleService,
  IScheduledCommandExecutor,
  ScheduledCommand,
  ScheduleConfig,
  ScheduleJob,
  ScheduleJobStats,
  ScheduleExecutionResult,
  ScheduleExecutionContext,
  ScheduleStatus,
} from "../types/schedule.types"
import { ScheduleError, ScheduleErrorCode } from "../types/schedule.types"
import { ServerMessageCommand } from "../commands/scheduled/server-message.command"
import { StatsSnapshotCommand } from "../commands/scheduled/stats-snapshot.command"

/**
 * RCON Schedule Service Implementation
 *
 * Manages the lifecycle of scheduled RCON commands with proper error handling,
 * concurrency control, and execution tracking.
 */
export class RconScheduleService implements IRconScheduleService {
  private readonly logger: ILogger
  private readonly rconService: IRconService
  private readonly serverService: IServerService
  private readonly config: ScheduleConfig

  /** Active scheduled jobs */
  private readonly jobs = new Map<string, ScheduleJob>()

  /** Command executors by type */
  private readonly executors = new Map<string, IScheduledCommandExecutor>()

  /** Track concurrent executions per server */
  private readonly serverExecutions = new Map<number, Set<string>>()

  /** Service state */
  private isStarted = false

  constructor(
    logger: ILogger,
    rconService: IRconService,
    serverService: IServerService,
    config: ScheduleConfig,
  ) {
    this.logger = logger
    this.rconService = rconService
    this.serverService = serverService
    this.config = config

    this.initializeExecutors()
  }

  /**
   * Start the scheduler and all enabled schedules
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn("RCON scheduler already started")
      return
    }

    if (!this.config.enabled) {
      this.logger.info("RCON scheduler disabled by configuration")
      return
    }

    this.logger.info("Starting RCON scheduler service...")

    try {
      // Register all schedules from configuration
      const enabledSchedules = this.config.schedules.filter((schedule) => schedule.enabled)

      for (const schedule of enabledSchedules) {
        await this.registerSchedule(schedule)
      }

      this.isStarted = true

      // Start all registered tasks explicitly
      for (const job of this.jobs.values()) {
        job.task.start()
        this.logger.info(
          `Started cron task for schedule: ${job.schedule.id} (${job.schedule.cronExpression})`,
        )
      }

      this.logger.ok(
        `RCON scheduler started with ${this.jobs.size} active schedules out of ${this.config.schedules.length} total`,
        {
          activeSchedules: Array.from(this.jobs.keys()),
          totalSchedules: this.config.schedules.length,
        },
      )
    } catch (error) {
      this.logger.error(`Failed to start RCON scheduler: ${error}`)
      throw new ScheduleError("Failed to start scheduler", ScheduleErrorCode.SCHEDULER_NOT_STARTED)
    }
  }

  /**
   * Stop the scheduler and cleanup all jobs
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      this.logger.debug("RCON scheduler not started")
      return
    }

    this.logger.info("Stopping RCON scheduler service...")

    // Stop all active jobs
    for (const [scheduleId, job] of this.jobs) {
      try {
        job.task.stop()
        this.logger.debug(`Stopped schedule: ${scheduleId}`)
      } catch (error) {
        this.logger.warn(`Error stopping schedule ${scheduleId}: ${error}`)
      }
    }

    // Clear all maps
    this.jobs.clear()
    this.serverExecutions.clear()

    this.isStarted = false
    this.logger.info("RCON scheduler stopped")
  }

  /**
   * Register a new scheduled command
   */
  async registerSchedule(schedule: ScheduledCommand): Promise<void> {
    if (this.jobs.has(schedule.id)) {
      throw new ScheduleError(
        `Schedule with ID ${schedule.id} already exists`,
        ScheduleErrorCode.SCHEDULE_ALREADY_EXISTS,
        schedule.id,
      )
    }

    // Validate the schedule
    if (!this.isValidCronExpression(schedule.cronExpression)) {
      throw new ScheduleError(
        `Invalid cron expression: ${schedule.cronExpression}`,
        ScheduleErrorCode.INVALID_CRON_EXPRESSION,
        schedule.id,
      )
    }

    // Validate the command
    const executor = this.getExecutorForSchedule(schedule)
    if (!(await executor.validate(schedule))) {
      throw new ScheduleError(
        `Schedule validation failed: ${schedule.id}`,
        ScheduleErrorCode.INVALID_COMMAND,
        schedule.id,
      )
    }

    try {
      // Create the cron task
      const task = cron.schedule(schedule.cronExpression, () => this.executeSchedule(schedule.id), {
        scheduled: false,
        timezone: "UTC",
      })

      // Create job tracking
      const job: ScheduleJob = {
        schedule,
        task,
        stats: this.createInitialStats(),
        history: [],
      }

      this.jobs.set(schedule.id, job)

      // Start the task if the scheduler is running
      if (this.isStarted) {
        task.start()
      }

      this.logger.info(`Registered schedule: ${schedule.id} (${schedule.name})`, {
        scheduleId: schedule.id,
        cronExpression: schedule.cronExpression,
        enabled: schedule.enabled,
        category: schedule.metadata?.category,
      })
    } catch (error) {
      this.logger.error(`Failed to register schedule ${schedule.id}: ${error}`)
      throw new ScheduleError(
        `Failed to register schedule: ${error}`,
        ScheduleErrorCode.INVALID_CRON_EXPRESSION,
        schedule.id,
      )
    }
  }

  /**
   * Unregister a scheduled command
   */
  async unregisterSchedule(scheduleId: string): Promise<void> {
    const job = this.jobs.get(scheduleId)
    if (!job) {
      throw new ScheduleError(
        `Schedule not found: ${scheduleId}`,
        ScheduleErrorCode.SCHEDULE_NOT_FOUND,
        scheduleId,
      )
    }

    try {
      job.task.stop()
      this.jobs.delete(scheduleId)

      this.logger.info(`Unregistered schedule: ${scheduleId}`)
    } catch (error) {
      this.logger.error(`Failed to unregister schedule ${scheduleId}: ${error}`)
      throw error
    }
  }

  /**
   * Update an existing scheduled command
   */
  async updateSchedule(schedule: ScheduledCommand): Promise<void> {
    if (this.jobs.has(schedule.id)) {
      await this.unregisterSchedule(schedule.id)
    }
    await this.registerSchedule(schedule)
  }

  /**
   * Enable or disable a specific schedule
   */
  async setScheduleEnabled(scheduleId: string, enabled: boolean): Promise<void> {
    const job = this.jobs.get(scheduleId)
    if (!job) {
      throw new ScheduleError(
        `Schedule not found: ${scheduleId}`,
        ScheduleErrorCode.SCHEDULE_NOT_FOUND,
        scheduleId,
      )
    }

    job.schedule.enabled = enabled

    if (enabled) {
      job.task.start()
      this.logger.info(`Enabled schedule: ${scheduleId}`)
    } else {
      job.task.stop()
      this.logger.info(`Disabled schedule: ${scheduleId}`)
    }
  }

  /**
   * Get all registered schedules
   */
  getSchedules(): ScheduledCommand[] {
    return Array.from(this.jobs.values()).map((job) => job.schedule)
  }

  /**
   * Get execution history for a schedule
   */
  getExecutionHistory(scheduleId: string, limit = 50): ScheduleExecutionResult[] {
    const job = this.jobs.get(scheduleId)
    if (!job) {
      return []
    }

    return job.history.slice(-limit)
  }

  /**
   * Get current status of all schedules
   */
  getScheduleStatus(): ScheduleStatus[] {
    return Array.from(this.jobs.values()).map((job) => ({
      scheduleId: job.schedule.id,
      name: job.schedule.name,
      enabled: job.schedule.enabled,
      isRunning: job.schedule.enabled,
      lastExecutedAt: job.stats.lastExecutedAt,
      nextExecutionAt: job.stats.nextExecutionAt,
      successCount: job.stats.successfulExecutions,
      failureCount: job.stats.failedExecutions,
      lastResult: job.history[job.history.length - 1],
      averageExecutionTimeMs: job.stats.averageExecutionTimeMs,
    }))
  }

  /**
   * Execute a scheduled command immediately (for testing)
   */
  async executeScheduleNow(scheduleId: string): Promise<ScheduleExecutionResult[]> {
    const job = this.jobs.get(scheduleId)
    if (!job) {
      throw new ScheduleError(
        `Schedule not found: ${scheduleId}`,
        ScheduleErrorCode.SCHEDULE_NOT_FOUND,
        scheduleId,
      )
    }

    return await this.executeScheduleForServers(job.schedule)
  }

  /**
   * Execute a specific schedule
   */
  private async executeSchedule(scheduleId: string): Promise<void> {
    const job = this.jobs.get(scheduleId)
    if (!job) {
      this.logger.error(`Attempted to execute unknown schedule: ${scheduleId}`)
      return
    }

    const { schedule } = job

    this.logger.debug(`Executing schedule: ${scheduleId} (${schedule.name})`)

    try {
      const results = await this.executeScheduleForServers(schedule)

      // Update job statistics
      this.updateJobStats(job, results)

      // Store execution history
      this.addToHistory(job, results)

      this.logger.debug(`Schedule execution completed: ${scheduleId}`, {
        scheduleId,
        serversTargeted: results.length,
        successCount: results.filter((r) => r.success).length,
        failureCount: results.filter((r) => !r.success).length,
      })
    } catch (error) {
      this.logger.error(`Schedule execution failed: ${scheduleId}`, {
        scheduleId,
        error: error instanceof Error ? error.message : String(error),
      })

      // Update failure stats
      job.stats.failedExecutions++
      job.stats.lastExecutedAt = new Date()
    }
  }

  /**
   * Execute schedule for all matching servers
   */
  private async executeScheduleForServers(
    schedule: ScheduledCommand,
  ): Promise<ScheduleExecutionResult[]> {
    // Get active servers
    const servers = await this.serverService.findActiveServersWithRcon()

    // Filter servers based on schedule criteria
    const targetServers = servers.filter((server) => this.shouldExecuteOnServer(server, schedule))

    if (targetServers.length === 0) {
      this.logger.debug(`No servers match criteria for schedule: ${schedule.id}`)
      return []
    }

    // Check concurrency limits
    const executableServers = targetServers.filter((server) =>
      this.canExecuteOnServer(server.serverId, schedule.id),
    )

    this.logger.debug(`Executing schedule ${schedule.id} on ${executableServers.length} servers`, {
      scheduleId: schedule.id,
      totalServers: servers.length,
      targetServers: targetServers.length,
      executableServers: executableServers.length,
    })

    // Execute on all servers concurrently
    const results = await Promise.allSettled(
      executableServers.map((server) => this.executeOnServer(server, schedule)),
    )

    // Convert settled results to execution results
    return results.map((result, index) => {
      const server = executableServers[index]
      if (result.status === "fulfilled") {
        return result.value
      } else {
        return {
          commandId: schedule.id,
          serverId: server?.serverId ?? 0,
          success: false,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          executedAt: new Date(),
          executionTimeMs: 0,
        }
      }
    })
  }

  /**
   * Execute schedule on a single server
   */
  private async executeOnServer(
    server: ServerInfo,
    schedule: ScheduledCommand,
  ): Promise<ScheduleExecutionResult> {
    // Track concurrent execution
    this.addServerExecution(server.serverId, schedule.id)

    try {
      const executor = this.getExecutorForSchedule(schedule)

      // Create execution context
      const context: ScheduleExecutionContext = {
        schedule,
        server,
        attempt: 1,
        isRetry: false,
      }

      // Execute with retry logic
      let lastError: Error | undefined
      const maxRetries = schedule.maxRetries || this.config.defaultMaxRetries

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          context.attempt = attempt
          context.isRetry = attempt > 1

          const result = await executor.execute(context)
          return result
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))

          if (attempt <= maxRetries && schedule.retryOnFailure) {
            this.logger.debug(`Retrying schedule ${schedule.id} on server ${server.serverId}`, {
              attempt,
              maxRetries,
              error: lastError.message,
            })

            // Exponential backoff for retries
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
            await new Promise((resolve) => setTimeout(resolve, delay))
          } else {
            break
          }
        }
      }

      // All retries failed
      throw lastError || new Error("Unknown execution error")
    } finally {
      // Remove from concurrent execution tracking
      this.removeServerExecution(server.serverId, schedule.id)
    }
  }

  /**
   * Check if schedule should execute on a server
   */
  private shouldExecuteOnServer(server: ServerInfo, schedule: ScheduledCommand): boolean {
    const filter = schedule.serverFilter
    if (!filter) {
      return true
    }

    // Check server ID filters
    if (filter.serverIds && !filter.serverIds.includes(server.serverId)) {
      return false
    }

    if (filter.excludeServerIds && filter.excludeServerIds.includes(server.serverId)) {
      return false
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

    return true
  }

  /**
   * Check if execution can proceed on server (concurrency limits)
   */
  private canExecuteOnServer(serverId: number, scheduleId: string): boolean {
    const executions = this.serverExecutions.get(serverId) || new Set()

    // Check if this specific schedule is already running on this server
    if (executions.has(scheduleId)) {
      return false
    }

    return executions.size < this.config.maxConcurrentPerServer
  }

  /**
   * Track server execution
   */
  private addServerExecution(serverId: number, scheduleId: string): void {
    if (!this.serverExecutions.has(serverId)) {
      this.serverExecutions.set(serverId, new Set())
    }
    this.serverExecutions.get(serverId)!.add(scheduleId)
  }

  /**
   * Remove server execution tracking
   */
  private removeServerExecution(serverId: number, scheduleId: string): void {
    const executions = this.serverExecutions.get(serverId)
    if (executions) {
      executions.delete(scheduleId)
      if (executions.size === 0) {
        this.serverExecutions.delete(serverId)
      }
    }
  }

  /**
   * Get appropriate executor for a schedule
   */
  private getExecutorForSchedule(schedule: ScheduledCommand): IScheduledCommandExecutor {
    const command = typeof schedule.command === "string" ? schedule.command : ""

    // Determine command type
    let executorType: string
    if (command.startsWith("say") || command.startsWith("admin_say")) {
      executorType = "server-message"
    } else if (["status", "stats", "info", "fps_max"].some((cmd) => command.startsWith(cmd))) {
      executorType = "stats-snapshot"
    } else {
      // Default to server message for unknown commands
      executorType = "server-message"
    }

    const executor = this.executors.get(executorType)
    if (!executor) {
      throw new ScheduleError(
        `No executor found for command type: ${executorType}`,
        ScheduleErrorCode.INVALID_COMMAND,
        schedule.id,
      )
    }

    return executor
  }

  /**
   * Initialize command executors
   */
  private initializeExecutors(): void {
    this.executors.set("server-message", new ServerMessageCommand(this.logger, this.rconService))
    this.executors.set("stats-snapshot", new StatsSnapshotCommand(this.logger, this.rconService))
  }

  /**
   * Create initial job statistics
   */
  private createInitialStats(): ScheduleJobStats {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTimeMs: 0,
      averageExecutionTimeMs: 0,
    }
  }

  /**
   * Update job statistics after execution
   */
  private updateJobStats(job: ScheduleJob, results: ScheduleExecutionResult[]): void {
    const { stats } = job

    stats.totalExecutions += results.length
    stats.successfulExecutions += results.filter((r) => r.success).length
    stats.failedExecutions += results.filter((r) => !r.success).length
    stats.lastExecutedAt = new Date()

    const totalTime = results.reduce((sum, r) => sum + r.executionTimeMs, 0)
    stats.totalExecutionTimeMs += totalTime

    if (stats.totalExecutions > 0) {
      stats.averageExecutionTimeMs = stats.totalExecutionTimeMs / stats.totalExecutions
    }
  }

  /**
   * Add results to execution history with retention
   */
  private addToHistory(job: ScheduleJob, results: ScheduleExecutionResult[]): void {
    job.history.push(...results)

    // Apply retention policy
    const maxHistory = 100 // Keep last 100 executions
    if (job.history.length > maxHistory) {
      job.history.splice(0, job.history.length - maxHistory)
    }
  }

  /**
   * Validate cron expression
   */
  private isValidCronExpression(expression: string): boolean {
    try {
      cron.validate(expression)
      return true
    } catch {
      return false
    }
  }
}
