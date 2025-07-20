/**
 * Objective Handler
 *
 * Handles objective-based events (bomb, hostage, flag, control point events).
 */

import type { IObjectiveHandler, ObjectiveEvent } from "../match.types"
import type { IMatchService } from "../match.types"
import type { ILogger } from "@/shared/utils/logger"
import type { HandlerResult } from "@/shared/types/common"

export class ObjectiveHandler implements IObjectiveHandler {
  constructor(
    private readonly matchService: IMatchService,
    private readonly logger: ILogger,
  ) {}

  async handleObjectiveEvent(event: ObjectiveEvent): Promise<HandlerResult> {
    try {
      return await this.matchService.handleObjectiveEvent(event)
    } catch (error) {
      this.logger.error(`Objective event handler failed: ${error}`)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  getObjectivePoints(eventType: string): number {
    const objectivePointsMap: Record<string, number> = {
      BOMB_PLANT: 3,
      BOMB_DEFUSE: 3,
      BOMB_EXPLODE: 0, // No player points for explosion
      HOSTAGE_RESCUE: 2,
      HOSTAGE_TOUCH: 1,
      FLAG_CAPTURE: 5,
      FLAG_DEFEND: 3,
      FLAG_PICKUP: 1,
      FLAG_DROP: 0,
      CONTROL_POINT_CAPTURE: 4,
      CONTROL_POINT_DEFEND: 2,
    }
    return eventType in objectivePointsMap ? objectivePointsMap[eventType]! : 1
  }
}
