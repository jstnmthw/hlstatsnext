/**
 * Player Session Repository
 *
 * In-memory repository for managing active player sessions with multiple indexing
 * for efficient lookups by different criteria.
 */

import type {
  IPlayerSessionRepository,
  PlayerSession,
  CreatePlayerSessionData,
  UpdatePlayerSessionData,
} from "../types/player-session.types"
import type { ILogger } from "@/shared/utils/logger.types"

/**
 * In-memory repository for player session management
 * Uses multiple indexes for efficient lookups
 */
export class PlayerSessionRepository implements IPlayerSessionRepository {
  private readonly logger: ILogger

  // Primary storage: Map of session key to session
  private readonly sessions = new Map<string, PlayerSession>()

  // Index: serverId + gameUserId → session key
  private readonly gameUserIdIndex = new Map<string, string>()

  // Index: serverId + databasePlayerId → session key
  private readonly playerIdIndex = new Map<string, string>()

  // Index: serverId + steamId → session key
  private readonly steamIdIndex = new Map<string, string>()

  // Index: serverId → Set of session keys
  private readonly serverIndex = new Map<number, Set<string>>()

  constructor(logger: ILogger) {
    this.logger = logger
  }

  async createSession(sessionData: CreatePlayerSessionData): Promise<PlayerSession> {
    const session: PlayerSession = {
      ...sessionData,
      connectedAt: new Date(),
      lastSeen: new Date(),
    }

    const sessionKey = this.generateSessionKey(sessionData.serverId, sessionData.gameUserId)

    // Check if session already exists
    if (this.sessions.has(sessionKey)) {
      this.logger.warn(
        `Session already exists for server ${sessionData.serverId}, gameUserId ${sessionData.gameUserId}`,
      )
      // Update existing session instead of creating duplicate
      return this.updateExistingSession(sessionKey, {
        playerName: sessionData.playerName,
        lastSeen: new Date(),
      })
    }

    // Store in primary storage
    this.sessions.set(sessionKey, session)

    // Update all indexes
    this.addToIndexes(session, sessionKey)

    this.logger.debug(
      `Created session for player ${session.playerName} (${session.steamId}) on server ${session.serverId}`,
    )

    return session
  }

  async updateSession(
    serverId: number,
    gameUserId: number,
    updates: UpdatePlayerSessionData,
  ): Promise<PlayerSession | null> {
    const sessionKey = this.generateSessionKey(serverId, gameUserId)

    if (!this.sessions.has(sessionKey)) {
      this.logger.warn(`Session not found for server ${serverId}, gameUserId ${gameUserId}`)
      return null
    }

    return this.updateExistingSession(sessionKey, updates)
  }

  async deleteSession(serverId: number, gameUserId: number): Promise<boolean> {
    const sessionKey = this.generateSessionKey(serverId, gameUserId)
    const session = this.sessions.get(sessionKey)

    if (!session) {
      this.logger.debug(`No session to delete for server ${serverId}, gameUserId ${gameUserId}`)
      return false
    }

    // Remove from all indexes
    this.removeFromIndexes(session, sessionKey)

    // Remove from primary storage
    this.sessions.delete(sessionKey)

    this.logger.debug(
      `Deleted session for player ${session.playerName} (${session.steamId}) on server ${serverId}`,
    )

    return true
  }

  async deleteServerSessions(serverId: number): Promise<number> {
    const sessionKeys = this.serverIndex.get(serverId)
    if (!sessionKeys || sessionKeys.size === 0) {
      return 0
    }

    let deletedCount = 0
    for (const sessionKey of sessionKeys) {
      const session = this.sessions.get(sessionKey)
      if (session) {
        this.removeFromIndexes(session, sessionKey)
        this.sessions.delete(sessionKey)
        deletedCount++
      }
    }

    this.logger.debug(`Deleted ${deletedCount} sessions for server ${serverId}`)
    return deletedCount
  }

  async getSessionByGameUserId(
    serverId: number,
    gameUserId: number,
  ): Promise<PlayerSession | null> {
    const sessionKey = this.gameUserIdIndex.get(
      this.generateGameUserIdIndexKey(serverId, gameUserId),
    )
    return sessionKey ? this.sessions.get(sessionKey) || null : null
  }

  async getSessionByPlayerId(serverId: number, playerId: number): Promise<PlayerSession | null> {
    const sessionKey = this.playerIdIndex.get(this.generatePlayerIdIndexKey(serverId, playerId))
    return sessionKey ? this.sessions.get(sessionKey) || null : null
  }

  async getSessionBySteamId(serverId: number, steamId: string): Promise<PlayerSession | null> {
    const sessionKey = this.steamIdIndex.get(this.generateSteamIdIndexKey(serverId, steamId))
    return sessionKey ? this.sessions.get(sessionKey) || null : null
  }

  async getServerSessions(serverId: number): Promise<PlayerSession[]> {
    const sessionKeys = this.serverIndex.get(serverId)
    if (!sessionKeys) {
      return []
    }

    const sessions: PlayerSession[] = []
    for (const sessionKey of sessionKeys) {
      const session = this.sessions.get(sessionKey)
      if (session) {
        sessions.push(session)
      }
    }

    return sessions
  }

  async getAllSessions(): Promise<PlayerSession[]> {
    return Array.from(this.sessions.values())
  }

  /**
   * Get session statistics for monitoring
   */
  getStats(): {
    totalSessions: number
    serverSessions: Record<number, number>
    botSessions: number
    realPlayerSessions: number
  } {
    const stats = {
      totalSessions: this.sessions.size,
      serverSessions: {} as Record<number, number>,
      botSessions: 0,
      realPlayerSessions: 0,
    }

    for (const [serverId, sessionKeys] of this.serverIndex) {
      stats.serverSessions[serverId] = sessionKeys.size
    }

    for (const session of this.sessions.values()) {
      if (session.isBot) {
        stats.botSessions++
      } else {
        stats.realPlayerSessions++
      }
    }

    return stats
  }

  /**
   * Clear all sessions (for testing or reset)
   */
  clear(): void {
    this.sessions.clear()
    this.gameUserIdIndex.clear()
    this.playerIdIndex.clear()
    this.steamIdIndex.clear()
    this.serverIndex.clear()
    this.logger.debug("Cleared all player sessions")
  }

  // Private helper methods

  private generateSessionKey(serverId: number, gameUserId: number): string {
    return `${serverId}:${gameUserId}`
  }

  private generateGameUserIdIndexKey(serverId: number, gameUserId: number): string {
    return `${serverId}:${gameUserId}`
  }

  private generatePlayerIdIndexKey(serverId: number, playerId: number): string {
    return `${serverId}:${playerId}`
  }

  private generateSteamIdIndexKey(serverId: number, steamId: string): string {
    return `${serverId}:${steamId}`
  }

  private updateExistingSession(
    sessionKey: string,
    updates: UpdatePlayerSessionData,
  ): PlayerSession {
    const session = this.sessions.get(sessionKey)!

    // Apply updates
    if (updates.playerName !== undefined) {
      session.playerName = updates.playerName
    }
    if (updates.lastSeen !== undefined) {
      session.lastSeen = updates.lastSeen
    } else {
      session.lastSeen = new Date()
    }

    this.sessions.set(sessionKey, session)

    this.logger.debug(
      `Updated session for player ${session.playerName} on server ${session.serverId}`,
    )

    return session
  }

  private addToIndexes(session: PlayerSession, sessionKey: string): void {
    // Game user ID index
    this.gameUserIdIndex.set(
      this.generateGameUserIdIndexKey(session.serverId, session.gameUserId),
      sessionKey,
    )

    // Database player ID index
    this.playerIdIndex.set(
      this.generatePlayerIdIndexKey(session.serverId, session.databasePlayerId),
      sessionKey,
    )

    // Steam ID index
    this.steamIdIndex.set(
      this.generateSteamIdIndexKey(session.serverId, session.steamId),
      sessionKey,
    )

    // Server index
    if (!this.serverIndex.has(session.serverId)) {
      this.serverIndex.set(session.serverId, new Set())
    }
    this.serverIndex.get(session.serverId)!.add(sessionKey)
  }

  private removeFromIndexes(session: PlayerSession, sessionKey: string): void {
    // Game user ID index
    this.gameUserIdIndex.delete(
      this.generateGameUserIdIndexKey(session.serverId, session.gameUserId),
    )

    // Database player ID index
    this.playerIdIndex.delete(
      this.generatePlayerIdIndexKey(session.serverId, session.databasePlayerId),
    )

    // Steam ID index
    this.steamIdIndex.delete(this.generateSteamIdIndexKey(session.serverId, session.steamId))

    // Server index
    const serverSessions = this.serverIndex.get(session.serverId)
    if (serverSessions) {
      serverSessions.delete(sessionKey)
      if (serverSessions.size === 0) {
        this.serverIndex.delete(session.serverId)
      }
    }
  }
}
