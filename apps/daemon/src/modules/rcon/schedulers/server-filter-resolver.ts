/**
 * Server Filter Resolver
 *
 * Encapsulates evaluation of `ScheduledCommand.serverFilter` against a
 * `ServerInfo`. Player count filtering is intentionally a no-op until
 * server status is plumbed through; the resolver still logs a debug line
 * so behaviour is preserved.
 */

import type { ServerInfo } from "@/modules/server/server.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { ScheduledCommand } from "../types/schedule.types"

export class ServerFilterResolver {
  private readonly logger: ILogger

  constructor(logger: ILogger) {
    this.logger = logger
  }

  /** Return true if the schedule should execute on the given server. */
  matches(server: ServerInfo, schedule: ScheduledCommand): boolean {
    const filter = schedule.serverFilter
    if (!filter) {
      return true
    }

    if (filter.serverIds && !filter.serverIds.includes(server.serverId)) {
      return false
    }

    if (filter.excludeServerIds && filter.excludeServerIds.includes(server.serverId)) {
      return false
    }

    if (filter.minPlayers !== undefined || filter.maxPlayers !== undefined) {
      this.logger.debug(
        `Player count filtering skipped for schedule ${schedule.id} - not implemented`,
      )
    }

    return true
  }
}
