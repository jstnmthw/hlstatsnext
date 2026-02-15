/**
 * Simple Player Resolver Service
 *
 * A lightweight resolver that creates/gets players without complex dependencies.
 * Used to break circular dependency between PlayerService and SessionService.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import { normalizeSteamId, sanitizePlayerName } from "@/shared/utils/validation"
import type { IPlayerRepository, IPlayerResolver } from "../types/player.types"

export class SimplePlayerResolverService implements IPlayerResolver {
  constructor(
    private readonly playerRepository: IPlayerRepository,
    private readonly logger: ILogger,
  ) {}

  async getOrCreatePlayer(
    steamId: string,
    playerName: string,
    game: string,
    serverId?: number,
  ): Promise<number> {
    // Simple implementation that creates/gets player without complex dependencies
    const normalized = normalizeSteamId(steamId)
    if (!normalized) {
      throw new Error(`Invalid Steam ID: ${steamId}`)
    }

    const isBot = normalized.toUpperCase() === "BOT"
    const normalizedName = sanitizePlayerName(playerName)
    const effectiveId = isBot ? `BOT_${serverId || 0}_${normalizedName}` : normalized

    try {
      // Try to find existing player
      const existing = await this.playerRepository.findByUniqueId(effectiveId, game)
      if (existing) {
        return existing.playerId
      }

      // Create new player
      const created = await this.playerRepository.upsertPlayer({
        lastName: normalizedName,
        game,
        steamId: effectiveId,
      })

      this.logger.debug(
        `Created new player: ${playerName} (${effectiveId}) - ID: ${created.playerId}`,
      )
      return created.playerId
    } catch (error) {
      this.logger.error(`Failed to get/create player ${playerName} (${steamId}): ${error}`)
      throw error
    }
  }
}
