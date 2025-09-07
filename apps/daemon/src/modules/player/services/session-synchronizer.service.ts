/**
 * Session Synchronizer Service
 *
 * Handles synchronization of player sessions from RCON status data.
 * Used during daemon startup to populate sessions for already-connected players.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerSessionService, SessionSyncResult } from "../types/player-session.types"
import type { IServerService } from "@/modules/server/server.types"

export interface ISessionSynchronizerService {
  /**
   * Synchronize sessions for a single server
   */
  synchronizeServer(serverId: number): Promise<SessionSyncResult>

  /**
   * Synchronize sessions for all active servers
   */
  synchronizeAllServers(): Promise<SessionSyncResult>
}

export class SessionSynchronizerService implements ISessionSynchronizerService {
  constructor(
    private readonly sessionService: IPlayerSessionService,
    private readonly serverService: IServerService,
    private readonly logger: ILogger,
  ) {}

  /**
   * Synchronize player sessions for a single server
   */
  async synchronizeServer(serverId: number): Promise<SessionSyncResult> {
    try {
      this.logger.info(`Starting session synchronization for server ${serverId}`)

      // Use the session service to synchronize (it handles IgnoreBots internally)
      const createdCount = await this.sessionService.synchronizeServerSessions(serverId)

      const result: SessionSyncResult = {
        created: createdCount,
        updated: 0,
        removed: 0,
        unmatched: 0,
      }

      this.logger.info(
        `Session synchronization completed for server ${serverId}: ${createdCount} sessions created`,
      )

      return result
    } catch (error) {
      this.logger.error(`Failed to synchronize sessions for server ${serverId}: ${error}`)
      throw error
    }
  }

  /**
   * Synchronize player sessions for all active servers with RCON
   */
  async synchronizeAllServers(): Promise<SessionSyncResult> {
    try {
      this.logger.info("Starting session synchronization for all active servers")

      // Get all active servers with RCON capabilities
      const activeServers = await this.serverService.findActiveServersWithRcon()

      if (activeServers.length === 0) {
        this.logger.warn("No active servers with RCON found for session synchronization")
        return {
          created: 0,
          updated: 0,
          removed: 0,
          unmatched: 0,
        }
      }

      this.logger.info(`Found ${activeServers.length} active servers for session synchronization`)

      const results: SessionSyncResult[] = []
      let errors = 0

      // Synchronize each server
      for (const server of activeServers) {
        try {
          const result = await this.synchronizeServer(server.serverId)
          results.push(result)
        } catch (error) {
          errors++
          this.logger.error(
            `Failed to synchronize server ${server.serverId} (${server.name}): ${error}`,
          )
        }
      }

      // Aggregate results
      const totalResult = results.reduce(
        (acc, result) => ({
          created: acc.created + result.created,
          updated: acc.updated + result.updated,
          removed: acc.removed + result.removed,
          unmatched: acc.unmatched + result.unmatched,
        }),
        { created: 0, updated: 0, removed: 0, unmatched: 0 },
      )

      this.logger.info(
        `Session synchronization completed for all servers: ${totalResult.created} sessions created, ${errors} errors`,
        {
          serversProcessed: activeServers.length,
          errors,
          ...totalResult,
        },
      )

      return totalResult
    } catch (error) {
      this.logger.error(`Failed to synchronize sessions for all servers: ${error}`)
      throw error
    }
  }

  /**
   * Validate session synchronization by checking consistency
   */
  async validateSynchronization(serverId: number): Promise<{
    valid: boolean
    issues: string[]
  }> {
    const issues: string[] = []

    try {
      const sessions = await this.sessionService.getServerSessions(serverId)

      // Check for duplicate game user IDs
      const gameUserIds = sessions.map((s) => s.gameUserId)
      const duplicateGameUserIds = gameUserIds.filter(
        (id, index) => gameUserIds.indexOf(id) !== index,
      )

      if (duplicateGameUserIds.length > 0) {
        issues.push(`Duplicate game user IDs found: ${duplicateGameUserIds.join(", ")}`)
      }

      // Check for duplicate Steam IDs
      const steamIds = sessions.map((s) => s.steamId)
      const duplicateSteamIds = steamIds.filter((id, index) => steamIds.indexOf(id) !== index)

      if (duplicateSteamIds.length > 0) {
        issues.push(`Duplicate Steam IDs found: ${duplicateSteamIds.join(", ")}`)
      }

      // Check for invalid game user IDs
      const invalidGameUserIds = sessions.filter((s) => s.gameUserId <= 0)
      if (invalidGameUserIds.length > 0) {
        issues.push(
          `Invalid game user IDs found: ${invalidGameUserIds.map((s) => s.gameUserId).join(", ")}`,
        )
      }

      // Check for invalid database player IDs
      const invalidDatabaseIds = sessions.filter((s) => s.databasePlayerId <= 0)
      if (invalidDatabaseIds.length > 0) {
        issues.push(
          `Invalid database player IDs found: ${invalidDatabaseIds.map((s) => s.databasePlayerId).join(", ")}`,
        )
      }

      this.logger.debug(`Session validation for server ${serverId}`, {
        serverId,
        sessionCount: sessions.length,
        issueCount: issues.length,
        issues,
      })

      return {
        valid: issues.length === 0,
        issues,
      }
    } catch (error) {
      const errorMessage = `Failed to validate sessions: ${error}`
      issues.push(errorMessage)
      this.logger.error(errorMessage)

      return {
        valid: false,
        issues,
      }
    }
  }

  /**
   * Get synchronization statistics
   */
  async getStats(): Promise<{
    totalSessions: number
    serverSessions: Record<number, number>
    botSessions: number
    realPlayerSessions: number
  }> {
    return this.sessionService.getSessionStats()
  }
}
