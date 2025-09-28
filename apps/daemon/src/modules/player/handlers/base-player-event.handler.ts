/**
 * Base Player Event Handler
 *
 * Provides common functionality for all player event handlers
 */

import type { HandlerResult } from "@/shared/types/common"
import type { PlayerEvent } from "@/modules/player/types/player.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository } from "@/modules/player/types/player.types"
import type { IMatchService } from "@/modules/match/match.types"

export abstract class BasePlayerEventHandler {
  constructor(
    protected readonly repository: IPlayerRepository,
    protected readonly logger: ILogger,
    protected readonly matchService?: IMatchService,
  ) {}

  /**
   * Handle the specific player event
   */
  abstract handle(event: PlayerEvent): Promise<HandlerResult>

  /**
   * Get current map from match service with fallback and initialization
   */
  protected async getCurrentMap(serverId: number): Promise<string> {
    let map = this.matchService?.getCurrentMap(serverId) || ""
    if (map === "unknown" && this.matchService) {
      map = await this.matchService.initializeMapForServer(serverId)
    }
    return map
  }

  /**
   * Create standardized error result
   */
  protected createErrorResult(error: string): HandlerResult {
    return {
      success: false,
      error,
    }
  }

  /**
   * Create standardized success result
   */
  protected createSuccessResult(affected: number = 1): HandlerResult {
    return {
      success: true,
      affected,
    }
  }

  /**
   * Safely handle async operations with error logging
   */
  protected async safeHandle(
    event: PlayerEvent,
    operation: () => Promise<HandlerResult>,
  ): Promise<HandlerResult> {
    try {
      return await operation()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to handle ${event.eventType} event: ${errorMessage}`)
      return this.createErrorResult(errorMessage)
    }
  }
}
