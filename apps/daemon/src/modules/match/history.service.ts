/**
 * PlayerHistory Service
 *
 * Accumulates per-player counters during a match and periodically writes
 * snapshots into Players_History. Also provides a simple timer runner.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { IMatchRepository, PlayerHistoryData } from "./match.types"

export class PlayerHistoryService {
  private dirtyPlayers: Map<number, PlayerHistoryData> = new Map()
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly repository: IMatchRepository,
    private readonly logger: ILogger,
  ) {}

  markDirty(snapshot: PlayerHistoryData): void {
    const existing = this.dirtyPlayers.get(snapshot.playerId)
    if (!existing) {
      this.dirtyPlayers.set(snapshot.playerId, snapshot)
      return
    }
    // Merge numeric counters additively; keep most recent eventTime
    this.dirtyPlayers.set(snapshot.playerId, {
      ...existing,
      eventTime: snapshot.eventTime > existing.eventTime ? snapshot.eventTime : existing.eventTime,
      kills: (existing.kills ?? 0) + (snapshot.kills ?? 0),
      deaths: (existing.deaths ?? 0) + (snapshot.deaths ?? 0),
      suicides: (existing.suicides ?? 0) + (snapshot.suicides ?? 0),
      shots: (existing.shots ?? 0) + (snapshot.shots ?? 0),
      hits: (existing.hits ?? 0) + (snapshot.hits ?? 0),
      headshots: (existing.headshots ?? 0) + (snapshot.headshots ?? 0),
      teamkills: (existing.teamkills ?? 0) + (snapshot.teamkills ?? 0),
      connectionTime: (existing.connectionTime ?? 0) + (snapshot.connectionTime ?? 0),
      killStreak: Math.max(existing.killStreak ?? 0, snapshot.killStreak ?? 0),
      deathStreak: Math.max(existing.deathStreak ?? 0, snapshot.deathStreak ?? 0),
      skill: snapshot.skill ?? existing.skill,
      skillChange: (existing.skillChange ?? 0) + (snapshot.skillChange ?? 0),
      game: snapshot.game ?? existing.game,
    })
  }

  async flush(): Promise<void> {
    if (this.dirtyPlayers.size === 0) return
    const entries = Array.from(this.dirtyPlayers.values())
    this.dirtyPlayers.clear()
    // Write sequentially to keep code simple; repository handles transaction scope internally
    for (const data of entries) {
      try {
        await this.repository.createPlayerHistory(data)
      } catch (error) {
        this.logger.warn(`Failed to write player history for ${data.playerId}: ${String(error)}`)
      }
    }
  }

  start(intervalMs: number = 60_000): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.flush()
    }, intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
