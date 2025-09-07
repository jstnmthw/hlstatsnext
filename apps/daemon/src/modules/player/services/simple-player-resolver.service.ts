/**
 * Simple Player Resolver Service
 *
 * A lightweight resolver that creates/gets players without complex dependencies.
 * Used to break circular dependency between PlayerService and SessionService.
 */

import type { IPlayerResolver } from "../player.types"
import type { IPlayerRepository } from "../player.types"
import type { ILogger } from "@/shared/utils/logger.types"
import { normalizeSteamId, sanitizePlayerName } from "@/shared/utils/validation"

export class SimplePlayerResolverService implements IPlayerResolver {
  constructor(
    private readonly playerRepository: IPlayerRepository,
    private readonly logger: ILogger,
  ) {}

  async getOrCreatePlayer(steamId: string, playerName: string, game: string): Promise<number> {
    // Simple implementation that creates/gets player without complex dependencies
    const normalized = normalizeSteamId(steamId)
    if (!normalized) {
      throw new Error(`Invalid Steam ID: ${steamId}`)
    }

    try {
      // Try to find existing player
      const existing = await this.playerRepository.findByUniqueId(normalized, game)
      if (existing) {
        return existing.playerId
      }

      // Create new player
      const created = await this.playerRepository.upsertPlayer({
        lastName: sanitizePlayerName(playerName),
        game,
        steamId: normalized,
      })

      this.logger.debug(
        `Created new player: ${playerName} (${normalized}) - ID: ${created.playerId}`,
      )
      return created.playerId
    } catch (error) {
      this.logger.error(`Failed to get/create player ${playerName} (${steamId}): ${error}`)
      throw error
    }
  }
}
