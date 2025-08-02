/**
 * Event Coordinator
 *
 * Provides coordination patterns for cross-module event handling.
 * Coordinators handle concerns that span multiple modules and require
 * orchestration beyond what individual module handlers can provide.
 */

import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import { EventType } from "@/shared/types/events"

/**
 * Interface for event coordinators that handle cross-module concerns
 */
export interface EventCoordinator {
  /**
   * Coordinate event processing across multiple modules
   * @param event - The event to coordinate
   */
  coordinateEvent(event: BaseEvent): Promise<void>
}

/**
 * Kill Event Coordinator
 *
 * Handles cross-module coordination for kill events, ensuring that
 * all modules process the event and managing concerns like ranking
 * updates that depend on multiple module states.
 */
export class KillEventCoordinator implements EventCoordinator {
  constructor(
    private readonly logger: ILogger,
    private readonly rankingService: IRankingService,
  ) {}

  async coordinateEvent(event: BaseEvent): Promise<void> {
    if (event.eventType !== EventType.PLAYER_KILL) {
      return
    }

    this.logger.debug("Coordinating cross-module kill event processing")

    try {
      // Handle cross-module concerns that require coordination
      // For example: ranking updates that depend on multiple module states
      await this.rankingService.handleRatingUpdate()

      // Future enhancements:
      // - Add transaction coordination
      // - Implement saga patterns
      // - Handle compensating actions
      // - Manage event ordering requirements
    } catch (error) {
      this.logger.error(`Kill event coordination failed: ${error}`)
      throw error
    }
  }
}

/**
 * Composite Event Coordinator
 *
 * Allows multiple coordinators to handle the same event,
 * useful for complex events that require multiple coordination strategies.
 */
export class CompositeEventCoordinator implements EventCoordinator {
  constructor(
    private readonly coordinators: EventCoordinator[],
    private readonly logger: ILogger,
  ) {}

  async coordinateEvent(event: BaseEvent): Promise<void> {
    for (const coordinator of this.coordinators) {
      try {
        await coordinator.coordinateEvent(event)
      } catch (error) {
        this.logger.error(
          `Coordinator ${coordinator.constructor.name} failed for event ${event.eventType}: ${error}`,
        )
        // Decide based on requirements: continue with other coordinators or throw
        // For now, we'll continue to allow other coordinators to process
      }
    }
  }
}
