/**
 * Server Lifecycle Coordinator
 *
 * Fans out per-server cleanup on SERVER_SHUTDOWN events. Without this, every
 * game-server restart leaves stranded entries across 8+ modules: sessions,
 * match state, map cache, schedule executions, RCON connections,
 * notification config, parser cache, and RCON failure-state. Each is bounded
 * by `# servers` so it doesn't leak per-event, but it accumulates per
 * surprise restart and operators run dozens of those per week.
 *
 * Each step is best-effort and isolated — a single throwing dependency must
 * not block cleanup for the others. Errors are logged with the serverId for
 * triage but do NOT propagate (the handler ack discipline is upstream).
 */

import type { IIngressService } from "@/modules/ingress/ingress.types"
import type { IMapService } from "@/modules/map/map.service"
import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { INotificationConfigRepository } from "@/modules/rcon/repositories/notification-config.repository"
import type { IRconService } from "@/modules/rcon/types/rcon.types"
import type { IRconScheduleService } from "@/modules/rcon/types/schedule.types"
import type { ServerStateManager } from "@/modules/server/state/server-state-manager"
import type { ILogger } from "@/shared/utils/logger.types"

export interface ServerLifecycleDeps {
  sessionService: IPlayerSessionService
  serverStateManager: ServerStateManager
  matchService: IMatchService
  mapService: IMapService
  notificationConfigRepository: INotificationConfigRepository
  rconScheduleService: IRconScheduleService
  /**
   * Only the per-serverId reset is needed for cleanup. The full calculator
   * lives privately inside ServerMonitoringCommand; a narrow type lets the
   * coordinator stay decoupled and the caller pass a no-op when the
   * monitoring command isn't wired (current default).
   */
  retryBackoffCalculator: { resetFailureState(serverId: number): void }
  rconService: IRconService
  ingressService: IIngressService
  /**
   * Only the per-server cache reset is needed here; a narrow type keeps the
   * coordinator decoupled from the full server service surface.
   */
  serverService: { clearServerCache(serverId: number): void }
}

export class ServerLifecycleCoordinator {
  constructor(
    private readonly deps: ServerLifecycleDeps,
    private readonly logger: ILogger,
  ) {}

  /**
   * Handle SERVER_SHUTDOWN (and SERVER_REMOVED in the future). Idempotent.
   * Each cleanup runs in its own try/catch so one failure doesn't block the
   * rest of the fan-out.
   */
  async handleShutdown(serverId: number): Promise<void> {
    this.logger.info(`Cleaning up state for shutdown of server ${serverId}`)

    // Async cleanups (Promise-returning). Use allSettled so independent
    // failures stay independent.
    const asyncCleanups: Array<{ name: string; work: Promise<unknown> }> = [
      {
        name: "sessionService.clearServerSessions",
        work: this.deps.sessionService.clearServerSessions(serverId),
      },
      {
        name: "rconService.disconnect",
        work: this.deps.rconService.disconnect(serverId),
      },
    ]

    const results = await Promise.allSettled(asyncCleanups.map((c) => c.work))
    for (let i = 0; i < results.length; i++) {
      const result = results[i]!
      const name = asyncCleanups[i]!.name
      if (result.status === "rejected") {
        this.logger.warn(
          `Server-shutdown cleanup failed (${name}, serverId=${serverId}): ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        )
      }
    }

    // Synchronous cleanups. Wrap each individually so one throwing module
    // doesn't skip the rest.
    this.safe("serverStateManager.clearServerState", () =>
      this.deps.serverStateManager.clearServerState(serverId),
    )
    this.safe("matchService.resetMatchStats", () =>
      this.deps.matchService.resetMatchStats(serverId),
    )
    this.safe("mapService.clearServerCache", () => this.deps.mapService.clearServerCache(serverId))
    // NOTE: gameDetectionService.gameCache is keyed by `address:port`, not
    // serverId, so we can't surgically drop a single server entry without
    // additional context. The periodic sweep handles that cache.
    this.safe("notificationConfigRepository.clearServerCache", () =>
      this.deps.notificationConfigRepository.clearServerCache(serverId),
    )
    this.safe("rconScheduleService.dropServer", () =>
      this.deps.rconScheduleService.dropServer(serverId),
    )
    this.safe("retryBackoffCalculator.resetFailureState", () =>
      this.deps.retryBackoffCalculator.resetFailureState(serverId),
    )
    this.safe("ingressService.dropServer", () => this.deps.ingressService.dropServer(serverId))
    this.safe("serverService.clearServerCache", () =>
      this.deps.serverService.clearServerCache(serverId),
    )

    this.logger.debug(`Server ${serverId} shutdown fan-out complete`)
  }

  private safe(name: string, fn: () => unknown | undefined): void {
    try {
      fn()
    } catch (error) {
      this.logger.warn(
        `Server-shutdown cleanup failed (${name}): ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
