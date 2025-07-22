/**
 * Round Handler
 *
 * Handles round-specific events (start, end, team wins, map changes).
 */

import type {
  IRoundHandler,
  RoundStartEvent,
  RoundEndEvent,
  TeamWinEvent,
  MapChangeEvent,
} from "../match.types"
import type { IMatchService } from "../match.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { HandlerResult } from "@/shared/types/common"

export class RoundHandler implements IRoundHandler {
  constructor(
    private readonly matchService: IMatchService,
    private readonly logger: ILogger,
  ) {}

  async handleRoundStart(event: RoundStartEvent): Promise<HandlerResult> {
    try {
      return await this.matchService.handleMatchEvent(event)
    } catch (error) {
      this.logger.error(`Round start handler failed: ${error}`)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async handleRoundEnd(event: RoundEndEvent): Promise<HandlerResult> {
    try {
      return await this.matchService.handleMatchEvent(event)
    } catch (error) {
      this.logger.error(`Round end handler failed: ${error}`)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async handleTeamWin(event: TeamWinEvent): Promise<HandlerResult> {
    try {
      return await this.matchService.handleMatchEvent(event)
    } catch (error) {
      this.logger.error(`Team win handler failed: ${error}`)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async handleMapChange(event: MapChangeEvent): Promise<HandlerResult> {
    try {
      return await this.matchService.handleMatchEvent(event)
    } catch (error) {
      this.logger.error(`Map change handler failed: ${error}`)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
