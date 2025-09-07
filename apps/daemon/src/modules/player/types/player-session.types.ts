/**
 * Player Session Types
 *
 * Types and interfaces for managing active player sessions that map
 * between database player IDs and game server user IDs.
 */

/**
 * Represents an active player session on a game server
 */
export interface PlayerSession {
  /** Server ID where the player is connected */
  serverId: number

  /** Temporary user ID assigned by the game server (e.g., 2 from "Player<2><STEAM_ID><CT>") */
  gameUserId: number

  /** Permanent database player ID */
  databasePlayerId: number

  /** Player's Steam ID */
  steamId: string

  /** Current player name */
  playerName: string

  /** Whether this player is a bot */
  isBot: boolean

  /** When the player connected to the server */
  connectedAt: Date

  /** Last time the session was updated */
  lastSeen: Date
}

/**
 * Data required to create a new player session
 */
export interface CreatePlayerSessionData {
  serverId: number
  gameUserId: number
  databasePlayerId: number
  steamId: string
  playerName: string
  isBot: boolean
}

/**
 * Data for updating an existing player session
 */
export interface UpdatePlayerSessionData {
  playerName?: string
  lastSeen?: Date
}

/**
 * Optional interface for repositories that support statistics
 */
export interface ISessionRepositoryWithStats {
  getStats(): Promise<{
    totalSessions: number
    serverSessions: Record<number, number>
    botSessions: number
    realPlayerSessions: number
  }>
}

/**
 * Repository interface for player session persistence
 */
export interface IPlayerSessionRepository {
  /**
   * Create a new player session
   */
  createSession(sessionData: CreatePlayerSessionData): Promise<PlayerSession>

  /**
   * Update an existing player session
   */
  updateSession(
    serverId: number,
    gameUserId: number,
    updates: UpdatePlayerSessionData,
  ): Promise<PlayerSession | null>

  /**
   * Delete a player session by game user ID
   */
  deleteSession(serverId: number, gameUserId: number): Promise<boolean>

  /**
   * Delete all sessions for a server
   */
  deleteServerSessions(serverId: number): Promise<number>

  /**
   * Get a session by game user ID
   */
  getSessionByGameUserId(serverId: number, gameUserId: number): Promise<PlayerSession | null>

  /**
   * Get a session by database player ID
   */
  getSessionByPlayerId(serverId: number, playerId: number): Promise<PlayerSession | null>

  /**
   * Get a session by Steam ID
   */
  getSessionBySteamId(serverId: number, steamId: string): Promise<PlayerSession | null>

  /**
   * Get all active sessions for a server
   */
  getServerSessions(serverId: number): Promise<PlayerSession[]>

  /**
   * Get all active sessions across all servers
   */
  getAllSessions(): Promise<PlayerSession[]>
}

/**
 * Service interface for player session management
 */
export interface IPlayerSessionService {
  /**
   * Create a new player session
   */
  createSession(sessionData: CreatePlayerSessionData): Promise<PlayerSession>

  /**
   * Update an existing player session
   */
  updateSession(
    serverId: number,
    gameUserId: number,
    updates: UpdatePlayerSessionData,
  ): Promise<PlayerSession | null>

  /**
   * Remove a player session
   */
  removeSession(serverId: number, gameUserId: number): Promise<boolean>

  /**
   * Remove all sessions for a server
   */
  clearServerSessions(serverId: number): Promise<number>

  /**
   * Get session by various lookup keys
   */
  getSessionByGameUserId(serverId: number, gameUserId: number): Promise<PlayerSession | null>
  getSessionByPlayerId(serverId: number, playerId: number): Promise<PlayerSession | null>
  getSessionBySteamId(serverId: number, steamId: string): Promise<PlayerSession | null>

  /**
   * Get all active sessions for a server
   */
  getServerSessions(serverId: number): Promise<PlayerSession[]>

  /**
   * Initialize sessions from current server status (for daemon startup)
   */
  synchronizeServerSessions(serverId: number): Promise<number>

  /**
   * Convert database player IDs to game user IDs for RCON commands
   * Automatically filters out bots and missing sessions
   */
  convertToGameUserIds(serverId: number, playerIds: number[]): Promise<number[]>

  /**
   * Check if a player session exists and is not a bot (for RCON messaging)
   */
  canSendPrivateMessage(serverId: number, playerId: number): Promise<boolean>

  /**
   * Get session statistics for monitoring
   */
  getSessionStats(): Promise<SessionStats>
}

/**
 * Options for session synchronization
 */
export interface SessionSyncOptions {
  /** Whether to clear existing sessions before sync */
  clearExisting?: boolean

  /** Whether to respect IgnoreBots server config */
  respectIgnoreBots?: boolean
}

/**
 * Result of session synchronization
 */
export interface SessionSyncResult {
  /** Number of sessions created */
  created: number

  /** Number of existing sessions updated */
  updated: number

  /** Number of sessions removed */
  removed: number

  /** Number of players that couldn't be matched */
  unmatched: number
}

/**
 * Session statistics for monitoring
 */
export interface SessionStats {
  /** Total active sessions */
  totalSessions: number

  /** Sessions per server */
  serverSessions: Record<number, number>

  /** Number of bot sessions */
  botSessions: number

  /** Number of real player sessions */
  realPlayerSessions: number

  /** Oldest session timestamp */
  oldestSession?: Date

  /** Most recent session timestamp */
  newestSession?: Date
}
