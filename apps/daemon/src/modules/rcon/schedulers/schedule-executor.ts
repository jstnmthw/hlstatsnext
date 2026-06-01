/**
 * Schedule Executor
 *
 * Owns the "execute a schedule across all matching servers" pipeline:
 * filter -> concurrency check -> fan out -> per-server retry with
 * exponential backoff -> result collection.
 *
 * The orchestrator (`RconScheduleService`) injects the executor lookup,
 * filter, and concurrency limiter so this class doesn't reach into shared
 * state directly.
 */

import type { IServerService, ServerInfo } from "@/modules/server/server.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type {
  IScheduledCommandExecutor,
  ScheduleConfig,
  ScheduledCommand,
  ScheduleExecutionContext,
  ScheduleExecutionResult,
} from "../types/schedule.types"
import { ScheduleError, ScheduleErrorCode } from "../types/schedule.types"
import type { ConcurrencyLimiter } from "./concurrency-limiter"
import type { ServerFilterResolver } from "./server-filter-resolver"

/** Cap on exponential backoff between retries (ms). */
const MAX_RETRY_BACKOFF_MS = 10_000

export type ExecutorLookup = (commandType: string) => IScheduledCommandExecutor | undefined

export class ScheduleExecutor {
  private readonly logger: ILogger
  private readonly serverService: IServerService
  private readonly config: ScheduleConfig
  private readonly filter: ServerFilterResolver
  private readonly limiter: ConcurrencyLimiter
  private readonly lookupExecutor: ExecutorLookup

  constructor(
    logger: ILogger,
    serverService: IServerService,
    config: ScheduleConfig,
    filter: ServerFilterResolver,
    limiter: ConcurrencyLimiter,
    lookupExecutor: ExecutorLookup,
  ) {
    this.logger = logger
    this.serverService = serverService
    this.config = config
    this.filter = filter
    this.limiter = limiter
    this.lookupExecutor = lookupExecutor
  }

  /**
   * Execute a schedule across every matching active server, honouring the
   * concurrency limiter. Returns one `ScheduleExecutionResult` per server
   * that was attempted (a rejected promise becomes a "failed" result so the
   * caller can still account for it in stats/history).
   */
  async executeForServers(schedule: ScheduledCommand): Promise<ScheduleExecutionResult[]> {
    const servers = await this.serverService.findActiveServersWithRcon()
    const targetServers = servers.filter((server) => this.filter.matches(server, schedule))

    if (targetServers.length === 0) {
      this.logger.debug(`No servers match criteria for schedule: ${schedule.id}`)
      return []
    }

    const executableServers = targetServers.filter((server) =>
      this.limiter.canExecute(server.serverId, schedule.id),
    )

    this.logger.debug(`Executing schedule ${schedule.id} on ${executableServers.length} servers`, {
      scheduleId: schedule.id,
      totalServers: servers.length,
      targetServers: targetServers.length,
      executableServers: executableServers.length,
    })

    const settled = await Promise.allSettled(
      executableServers.map((server) => this.executeOnServer(server, schedule)),
    )

    return settled.map((result, index) => {
      const server = executableServers[index]
      if (result.status === "fulfilled") {
        return result.value
      }
      const endTime = new Date()
      const executionId = `${schedule.id}-${server?.serverId ?? 0}-${Date.now()}`
      return {
        executionId,
        startTime: endTime,
        endTime,
        duration: 0,
        status: "failed" as const,
        serversProcessed: 0,
        commandsSent: 0,
        errors: [result.reason instanceof Error ? result.reason.message : String(result.reason)],
      }
    })
  }

  /**
   * Execute a schedule on a single server with retry + exponential backoff.
   * Tracks the in-flight slot via the concurrency limiter and always
   * releases it in a `finally`, even when retries are exhausted.
   */
  private async executeOnServer(
    server: ServerInfo,
    schedule: ScheduledCommand,
  ): Promise<ScheduleExecutionResult> {
    this.limiter.track(server.serverId, schedule.id)

    try {
      const executor = this.resolveExecutor(schedule)
      const executionId = `${schedule.id}-${server.serverId}-${Date.now()}`
      const context: ScheduleExecutionContext = {
        scheduleId: schedule.id,
        executionId,
        schedule,
        server,
        startTime: new Date(),
      }

      const maxRetries = schedule.maxRetries ?? this.config.defaultMaxRetries
      let lastError: Error | undefined

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          const startTime = new Date()
          const executorResult = await executor.execute(context)
          const endTime = new Date()

          return {
            executionId,
            startTime,
            endTime,
            duration: endTime.getTime() - startTime.getTime(),
            status: "success" as const,
            serversProcessed: executorResult.serversProcessed,
            commandsSent: executorResult.commandsSent,
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))

          if (attempt <= maxRetries && schedule.retryOnFailure) {
            this.logger.debug(`Retrying schedule ${schedule.id} on server ${server.serverId}`, {
              attempt,
              maxRetries,
              error: lastError.message,
            })
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), MAX_RETRY_BACKOFF_MS)
            await new Promise((resolve) => setTimeout(resolve, delay))
          } else {
            break
          }
        }
      }

      throw lastError || new Error("Unknown execution error")
    } finally {
      this.limiter.release(server.serverId, schedule.id)
    }
  }

  private resolveExecutor(schedule: ScheduledCommand): IScheduledCommandExecutor {
    const commandType = schedule.command.type
    const executor = this.lookupExecutor(commandType)
    if (!executor) {
      throw new ScheduleError(
        `No executor found for command type: ${commandType}`,
        ScheduleErrorCode.INVALID_COMMAND,
        schedule.id,
      )
    }
    return executor
  }
}
