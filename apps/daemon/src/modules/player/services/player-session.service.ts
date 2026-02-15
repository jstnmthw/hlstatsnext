/**
 * Player Session Service
 *
 * Manages active player sessions, providing mapping between database player IDs
 * and game server user IDs. Handles session synchronization from RCON status
 * and respects server IgnoreBots configuration.
 */

import type { IRconService, PlayerInfo } from "@/modules/rcon/types/rcon.types"
import type { IServerService } from "@/modules/server/server.types"
import type { ILogger } from "@/shared/utils/logger.types"
import { sanitizePlayerName } from "@/shared/utils/validation"
import type { Player } from "@repo/database/client"
import type {
  CreatePlayerSessionData,
  IPlayerSessionRepository,
  IPlayerSessionService,
  ISessionRepositoryWithStats,
  PlayerSession,
  SessionSyncOptions,
  UpdatePlayerSessionData,
} from "../types/player-session.types"
import type { IPlayerRepository, IPlayerResolver } from "../types/player.types"

// Extended Player type with uniqueIds relation for fallback session creation
interface PlayerWithUniqueIds extends Player {
  uniqueIds?: Array<{ uniqueId: string; game: string }>
}

export class PlayerSessionService implements IPlayerSessionService {
  constructor(
    private readonly sessionRepository: IPlayerSessionRepository,
    private readonly rconService: IRconService,
    private readonly serverService: IServerService,
    private readonly playerResolver: IPlayerResolver,
    private readonly playerRepository: IPlayerRepository,
    private readonly logger: ILogger,
  ) {}

  async createSession(sessionData: CreatePlayerSessionData): Promise<PlayerSession> {
    this.logger.debug(
      `Creating session for ${sessionData.playerName} (${sessionData.steamId}) on server ${sessionData.serverId}`,
    )

    return await this.sessionRepository.createSession(sessionData)
  }

  async updateSession(
    serverId: number,
    gameUserId: number,
    updates: UpdatePlayerSessionData,
  ): Promise<PlayerSession | null> {
    return await this.sessionRepository.updateSession(serverId, gameUserId, updates)
  }

  async removeSession(serverId: number, gameUserId: number): Promise<boolean> {
    return await this.sessionRepository.deleteSession(serverId, gameUserId)
  }

  async clearServerSessions(serverId: number): Promise<number> {
    return await this.sessionRepository.deleteServerSessions(serverId)
  }

  async getSessionByGameUserId(
    serverId: number,
    gameUserId: number,
  ): Promise<PlayerSession | null> {
    return await this.sessionRepository.getSessionByGameUserId(serverId, gameUserId)
  }

  async getSessionByPlayerId(serverId: number, playerId: number): Promise<PlayerSession | null> {
    return await this.sessionRepository.getSessionByPlayerId(serverId, playerId)
  }

  async getSessionBySteamId(serverId: number, steamId: string): Promise<PlayerSession | null> {
    return await this.sessionRepository.getSessionBySteamId(serverId, steamId)
  }

  async getServerSessions(serverId: number): Promise<PlayerSession[]> {
    return await this.sessionRepository.getServerSessions(serverId)
  }

  async synchronizeServerSessions(
    serverId: number,
    options: SessionSyncOptions = {},
  ): Promise<number> {
    try {
      this.logger.info(`Synchronizing player sessions for server ${serverId}`)

      // Clear existing sessions if requested
      if (options.clearExisting !== false) {
        const cleared = await this.clearServerSessions(serverId)
        this.logger.debug(`Cleared ${cleared} existing sessions for server ${serverId}`)
      }

      // Get server configuration
      const ignoreBots =
        options.respectIgnoreBots !== false
          ? await this.serverService.getServerConfigBoolean(serverId, "IgnoreBots", true)
          : false

      // Get current server status via RCON
      if (!this.rconService.isConnected(serverId)) {
        this.logger.debug(`Connecting to server ${serverId} for session sync`)
        await this.rconService.connect(serverId)
      }

      const status = await this.rconService.getStatus(serverId)
      const playerList = status.playerList || []

      let createdCount = 0
      let skippedBots = 0
      let errors = 0

      for (const player of playerList) {
        try {
          // Skip bots if IgnoreBots is enabled
          if (ignoreBots && player.isBot) {
            skippedBots++
            this.logger.debug(
              `Skipping bot ${player.name} for session sync (IgnoreBots=${ignoreBots})`,
            )
            continue
          }

          await this.createSessionFromPlayerInfo(serverId, player)
          createdCount++
        } catch (error) {
          errors++
          this.logger.error(
            `Failed to create session for player ${player.name} (${player.uniqueid}): ${error}`,
          )
        }
      }

      this.logger.info(
        `Session sync complete for server ${serverId}: ${createdCount} created, ${skippedBots} bots skipped, ${errors} errors`,
      )

      return createdCount
    } catch (error) {
      this.logger.error(`Failed to synchronize sessions for server ${serverId}: ${error}`)
      throw error
    }
  }

  async convertToGameUserIds(serverId: number, playerIds: number[]): Promise<number[]> {
    this.logger.debug(
      `Converting ${playerIds.length} database player IDs to game user IDs for server ${serverId}`,
    )

    const gameUserIds: number[] = []

    // Performance optimization: get all server sessions at once instead of individual lookups
    const allSessions = await this.getServerSessions(serverId)
    const sessionMap = new Map<number, PlayerSession>()

    // Build a map for fast lookup
    for (const session of allSessions) {
      sessionMap.set(session.databasePlayerId, session)
    }

    const missingPlayerIds: number[] = []

    for (const playerId of playerIds) {
      const session = sessionMap.get(playerId)

      if (!session) {
        missingPlayerIds.push(playerId)
        continue
      }

      this.logger.debug(`Found session for player ${playerId} (${session.playerName})`)

      // Skip bots (they should never receive private messages)
      if (session.isBot) {
        this.logger.info(
          `Skipping bot ${session.playerName} (database ID: ${playerId}) for private message`,
        )
        continue
      }

      gameUserIds.push(session.gameUserId)
    }

    // Handle missing sessions with fallback creation
    if (missingPlayerIds.length > 0) {
      this.logger.debug(`Processing ${missingPlayerIds.length} players without sessions`)

      for (const playerId of missingPlayerIds) {
        this.logger.warn(
          `No session found for database player ID ${playerId} on server ${serverId} - attempting fallback session creation`,
        )

        // Try to create session from RCON status as fallback
        const fallbackSession = await this.createFallbackSession(serverId, playerId)
        if (fallbackSession) {
          this.logger.debug(
            `Created fallback session for player ${playerId} (${fallbackSession.playerName})`,
          )

          if (!fallbackSession.isBot) {
            gameUserIds.push(fallbackSession.gameUserId)
          }
        }
      }
    }

    this.logger.debug(
      `Conversion complete: ${gameUserIds.length} valid game user IDs for server ${serverId}`,
    )

    return gameUserIds
  }

  /**
   * Attempt to create a session from RCON status for a player who doesn't have one
   */
  private async createFallbackSession(
    serverId: number,
    playerId: number,
  ): Promise<PlayerSession | null> {
    try {
      // Get player info from database with uniqueIds
      const player = await this.getPlayerWithUniqueIds(playerId)
      if (!player) {
        this.logger.warn(
          `Cannot create fallback session - player ${playerId} not found in database`,
        )
        return null
      }

      // Get server status to find the player
      if (!this.rconService.isConnected(serverId)) {
        this.logger.debug(`Connecting to server ${serverId} for fallback session creation`)
        await this.rconService.connect(serverId)
      }

      const status = await this.rconService.getStatus(serverId)
      if (!status?.playerList || status.playerList.length === 0) {
        this.logger.warn(`No players in RCON status for fallback session creation`)
        return null
      }

      this.logger.debug(`RCON status shows ${status.playerList.length} players online`)

      // Extract unique IDs from the player's uniqueIds relation
      const uniqueIds = player.uniqueIds?.map((uid) => uid.uniqueId) || []

      this.logger.debug(
        `Looking for database player ID ${playerId} (${player.lastName}) with ${uniqueIds.length} unique IDs`,
      )

      // Try to match by Steam ID or unique ID
      const matchingPlayer = status.playerList.find(
        (p: PlayerInfo) => uniqueIds.includes(p.uniqueid) || p.name === player.lastName,
      )

      if (!matchingPlayer) {
        this.logger.warn(
          `Database player ID ${playerId} (${player.lastName}) not found in RCON status`,
        )
        return null
      }

      this.logger.debug(
        `Found matching RCON player for database ID ${playerId}: ${matchingPlayer.name}`,
      )

      // Create session from RCON data
      // Apply same unique ID logic for bots as in createSessionFromPlayerInfo
      const steamId =
        matchingPlayer.isBot && matchingPlayer.uniqueid === "BOT"
          ? `BOT_${serverId}_${sanitizePlayerName(matchingPlayer.name)}`
          : matchingPlayer.uniqueid || "UNKNOWN"

      const sessionData = {
        serverId,
        gameUserId: matchingPlayer.userid,
        databasePlayerId: playerId,
        steamId,
        playerName: player.lastName,
        isBot: matchingPlayer.isBot, // Use the isBot field from RCON PlayerInfo directly
      }

      return await this.createSession(sessionData)
    } catch (error) {
      this.logger.error(`Failed to create fallback session for player ${playerId}`, {
        serverId,
        playerId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  async canSendPrivateMessage(serverId: number, playerId: number): Promise<boolean> {
    this.logger.info(
      `Checking if can send private message to database player ID ${playerId} on server ${serverId}`,
    )

    const session = await this.getSessionByPlayerId(serverId, playerId)

    if (!session) {
      this.logger.warn(`No session found for database player ID ${playerId} on server ${serverId}`)

      // Debug: List all current sessions to see what we have
      const allSessions = await this.getServerSessions(serverId)
      this.logger.debug(`Current sessions on server ${serverId}: ${allSessions.length} sessions`)

      this.logger.warn(`Attempting fallback session creation for database player ID ${playerId}`)

      // Try to create a fallback session
      const fallbackSession = await this.createFallbackSession(serverId, playerId)
      if (fallbackSession) {
        this.logger.info(
          `Created fallback session for database player ID ${playerId} (${fallbackSession.playerName})`,
        )

        // Now check again with the new session
        return !fallbackSession.isBot
      }

      this.logger.error(
        `Failed to create fallback session for database player ID ${playerId} on server ${serverId}`,
      )
      return false
    }

    this.logger.debug(`Found session for database player ID ${playerId} (${session.playerName})`)

    // Never send private messages to bots
    if (session.isBot) {
      this.logger.debug(`Cannot send private message to bot ${session.playerName}`)
      return false
    }

    return true
  }

  /**
   * Get session statistics for monitoring
   */
  async getSessionStats(): Promise<{
    totalSessions: number
    serverSessions: Record<number, number>
    botSessions: number
    realPlayerSessions: number
  }> {
    if ("getStats" in this.sessionRepository) {
      return (this.sessionRepository as ISessionRepositoryWithStats).getStats()
    }
    return {
      totalSessions: 0,
      serverSessions: {},
      botSessions: 0,
      realPlayerSessions: 0,
    }
  }

  // Private helper methods

  /**
   * Get a player with uniqueIds relation from database
   */
  private async getPlayerWithUniqueIds(playerId: number): Promise<PlayerWithUniqueIds | null> {
    const player = await this.playerRepository.findById(playerId, {
      include: { uniqueIds: true },
    })

    // Type guard function to ensure the result has uniqueIds
    function hasUniqueIds(obj: unknown): obj is PlayerWithUniqueIds {
      return obj !== null && typeof obj === "object" && "playerId" in obj && "uniqueIds" in obj
    }

    return hasUniqueIds(player) ? player : null
  }

  /**
   * Create a session from RCON PlayerInfo
   */
  private async createSessionFromPlayerInfo(
    serverId: number,
    playerInfo: PlayerInfo,
  ): Promise<PlayerSession> {
    // Look up or create database player
    let databasePlayerId: number

    try {
      // For bots, we still need a database entry if we're tracking them
      const game = await this.serverService.getServerGame(serverId)

      // Create unique Steam ID for bots to avoid collisions
      // All bots normally have uniqueid "BOT", so we make it unique per bot name
      const uniqueId =
        playerInfo.isBot && playerInfo.uniqueid === "BOT"
          ? `BOT_${serverId}_${sanitizePlayerName(playerInfo.name)}`
          : playerInfo.uniqueid

      databasePlayerId = await this.playerResolver.getOrCreatePlayer(
        uniqueId,
        playerInfo.name,
        game,
        serverId,
      )
    } catch (error) {
      this.logger.error(
        `Failed to get/create database player for ${playerInfo.name} (${playerInfo.uniqueid}): ${error}`,
      )
      throw error
    }

    const sessionData: CreatePlayerSessionData = {
      serverId,
      gameUserId: playerInfo.userid,
      databasePlayerId,
      steamId: playerInfo.uniqueid,
      playerName: playerInfo.name,
      isBot: playerInfo.isBot,
    }

    return await this.createSession(sessionData)
  }
}
