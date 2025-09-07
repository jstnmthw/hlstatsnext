/**
 * Player Notification Service
 *
 * Handles player notifications via RCON using database-driven command resolution.
 * Automatically resolves the appropriate RCON command based on server configuration.
 * Never sends private messages to bots regardless of configuration.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { IServerService } from "@/modules/server/server.types"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import { RconCommandService } from "./rcon-command.service"
import { CommandResolverService, type CommandType } from "./command-resolver.service"

export interface NotificationOptions {
  /** Command type to use for notifications */
  commandType?: CommandType

  /** Include player name in message for servers without private messaging */
  includePlayerName?: boolean

  /** Delay between batch notifications (ms) */
  batchDelay?: number

  /** Maximum retries on command failure */
  maxRetries?: number

  /** Force individual commands even if batch is supported */
  forceSingle?: boolean
}

export interface PlayerNotificationData {
  playerId: number // Database player ID
  playerName?: string
}

export class PlayerNotificationService {
  constructor(
    private readonly rconCommand: RconCommandService,
    private readonly commandResolver: CommandResolverService,
    private readonly serverService: IServerService,
    private readonly sessionService: IPlayerSessionService,
    private readonly logger: ILogger,
  ) {}

  /**
   * Send a notification to a single player
   * Automatically skips bots as they cannot receive private messages
   */
  async notifyPlayer(
    serverId: number,
    playerId: number, // Database player ID
    message: string,
    options: NotificationOptions = {},
  ): Promise<void> {
    // Check if this player can receive private messages (not a bot)
    const canSend = await this.sessionService.canSendPrivateMessage(serverId, playerId)

    if (!canSend) {
      this.logger.warn(
        `Cannot send private message to player ${playerId} on server ${serverId} (may be bot or offline)`,
      )
      return
    }

    await this.notifyMultiplePlayers(serverId, [{ playerId }], message, options)
  }

  /**
   * Send a notification to multiple players
   * Automatically filters out bots as they cannot receive private messages
   */
  async notifyMultiplePlayers(
    serverId: number,
    players: PlayerNotificationData[],
    message: string,
    options: NotificationOptions = {},
  ): Promise<void> {
    if (players.length === 0) {
      return
    }

    try {
      const commandType = options.commandType || "BroadCastEventsCommand"
      const playerIds = players.map((p) => p.playerId)

      // Filter out bots and offline players - the RconCommandService will handle this
      // through the session service, but we'll log the original count
      this.logger.debug(`Attempting to notify ${players.length} players on server ${serverId}`)

      // Check if server supports private messaging
      const supportsPrivate =
        (await this.commandResolver.supportsBatch(serverId, commandType)) ||
        (await this.hasPrivateMessagingCommand(serverId, commandType))

      if (supportsPrivate) {
        // Use private messaging - RconCommandService will automatically filter bots
        await this.executeWithRetry(
          () =>
            this.rconCommand.execute(serverId, playerIds, message, {
              commandType,
              batchDelay: options.batchDelay,
              forceSingle: options.forceSingle,
            }),
          options.maxRetries ?? 1,
        )
      } else {
        // Use public messaging with player names if requested
        await this.executePublicNotifications(serverId, players, message, options)
      }

      this.logger.debug(`Notification processing completed for server ${serverId}`, {
        serverId,
        requestedPlayers: players.length,
        commandType,
        messageLength: message.length,
        privateMessaging: supportsPrivate,
      })
    } catch (error) {
      this.logger.error(`Failed to send notification to players on server ${serverId}`, {
        serverId,
        playerCount: players.length,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Send a public announcement to all players on server
   */
  async broadcastAnnouncement(
    serverId: number,
    message: string,
    commandType: CommandType = "BroadCastEventsCommandAnnounce",
  ): Promise<void> {
    try {
      await this.rconCommand.executeAnnouncement(serverId, message, commandType)

      this.logger.debug(`Broadcasted announcement on server ${serverId}`, {
        serverId,
        commandType,
        messageLength: message.length,
      })
    } catch (error) {
      this.logger.error(`Failed to broadcast announcement on server ${serverId}`, {
        serverId,
        commandType,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Check if a server supports private messaging
   */
  async supportsPrivateMessaging(
    serverId: number,
    commandType: CommandType = "BroadCastEventsCommand",
  ): Promise<boolean> {
    return await this.hasPrivateMessagingCommand(serverId, commandType)
  }

  /**
   * Execute public notifications with player names (fallback for vanilla servers)
   */
  private async executePublicNotifications(
    serverId: number,
    players: PlayerNotificationData[],
    message: string,
    options: NotificationOptions,
  ): Promise<void> {
    const commandType = options.commandType || "BroadCastEventsCommand"

    if (options.includePlayerName !== false && players.length === 1 && players[0]?.playerName) {
      // Send targeted message with player name
      const targetedMessage = `${players[0].playerName}: ${message}`
      await this.executeWithRetry(
        () =>
          this.rconCommand.execute(serverId, [players[0]!.playerId], targetedMessage, {
            commandType,
            forceSingle: true,
          }),
        options.maxRetries ?? 1,
      )
    } else {
      // Send generic public message
      const playerIds = players.map((p) => p.playerId)
      await this.executeWithRetry(
        () =>
          this.rconCommand.execute(serverId, playerIds, message, {
            commandType,
            batchDelay: options.batchDelay,
            forceSingle: true,
          }),
        options.maxRetries ?? 1,
      )
    }
  }

  /**
   * Check if server has a private messaging command configured
   */
  private async hasPrivateMessagingCommand(
    serverId: number,
    commandType: CommandType,
  ): Promise<boolean> {
    try {
      const command = await this.commandResolver.getCommand(serverId, commandType)

      // Check if command supports private messaging
      return (
        command !== "say" &&
        (command.includes("psay") ||
          command.includes("tell") ||
          command.includes("pm") ||
          command.includes("hlx_") ||
          command.includes("ma_") ||
          command.includes("ms_"))
      )
    } catch (error) {
      this.logger.warn(`Failed to check private messaging support for server ${serverId}`, {
        serverId,
        commandType,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Execute a command with retry logic
   */
  private async executeWithRetry<T>(operation: () => Promise<T>, maxRetries: number): Promise<T> {
    let lastError: unknown

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error

        if (attempt < maxRetries) {
          this.logger.warn(
            `Command execution failed, retrying (${attempt}/${maxRetries}): ${error}`,
          )
          await this.delay(1000 * attempt) // Exponential backoff
        }
      }
    }

    throw lastError
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Clear internal caches (useful for testing or config changes)
   */
  clearCache(): void {
    this.commandResolver.clearCache()
  }

  /**
   * Clear cache for a specific server
   */
  clearServerCache(serverId: number): void {
    this.commandResolver.clearServerCache(serverId)
  }
}
