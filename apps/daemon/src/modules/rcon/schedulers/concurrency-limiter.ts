/**
 * Concurrency Limiter
 *
 * Tracks in-flight schedule executions per server and enforces a global
 * per-server concurrency cap. Also prevents the same schedule from running
 * twice concurrently on the same server.
 */

export class ConcurrencyLimiter {
  private readonly serverExecutions = new Map<number, Set<string>>()
  private readonly maxConcurrentPerServer: number

  constructor(maxConcurrentPerServer: number) {
    this.maxConcurrentPerServer = maxConcurrentPerServer
  }

  /**
   * Check whether `scheduleId` is eligible to execute on `serverId`. Returns
   * false if the schedule is already running on that server, or if the cap
   * is reached.
   */
  canExecute(serverId: number, scheduleId: string): boolean {
    const executions = this.serverExecutions.get(serverId) || new Set<string>()
    if (executions.has(scheduleId)) {
      return false
    }
    return executions.size < this.maxConcurrentPerServer
  }

  /** Mark a schedule as in-flight on a server. */
  track(serverId: number, scheduleId: string): void {
    let executions = this.serverExecutions.get(serverId)
    if (!executions) {
      executions = new Set<string>()
      this.serverExecutions.set(serverId, executions)
    }
    executions.add(scheduleId)
  }

  /** Release an in-flight slot; cleans up the per-server entry when empty. */
  release(serverId: number, scheduleId: string): void {
    const executions = this.serverExecutions.get(serverId)
    if (!executions) {
      return
    }
    executions.delete(scheduleId)
    if (executions.size === 0) {
      this.serverExecutions.delete(serverId)
    }
  }

  /**
   * Drop all tracking for a server (SERVER_SHUTDOWN fan-out). Returns true
   * if there was any tracking to drop. Idempotent.
   */
  dropServer(serverId: number): boolean {
    return this.serverExecutions.delete(serverId)
  }

  /** Drop all tracking entirely (used at shutdown). */
  clear(): void {
    this.serverExecutions.clear()
  }
}
