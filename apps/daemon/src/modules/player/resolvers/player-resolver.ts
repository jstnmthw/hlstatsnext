/**
 * Player Resolver Utility
 *
 * Provides utilities for resolving player IDs in complex scenarios,
 * particularly for disconnect events where player IDs may be invalid
 * or require special resolution strategies for bots.
 */

import { sanitizePlayerName } from "@/shared/utils/validation"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository } from "@/modules/player/types/player.types"
import type { IServerRepository } from "@/modules/server/server.types"
import type { PlayerMeta } from "@/shared/types/events"

export class PlayerResolver {
  constructor(
    private readonly playerRepository: IPlayerRepository,
    private readonly serverRepository: IServerRepository,
    private readonly logger: ILogger,
  ) {}

  /**
   * Resolve a player ID that may be invalid, using various fallback strategies
   */
  async resolvePlayerId(
    playerId: number,
    serverId: number,
    meta?: PlayerMeta,
    context: string = "unknown",
  ): Promise<number> {
    // If valid player ID, return as-is
    if (playerId > 0) {
      return playerId
    }

    this.logger.debug(`Attempting to resolve invalid playerId ${playerId} for ${context}:`, {
      playerName: meta?.playerName,
      steamId: meta?.steamId,
      isBot: meta?.isBot,
      serverId,
    })

    // Strategy 1: Resolve by player name (especially for bots)
    if (meta?.playerName) {
      const resolvedId = await this.resolveByPlayerName(meta.playerName, serverId)
      if (resolvedId > 0) {
        this.logger.info(
          `Resolved ${meta.playerName} to playerId ${resolvedId} for ${context} on server ${serverId}`,
        )
        return resolvedId
      }
    }

    // Strategy 2: Resolve by Steam ID if available
    if (meta?.steamId) {
      const resolvedId = await this.resolveBySteamId(meta.steamId, serverId)
      if (resolvedId > 0) {
        this.logger.info(
          `Resolved steamId ${meta.steamId} to playerId ${resolvedId} for ${context} on server ${serverId}`,
        )
        return resolvedId
      }
    }

    // All strategies failed
    this.logger.warn(
      `Failed to resolve player for ${context}: playerId=${playerId}, name=${meta?.playerName}, steamId=${meta?.steamId}`,
    )
    return 0
  }

  /**
   * Resolve player ID by player name (handles bot naming conventions)
   */
  private async resolveByPlayerName(playerName: string, serverId: number): Promise<number> {
    try {
      // Get server's game type
      const server = await this.serverRepository.findById(serverId)
      const game = server?.game || "csgo"

      // Strategy 1a: Try to find a bot with the BOT_ prefix
      const normalizedName = sanitizePlayerName(playerName)
      const botUniqueId = `BOT_${normalizedName}`

      const existingBot = await this.playerRepository.findByUniqueId(botUniqueId, game)
      if (existingBot) {
        return existingBot.playerId
      }

      // Strategy 1b: Try to find by exact player name (for edge cases)
      // Note: This would require a more complex query that searches across player names
      // For now, we'll skip this to avoid over-complicating the resolver

      return 0
    } catch (error) {
      this.logger.debug(`Failed to resolve by player name ${playerName}: ${error}`)
      return 0
    }
  }

  /**
   * Resolve player ID by Steam ID
   */
  private async resolveBySteamId(steamId: string, serverId: number): Promise<number> {
    try {
      // Get server's game type
      const server = await this.serverRepository.findById(serverId)
      const game = server?.game || "csgo"

      const existingPlayer = await this.playerRepository.findByUniqueId(steamId, game)
      if (existingPlayer) {
        return existingPlayer.playerId
      }

      return 0
    } catch (error) {
      this.logger.debug(`Failed to resolve by steam ID ${steamId}: ${error}`)
      return 0
    }
  }

  /**
   * Check if a player ID is valid (positive integer)
   */
  static isValidPlayerId(playerId: number): boolean {
    return Number.isInteger(playerId) && playerId > 0
  }

  /**
   * Check if player meta contains sufficient information for resolution
   */
  static hasResolutionData(meta?: PlayerMeta): boolean {
    return !!(meta?.playerName || meta?.steamId)
  }

  /**
   * Check if a player appears to be a bot based on meta information
   */
  static isBot(meta?: PlayerMeta): boolean {
    return !!(meta?.isBot || (meta?.steamId && meta.steamId.toUpperCase() === "BOT"))
  }

  /**
   * Get a descriptive string for debugging player resolution
   */
  static getPlayerDescription(playerId: number, meta?: PlayerMeta): string {
    const parts: string[] = [`ID: ${playerId}`]

    if (meta?.playerName) {
      parts.push(`Name: "${meta.playerName}"`)
    }

    if (meta?.steamId) {
      parts.push(`SteamID: "${meta.steamId}"`)
    }

    if (meta?.isBot) {
      parts.push("(Bot)")
    }

    return parts.join(", ")
  }
}
