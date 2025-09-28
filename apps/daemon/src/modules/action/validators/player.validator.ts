/**
 * Player Validator
 *
 * Validates player existence and handles resolution for action handlers.
 * This validator encapsulates player validation patterns including:
 * 1. Single player validation with metadata resolution
 * 2. Batch player validation for performance
 * 3. Player pair validation for player-vs-player actions
 *
 * Uses efficient batch operations to prevent N+1 queries and provides
 * graceful degradation when players are not found.
 *
 * @example Single Player Validation
 * ```typescript
 * const validator = new PlayerValidator(playerService, logger)
 *
 * const result = await validator.validateSinglePlayer(
 *   playerId,
 *   'Kill',
 *   { steamId: 'STEAM_123', playerName: 'Player1' },
 *   'cstrike'
 * )
 *
 * if (result.shouldEarlyReturn) {
 *   return result.earlyResult!
 * }
 *
 * // Use resolved playerId (may be different if resolved from meta)
 * const resolvedPlayerId = result.playerId
 * ```
 *
 * @example Batch Player Validation
 * ```typescript
 * const result = await validator.validateMultiplePlayers([1, 2, 3], 'TeamAction')
 *
 * // Only process valid players (invalid ones logged as warnings)
 * if (result.hasValidPlayers) {
 *   processPlayers(result.validPlayerIds)
 * }
 * ```
 *
 * @example Player Pair Validation (Optimized)
 * ```typescript
 * const result = await validator.validatePlayerPair(killerId, victimId, 'Kill')
 *
 * if (result.shouldEarlyReturn) {
 *   return result.earlyResult! // One or both players not found
 * }
 *
 * // Both players exist, proceed with action
 * ```
 */

import type { IPlayerService } from "@/modules/player/types/player.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { HandlerResult } from "@/shared/types/common"

export interface PlayerValidationResult {
  playerId: number
  shouldEarlyReturn: boolean
  earlyResult?: HandlerResult
}

export class PlayerValidator {
  constructor(
    private readonly playerService: IPlayerService | undefined,
    private readonly logger: ILogger,
  ) {}

  async validateSinglePlayer(
    playerId: number,
    actionCode: string,
    meta?: { steamId?: string; playerName?: string },
    game?: string,
  ): Promise<PlayerValidationResult> {
    if (!this.playerService) {
      return { playerId, shouldEarlyReturn: false }
    }

    const existing = await this.playerService.getPlayerStats(playerId)
    if (existing) {
      return { playerId, shouldEarlyReturn: false }
    }

    // Player not found, try to resolve via meta if available
    if (meta?.steamId && meta.playerName && game) {
      try {
        const resolvedId = await this.playerService.getOrCreatePlayer(
          meta.steamId,
          meta.playerName,
          game,
        )
        return { playerId: resolvedId, shouldEarlyReturn: false }
      } catch {
        this.logger.warn(
          `Player ${playerId} not found and could not be resolved, skipping action: ${actionCode}`,
        )
        return {
          playerId,
          shouldEarlyReturn: true,
          earlyResult: { success: true },
        }
      }
    }

    this.logger.warn(`Player ${playerId} not found, skipping action: ${actionCode}`)
    return {
      playerId,
      shouldEarlyReturn: true,
      earlyResult: { success: true },
    }
  }

  async validateMultiplePlayers(
    playerIds: number[],
    actionCode: string,
  ): Promise<{ validPlayerIds: number[]; hasValidPlayers: boolean }> {
    if (!this.playerService || playerIds.length === 0) {
      return { validPlayerIds: playerIds, hasValidPlayers: playerIds.length > 0 }
    }

    const playerStats = await this.playerService.getPlayerStatsBatch(playerIds)
    const validPlayerIds: number[] = []

    for (const playerId of playerIds) {
      if (playerStats.has(playerId)) {
        validPlayerIds.push(playerId)
      } else {
        this.logger.warn(`Player ${playerId} not found, skipping in action: ${actionCode}`)
      }
    }

    return { validPlayerIds, hasValidPlayers: validPlayerIds.length > 0 }
  }

  async validatePlayerPair(
    playerId: number,
    victimId: number,
    actionCode: string,
  ): Promise<{ shouldEarlyReturn: boolean; earlyResult?: HandlerResult }> {
    if (!this.playerService) {
      return { shouldEarlyReturn: false }
    }

    // Use batch lookup instead of individual queries
    const playerStats = await this.playerService.getPlayerStatsBatch([playerId, victimId])

    if (!playerStats.has(playerId)) {
      this.logger.warn(`Player ${playerId} not found, skipping action: ${actionCode}`)
      return { shouldEarlyReturn: true, earlyResult: { success: true } }
    }

    if (!playerStats.has(victimId)) {
      this.logger.warn(`Victim ${victimId} not found, skipping action: ${actionCode}`)
      return { shouldEarlyReturn: true, earlyResult: { success: true } }
    }

    return { shouldEarlyReturn: false }
  }
}
