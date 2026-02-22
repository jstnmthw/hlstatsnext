/**
 * RCON Schedule Service
 *
 * Manages scheduled RCON command execution using node-cron.
 * Handles job lifecycle, execution tracking, and error recovery.
 */

import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IServerStatusEnricher } from "@/modules/server/enrichers/server-status-enricher"
import type { IServerService, ServerInfo } from "@/modules/server/server.types"
import type { IEventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus.types"
import { EventType, type ServerAuthenticatedEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import * as cron from "node-cron"
import { ServerMessageCommand } from "../commands/scheduled/server-message.command"
import { ServerMonitoringCommand } from "../commands/scheduled/server-monitoring.command"
import type { IRconService } from "../types/rcon.types"
import type {
  IRconScheduleService,
  IScheduledCommandExecutor,
  ScheduleConfig,
  ScheduledCommand,
  ScheduleExecutionContext,
  ScheduleExecutionResult,
  ScheduleJob,
  ScheduleJobStats,
  ScheduleStatus,
} from "../types/schedule.types"
import { ScheduleError, ScheduleErrorCode } from "../types/schedule.types"

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
  private readonly eventBus: IEventBus
  private readonly serverStatusEnricher: IServerStatusEnricher
  private readonly sessionService: IPlayerSessionService

  /** Active scheduled jobs */
  private readonly jobs = new Map<string, ScheduleJob>()

  /** Command executors by type */
  private readonly executors = new Map<string, IScheduledCommandExecutor>()

  /** Track concurrent executions per server */
  private readonly serverExecutions = new Map<number, Set<string>>()

  /** Service state */
  private isStarted = false

  /** Server monitoring command instance for immediate connections */
  private serverMonitoringCommand?: ServerMonitoringCommand

  /** Event handler ID for server authentication */
  private eventHandlerId?: string

  constructor(
    logger: ILogger,
    rconService: IRconService,
    serverService: IServerService,
    config: ScheduleConfig,
    eventBus: IEventBus,
    serverStatusEnricher: IServerStatusEnricher,
    sessionService: IPlayerSessionService,
  ) {
    this.logger = logger
    this.rconService = rconService
    this.serverService = serverService
    this.config = config
    this.eventBus = eventBus
    this.serverStatusEnricher = serverStatusEnricher
    this.sessionService = sessionService

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

      // Subscribe to SERVER_AUTHENTICATED events for immediate RCON connections
      this.eventHandlerId = this.eventBus.on(
        EventType.SERVER_AUTHENTICATED,
        this.handleServerAuthenticated.bind(this),
      )

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

    // Unsubscribe from events
    if (this.eventHandlerId) {
      this.eventBus.off(this.eventHandlerId)
      this.eventHandlerId = undefined
    }

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
      this.logger.warn(
        `Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression}, skipping this schedule`,
      )
      return // Skip invalid schedules instead of crashing the daemon
    }

    // Check if executor exists for the command type
    const commandType = schedule.command.type
    const executor = this.executors.get(commandType)
    if (!executor) {
      this.logger.warn(
        `No executor found for command type: ${commandType} (schedule: ${schedule.id}), skipping this schedule`,
      )
      return // Skip schedules with missing executors instead of crashing the daemon
    }

    // Validate the command
    if (!(await executor.validate(schedule))) {
      this.logger.warn(`Schedule validation failed: ${schedule.id}, skipping this schedule`)
      return // Skip invalid schedules instead of crashing the daemon
    }

    try {
      // Create the cron task
      const task = cron.schedule(schedule.cronExpression, () => this.executeSchedule(schedule.id), {
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
      cronExpression: job.schedule.cronExpression,
      nextExecution: undefined, // Would need cron parser to calculate
      lastExecution: job.stats.lastExecutionStart,
      status: job.schedule.enabled
        ? "scheduled"
        : ("stopped" as "scheduled" | "running" | "stopped"),
      stats: job.stats,
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
        successCount: results.filter((r) => r.status === "success").length,
        failureCount: results.filter((r) => r.status === "failed").length,
      })
    } catch (error) {
      this.logger.error(`Schedule execution failed: ${scheduleId}`, {
        scheduleId,
        error: error instanceof Error ? error.message : String(error),
      })

      // Update failure stats
      job.stats.failedExecutions++
      job.stats.lastExecutionStart = new Date()
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
        const endTime = new Date()
        const executionId = `${schedule.id}-${server?.serverId ?? 0}-${Date.now()}`
        return {
          executionId,
          startTime: endTime, // Use same time since we don't have start time
          endTime,
          duration: 0,
          status: "failed" as const,
          serversProcessed: 0,
          commandsSent: 0,
          errors: [result.reason instanceof Error ? result.reason.message : String(result.reason)],
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
      const executionId = `${schedule.id}-${server.serverId}-${Date.now()}`
      const context: ScheduleExecutionContext = {
        scheduleId: schedule.id,
        executionId,
        schedule,
        startTime: new Date(),
      }

      // Execute with retry logic
      let lastError: Error | undefined
      const maxRetries = schedule.maxRetries || this.config.defaultMaxRetries

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          const startTime = new Date()
          const executorResult = await executor.execute(context)
          const endTime = new Date()

          // Convert executor result to ScheduleExecutionResult
          const result: ScheduleExecutionResult = {
            executionId,
            startTime,
            endTime,
            duration: endTime.getTime() - startTime.getTime(),
            status: "success" as const,
            serversProcessed: executorResult.serversProcessed,
            commandsSent: executorResult.commandsSent,
          }
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
    // Get command type from the command object
    const commandType = schedule.command.type

    const executor = this.executors.get(commandType)
    if (!executor) {
      // This should not happen during execution since we validate during registration
      // but we still throw an error here for safety
      throw new ScheduleError(
        `No executor found for command type: ${commandType}`,
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
    const messageCommand = new ServerMessageCommand(
      this.logger,
      this.rconService,
      this.serverService,
    )

    // Register message executor for supported HUD command types
    for (const type of ["hlx_csay", "hlx_tsay", "hlx_typehud"]) {
      this.executors.set(type, messageCommand)
    }

    // Create server monitoring command and store reference for immediate connections
    this.serverMonitoringCommand = new ServerMonitoringCommand(
      this.logger,
      this.rconService,
      this.serverService,
      this.serverStatusEnricher,
      this.sessionService,
    )
    this.executors.set("server-monitoring", this.serverMonitoringCommand)
  }

  /**
   * Create initial job statistics
   */
  private createInitialStats(): ScheduleJobStats {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
    }
  }

  /**
   * Update job statistics after execution
   */
  private updateJobStats(job: ScheduleJob, results: ScheduleExecutionResult[]): void {
    const { stats } = job

    stats.totalExecutions += results.length
    stats.successfulExecutions += results.filter((r) => r.status === "success").length
    stats.failedExecutions += results.filter((r) => r.status === "failed").length

    // Update execution timestamps
    if (results.length > 0) {
      const latestResult = results[results.length - 1]
      if (latestResult) {
        stats.lastExecutionStart = latestResult.startTime
        stats.lastExecutionEnd = latestResult.endTime
        stats.lastExecutionDuration = latestResult.duration
      }
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
   * Handle SERVER_AUTHENTICATED events for immediate RCON connections
   */
  private async handleServerAuthenticated(event: ServerAuthenticatedEvent): Promise<void> {
    // If we have a server monitoring command, use it for immediate connections
    if (this.serverMonitoringCommand) {
      setImmediate(() => {
        this.serverMonitoringCommand!.connectToServerImmediately(event.serverId).catch((error) => {
          this.logger.error(
            `Failed immediate RCON connection for server ${event.serverId}: ${error}`,
          )
        })
      })
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
