/**
 * Player Event Handler
 *
 * Legacy handler wrapper for backwards compatibility during migration.
 * This will be removed once the event processor refactor is complete.
 */

import type { IPlayerEventHandler, PlayerEvent } from "../player.types"
import type { IPlayerService } from "../player.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { HandlerResult } from "@/shared/types/common"

export class PlayerEventHandler implements IPlayerEventHandler {
  constructor(
    private readonly playerService: IPlayerService,
    private readonly logger: ILogger,
  ) {}

  async handleEvent(event: PlayerEvent): Promise<HandlerResult> {
    try {
      return await this.playerService.handlePlayerEvent(event)
    } catch (error) {
      this.logger.error(`Player event handler failed: ${error}`)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
