/**
 * RCON Retry Backoff Calculator Service
 *
 * Implements exponential backoff logic for failed RCON connections with
 * support for dormant server management and configurable retry policies.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { RetryBackoffCalculator, ServerFailureState, RconConfig } from "../types/rcon.types"
import { ServerRetryStatus } from "../types/rcon.types"

export class RetryBackoffCalculatorService implements RetryBackoffCalculator {
  private readonly failureStates = new Map<number, ServerFailureState>()
  private readonly logger: ILogger
  private readonly config: Required<
    Pick<
      RconConfig,
      "maxConsecutiveFailures" | "backoffMultiplier" | "maxBackoffMinutes" | "dormantRetryMinutes"
    >
  >

  constructor(logger: ILogger, config: RconConfig) {
    this.logger = logger
    this.config = {
      maxConsecutiveFailures: config.maxConsecutiveFailures ?? 10,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      maxBackoffMinutes: config.maxBackoffMinutes ?? 30,
      dormantRetryMinutes: config.dormantRetryMinutes ?? 60,
    }

    this.logger.debug("Retry backoff calculator initialized", {
      maxConsecutiveFailures: this.config.maxConsecutiveFailures,
      backoffMultiplier: this.config.backoffMultiplier,
      maxBackoffMinutes: this.config.maxBackoffMinutes,
      dormantRetryMinutes: this.config.dormantRetryMinutes,
    })
  }

  /**
   * Calculate the next retry time using exponential backoff
   */
  calculateNextRetry(failureCount: number): Date {
    if (failureCount >= this.config.maxConsecutiveFailures) {
      // Server is dormant, use fixed dormant retry interval
      const dormantDelayMs = this.config.dormantRetryMinutes * 60 * 1000
      return new Date(Date.now() + dormantDelayMs)
    }

    // Exponential backoff: base delay of 30 seconds, multiplied by backoffMultiplier^(failureCount-1)
    const baseDelaySeconds = 30
    const exponentialDelay =
      baseDelaySeconds * Math.pow(this.config.backoffMultiplier, failureCount - 1)

    // Cap at maximum backoff time
    const maxDelaySeconds = this.config.maxBackoffMinutes * 60
    const finalDelaySeconds = Math.min(exponentialDelay, maxDelaySeconds)

    return new Date(Date.now() + finalDelaySeconds * 1000)
  }

  /**
   * Determine if a server should be retried based on its current failure state
   */
  shouldRetry(failureState: ServerFailureState): boolean {
    const now = new Date()

    // Always retry healthy servers
    if (failureState.status === ServerRetryStatus.HEALTHY) {
      return true
    }

    // Check if enough time has passed for retry
    if (failureState.nextRetryAt && now >= failureState.nextRetryAt) {
      return true
    }

    this.logger.debug(`Server ${failureState.serverId} is in backoff`, {
      serverId: failureState.serverId,
      status: failureState.status,
      consecutiveFailures: failureState.consecutiveFailures,
      nextRetryAt: failureState.nextRetryAt?.toISOString(),
      timeUntilRetry: failureState.nextRetryAt
        ? Math.ceil((failureState.nextRetryAt.getTime() - now.getTime()) / 1000)
        : null,
    })

    return false
  }

  /**
   * Reset failure state when a server successfully connects
   */
  resetFailureState(serverId: number): void {
    const previousState = this.failureStates.get(serverId)

    if (previousState && previousState.consecutiveFailures > 0) {
      this.logger.info(`Server ${serverId} recovered from failure state`, {
        serverId,
        previousFailures: previousState.consecutiveFailures,
        previousStatus: previousState.status,
        wasRecovering: previousState.status !== ServerRetryStatus.HEALTHY,
      })
    }

    // Remove from tracking map - healthy servers don't need tracking
    this.failureStates.delete(serverId)
  }

  /**
   * Record a failure and update backoff timing
   */
  recordFailure(serverId: number): ServerFailureState {
    const existingState = this.failureStates.get(serverId)
    const failureCount = (existingState?.consecutiveFailures ?? 0) + 1
    const now = new Date()

    const nextRetryAt = this.calculateNextRetry(failureCount)
    const status = this.determineRetryStatus(failureCount)

    const newState: ServerFailureState = {
      serverId,
      consecutiveFailures: failureCount,
      lastFailureAt: now,
      nextRetryAt,
      status,
    }

    this.failureStates.set(serverId, newState)

    // Log state transitions
    if (!existingState) {
      this.logger.warn(`Server ${serverId} entered failure state`, {
        serverId,
        consecutiveFailures: failureCount,
        status,
        nextRetryAt: nextRetryAt.toISOString(),
      })
    } else if (existingState.status !== status) {
      this.logger.error(`Server ${serverId} transitioned to ${status}`, {
        serverId,
        consecutiveFailures: failureCount,
        previousStatus: existingState.status,
        newStatus: status,
        nextRetryAt: nextRetryAt.toISOString(),
      })
    } else {
      this.logger.debug(`Server ${serverId} failure count increased`, {
        serverId,
        consecutiveFailures: failureCount,
        status,
        nextRetryAt: nextRetryAt.toISOString(),
      })
    }

    return newState
  }

  /**
   * Get current failure state for a server
   */
  getFailureState(serverId: number): ServerFailureState {
    return (
      this.failureStates.get(serverId) ?? {
        serverId,
        consecutiveFailures: 0,
        lastFailureAt: null,
        nextRetryAt: null,
        status: ServerRetryStatus.HEALTHY,
      }
    )
  }

  /**
   * Get all currently tracked failure states
   */
  getAllFailureStates(): ServerFailureState[] {
    return Array.from(this.failureStates.values())
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
    const states = this.getAllFailureStates()

    const stats = {
      totalServersInFailureState: states.length,
      healthyServers: 0,
      backingOffServers: 0,
      dormantServers: 0,
    }

    for (const state of states) {
      switch (state.status) {
        case ServerRetryStatus.HEALTHY:
          stats.healthyServers++
          break
        case ServerRetryStatus.BACKING_OFF:
          stats.backingOffServers++
          break
        case ServerRetryStatus.DORMANT:
          stats.dormantServers++
          break
      }
    }

    return stats
  }

  /**
   * Determine retry status based on failure count
   */
  private determineRetryStatus(failureCount: number): ServerRetryStatus {
    if (failureCount === 0) {
      return ServerRetryStatus.HEALTHY
    } else if (failureCount >= this.config.maxConsecutiveFailures) {
      return ServerRetryStatus.DORMANT
    } else {
      return ServerRetryStatus.BACKING_OFF
    }
  }
}
