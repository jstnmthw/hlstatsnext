/**
 * Session Synchronization Service
 *
 * Periodically synchronizes sessions with RCON status to catch any missed players
 * and create sessions for players who are connected but don't have sessions.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IRconService } from "@/modules/rcon/types/rcon.types"
import type { IServerService } from "@/modules/server/server.types"
import type { IPlayerService } from "@/modules/player/player.types"

export class SessionSyncService {
  private syncIntervals = new Map<number, NodeJS.Timeout>()

  constructor(
    private readonly sessionService: IPlayerSessionService,
    private readonly rconService: IRconService,
    private readonly serverService: IServerService,
    private readonly playerService: IPlayerService,
    private readonly logger: ILogger,
  ) {}

  /**
   * Start periodic session synchronization for a server
   */
  startSync(serverId: number, intervalMs: number = 60000): void {
    if (this.syncIntervals.has(serverId)) {
      this.logger.debug(`Session sync already running for server ${serverId}`)
      return
    }

    this.logger.info(`Starting session sync for server ${serverId} (interval: ${intervalMs}ms)`)

    const interval = setInterval(async () => {
      try {
        await this.syncServerSessions(serverId)
      } catch (error) {
        this.logger.error(`Session sync failed for server ${serverId}`, {
          serverId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }, intervalMs)

    this.syncIntervals.set(serverId, interval)
  }

  /**
   * Stop session synchronization for a server
   */
  stopSync(serverId: number): void {
    const interval = this.syncIntervals.get(serverId)
    if (interval) {
      clearInterval(interval)
      this.syncIntervals.delete(serverId)
      this.logger.info(`Stopped session sync for server ${serverId}`)
    }
  }

  /**
   * Stop all session synchronizations
   */
  stopAll(): void {
    for (const [serverId, interval] of this.syncIntervals) {
      clearInterval(interval)
      this.logger.info(`Stopped session sync for server ${serverId}`)
    }
    this.syncIntervals.clear()
  }

  /**
   * Manually trigger session synchronization for a server
   */
  async syncServerSessions(serverId: number): Promise<void> {
    this.logger.debug(`Starting session sync for server ${serverId}`)

    try {
      // Use the existing synchronizeServerSessions method from sessionService
      const sessionsCreated = await this.sessionService.synchronizeServerSessions(serverId)

      this.logger.info(`Session sync completed for server ${serverId}`, {
        serverId,
        sessionsCreated,
      })
    } catch (error) {
      this.logger.error(`Session sync failed for server ${serverId}`, {
        serverId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Get sync status for all servers
   */
  getSyncStatus(): Array<{ serverId: number; isRunning: boolean }> {
    const allServerIds = Array.from(this.syncIntervals.keys())
    return allServerIds.map((serverId) => ({
      serverId,
      isRunning: this.syncIntervals.has(serverId),
    }))
  }
}
