/**
 * Schedule Job Stats
 *
 * Value object that encapsulates per-schedule execution statistics and
 * bounded execution history. Keeps the 100-item cap and stats-update logic
 * in one place so the service doesn't reach into stats/history maps directly.
 */

import type { ScheduleExecutionResult, ScheduleJobStats } from "../types/schedule.types"

/** Maximum number of execution results retained per schedule. */
const MAX_HISTORY = 100

export class ScheduleJobStatsTracker {
  private readonly statsData: ScheduleJobStats
  private readonly historyData: ScheduleExecutionResult[]

  constructor() {
    this.statsData = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
    }
    this.historyData = []
  }

  /** Live reference to the underlying stats object (consumers may read fields). */
  get stats(): ScheduleJobStats {
    return this.statsData
  }

  /** Live reference to the underlying history array. */
  get history(): ScheduleExecutionResult[] {
    return this.historyData
  }

  /** Record a single execution failure (used when the run itself blew up). */
  recordFailure(at: Date = new Date()): void {
    this.statsData.failedExecutions++
    this.statsData.lastExecutionStart = at
  }

  /**
   * Record a batch of per-server results: bumps counters and updates the
   * last-execution timestamps using the latest result in the batch.
   */
  recordResults(results: ScheduleExecutionResult[]): void {
    this.statsData.totalExecutions += results.length
    this.statsData.successfulExecutions += results.filter((r) => r.status === "success").length
    this.statsData.failedExecutions += results.filter((r) => r.status === "failed").length

    if (results.length > 0) {
      const latest = results[results.length - 1]
      if (latest) {
        this.statsData.lastExecutionStart = latest.startTime
        this.statsData.lastExecutionEnd = latest.endTime
        this.statsData.lastExecutionDuration = latest.duration
      }
    }
  }

  /** Append results to history and trim to the retention cap. */
  appendHistory(results: ScheduleExecutionResult[]): void {
    this.historyData.push(...results)
    if (this.historyData.length > MAX_HISTORY) {
      this.historyData.splice(0, this.historyData.length - MAX_HISTORY)
    }
  }

  /** Return the most recent `limit` history entries. */
  getHistory(limit: number): ScheduleExecutionResult[] {
    return this.historyData.slice(-limit)
  }
}
