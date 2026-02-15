/**
 * Base Player Event Handler
 *
 * Provides common functionality for all player event handlers
 */

import type { IMapService } from "@/modules/map/map.service"
import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerRepository, PlayerEvent } from "@/modules/player/types/player.types"
import type { HandlerResult } from "@/shared/types/common"
import type { ILogger } from "@/shared/utils/logger.types"

export abstract class BasePlayerEventHandler {
  constructor(
    protected readonly repository: IPlayerRepository,
    protected readonly logger: ILogger,
    protected readonly matchService?: IMatchService,
    protected readonly mapService?: IMapService,
  ) {}

  /**
   * Handle the specific player event
   */
  abstract handle(event: PlayerEvent): Promise<HandlerResult>

  /**
   * Get current map from centralized map service
   */
  protected async getCurrentMap(serverId: number): Promise<string> {
    // Use centralized map service if available
    if (this.mapService) {
      return await this.mapService.getCurrentMap(serverId)
    }
    // Legacy fallback - should not be needed once MapService is wired up
    return "unknown"
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
