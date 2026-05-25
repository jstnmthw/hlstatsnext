/**
 * RCON Schedule Service
 *
 * Orchestrates scheduled RCON command execution. Manages job lifecycle
 * (registration, enable/disable, cron task wiring) and delegates the
 * actual fan-out + retry + concurrency tracking + per-schedule stats to
 * dedicated collaborators in this directory.
 */

import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IServerStatusEnricher } from "@/modules/server/enrichers/server-status-enricher"
import type { IServerService } from "@/modules/server/server.types"
import type { IEventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus.types"
import { EventType, type ServerAuthenticatedEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { ScheduledTask } from "node-cron"
import * as cron from "node-cron"
import { ServerMessageCommand } from "../commands/scheduled/server-message.command"
import { ServerMonitoringCommand } from "../commands/scheduled/server-monitoring.command"
import type { IRconService } from "../types/rcon.types"
import type {
  IRconScheduleService,
  IScheduledCommandExecutor,
  ScheduleConfig,
  ScheduledCommand,
  ScheduleExecutionResult,
  ScheduleStatus,
} from "../types/schedule.types"
import { ScheduleError, ScheduleErrorCode } from "../types/schedule.types"
import { ConcurrencyLimiter } from "./concurrency-limiter"
import { ScheduleExecutor } from "./schedule-executor"
import { ScheduleJobStatsTracker } from "./schedule-job-stats"
import { ServerFilterResolver } from "./server-filter-resolver"

interface InternalScheduleJob {
  schedule: ScheduledCommand
  task: ScheduledTask
  tracker: ScheduleJobStatsTracker
}

export class RconScheduleService implements IRconScheduleService {
  private readonly logger: ILogger
  private readonly rconService: IRconService
  private readonly serverService: IServerService
  private readonly config: ScheduleConfig
  private readonly eventBus: IEventBus
  private readonly serverStatusEnricher: IServerStatusEnricher
  private readonly sessionService: IPlayerSessionService

  private readonly jobs = new Map<string, InternalScheduleJob>()
  private readonly executors = new Map<string, IScheduledCommandExecutor>()
  private readonly limiter: ConcurrencyLimiter
  private readonly filter: ServerFilterResolver
  private readonly executor: ScheduleExecutor

  private isStarted = false
  private serverMonitoringCommand?: ServerMonitoringCommand
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

    this.limiter = new ConcurrencyLimiter(config.maxConcurrentPerServer)
    this.filter = new ServerFilterResolver(logger)
    this.executor = new ScheduleExecutor(
      logger,
      serverService,
      config,
      this.filter,
      this.limiter,
      (type) => this.executors.get(type),
    )

    this.initializeExecutors()
  }

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
      const enabledSchedules = this.config.schedules.filter((schedule) => schedule.enabled)

      for (const schedule of enabledSchedules) {
        await this.registerSchedule(schedule)
      }

      this.isStarted = true

      for (const job of this.jobs.values()) {
        job.task.start()
        this.logger.info(
          `Started cron task for schedule: ${job.schedule.id} (${job.schedule.cronExpression})`,
        )
      }

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

  async stop(): Promise<void> {
    if (!this.isStarted) {
      this.logger.debug("RCON scheduler not started")
      return
    }

    this.logger.info("Stopping RCON scheduler service...")

    if (this.eventHandlerId) {
      this.eventBus.off(this.eventHandlerId)
      this.eventHandlerId = undefined
    }

    // `task.stop()` pauses node-cron's tick but leaves the task in its
    // internal registry. For a normal process exit this is harmless, but it
    // matters for tests and hot-reload — `destroy()` removes the task from
    // the registry so it can't fire again and can be GC'd.
    for (const [scheduleId, job] of this.jobs) {
      try {
        job.task.stop()
        ;(job.task as { destroy?: () => void }).destroy?.()
        this.logger.debug(`Stopped schedule: ${scheduleId}`)
      } catch (error) {
        this.logger.warn(`Error stopping schedule ${scheduleId}: ${error}`)
      }
    }

    this.jobs.clear()
    this.limiter.clear()

    this.isStarted = false
    this.logger.info("RCON scheduler stopped")
  }

  async registerSchedule(schedule: ScheduledCommand): Promise<void> {
    if (this.jobs.has(schedule.id)) {
      throw new ScheduleError(
        `Schedule with ID ${schedule.id} already exists`,
        ScheduleErrorCode.SCHEDULE_ALREADY_EXISTS,
        schedule.id,
      )
    }

    if (!this.isValidCronExpression(schedule.cronExpression)) {
      this.logger.warn(
        `Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression}, skipping this schedule`,
      )
      return
    }

    const commandType = schedule.command.type
    const executor = this.executors.get(commandType)
    if (!executor) {
      this.logger.warn(
        `No executor found for command type: ${commandType} (schedule: ${schedule.id}), skipping this schedule`,
      )
      return
    }

    if (!(await executor.validate(schedule))) {
      this.logger.warn(`Schedule validation failed: ${schedule.id}, skipping this schedule`)
      return
    }

    try {
      const task = cron.schedule(schedule.cronExpression, () => this.executeSchedule(schedule.id), {
        timezone: "UTC",
      })

      const job: InternalScheduleJob = {
        schedule,
        task,
        tracker: new ScheduleJobStatsTracker(),
      }

      this.jobs.set(schedule.id, job)

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
      ;(job.task as { destroy?: () => void }).destroy?.()
      this.jobs.delete(scheduleId)

      this.logger.info(`Unregistered schedule: ${scheduleId}`)
    } catch (error) {
      this.logger.error(`Failed to unregister schedule ${scheduleId}: ${error}`)
      throw error
    }
  }

  async updateSchedule(schedule: ScheduledCommand): Promise<void> {
    if (this.jobs.has(schedule.id)) {
      await this.unregisterSchedule(schedule.id)
    }
    await this.registerSchedule(schedule)
  }

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

  getSchedules(): ScheduledCommand[] {
    return Array.from(this.jobs.values()).map((job) => job.schedule)
  }

  getExecutionHistory(scheduleId: string, limit = 50): ScheduleExecutionResult[] {
    const job = this.jobs.get(scheduleId)
    if (!job) {
      return []
    }
    return job.tracker.getHistory(limit)
  }

  getScheduleStatus(): ScheduleStatus[] {
    return Array.from(this.jobs.values()).map((job) => ({
      scheduleId: job.schedule.id,
      name: job.schedule.name,
      enabled: job.schedule.enabled,
      cronExpression: job.schedule.cronExpression,
      nextExecution: undefined,
      lastExecution: job.tracker.stats.lastExecutionStart,
      status: job.schedule.enabled
        ? "scheduled"
        : ("stopped" as "scheduled" | "running" | "stopped"),
      stats: job.tracker.stats,
    }))
  }

  async executeScheduleNow(scheduleId: string): Promise<ScheduleExecutionResult[]> {
    const job = this.jobs.get(scheduleId)
    if (!job) {
      throw new ScheduleError(
        `Schedule not found: ${scheduleId}`,
        ScheduleErrorCode.SCHEDULE_NOT_FOUND,
        scheduleId,
      )
    }

    return this.executor.executeForServers(job.schedule)
  }

  dropServer(serverId: number): void {
    if (this.limiter.dropServer(serverId)) {
      this.logger.debug(`Dropped schedule execution tracking for server ${serverId}`)
    }
  }

  /** Cron tick handler: run the schedule and roll results into stats/history. */
  private async executeSchedule(scheduleId: string): Promise<void> {
    const job = this.jobs.get(scheduleId)
    if (!job) {
      this.logger.error(`Attempted to execute unknown schedule: ${scheduleId}`)
      return
    }

    const { schedule, tracker } = job
    this.logger.debug(`Executing schedule: ${scheduleId} (${schedule.name})`)

    try {
      const results = await this.executor.executeForServers(schedule)

      tracker.recordResults(results)
      tracker.appendHistory(results)

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
      tracker.recordFailure()
    }
  }

  private initializeExecutors(): void {
    const messageCommand = new ServerMessageCommand(
      this.logger,
      this.rconService,
      this.serverService,
    )

    for (const type of ["hlx_csay", "hlx_tsay", "hlx_typehud"]) {
      this.executors.set(type, messageCommand)
    }

    this.serverMonitoringCommand = new ServerMonitoringCommand(
      this.logger,
      this.rconService,
      this.serverService,
      this.serverStatusEnricher,
      this.sessionService,
    )
    this.executors.set("server-monitoring", this.serverMonitoringCommand)
  }

  private async handleServerAuthenticated(event: ServerAuthenticatedEvent): Promise<void> {
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

  private isValidCronExpression(expression: string): boolean {
    try {
      cron.validate(expression)
      return true
    } catch {
      return false
    }
  }
}
