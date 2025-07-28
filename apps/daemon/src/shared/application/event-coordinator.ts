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
import type { ISaga } from "@/shared/application/sagas/saga.types"
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

    this.logger.debug('Coordinating cross-module kill event processing')
    
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
 * Saga Event Coordinator
 * 
 * Handles event coordination through saga patterns, providing transactional
 * consistency and compensating actions for complex multi-module workflows.
 */
export class SagaEventCoordinator implements EventCoordinator {
  private readonly sagas: Map<EventType, ISaga> = new Map()

  constructor(
    private readonly logger: ILogger,
  ) {}

  /**
   * Register a saga for a specific event type
   */
  registerSaga(eventType: EventType, saga: ISaga): void {
    this.sagas.set(eventType, saga)
    this.logger.debug(`Registered saga ${saga.name} for event type ${eventType}`)
  }

  async coordinateEvent(event: BaseEvent): Promise<void> {
    const saga = this.sagas.get(event.eventType)
    if (!saga) {
      this.logger.debug(`No saga registered for event type: ${event.eventType}`)
      return
    }

    try {
      this.logger.debug(`Executing saga ${saga.name} for event ${event.eventType}`)
      await saga.execute(event)
    } catch (error) {
      this.logger.error(`Saga execution failed for ${event.eventType}`, {
        sagaName: saga.name,
        eventType: event.eventType,
        error: error instanceof Error ? error.message : String(error),
      })
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
          `Coordinator ${coordinator.constructor.name} failed for event ${event.eventType}: ${error}`
        )
        // Decide based on requirements: continue with other coordinators or throw
        // For now, we'll continue to allow other coordinators to process
      }
    }
  }
}