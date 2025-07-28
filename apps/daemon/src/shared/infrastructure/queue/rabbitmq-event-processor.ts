/**
 * RabbitMQ Event Processor
 *
 * Processes events consumed from RabbitMQ queues by routing them through
 * the existing saga coordinators and module handlers. Uses "QUEUE" prefix
 * logging to distinguish from EventBus processing.
 */

import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IEventProcessor } from "./event-consumer"
import type { EventCoordinator } from "@/shared/application/event-coordinator"
import { generateMessageId, generateCorrelationId } from "./utils"

/**
 * RabbitMQ Event Processor implementation that routes events through
 * the existing application infrastructure
 */
export class RabbitMQEventProcessor implements IEventProcessor {
  constructor(
    private readonly logger: ILogger,
    private readonly coordinators: EventCoordinator[] = [],
  ) {}

  async processEvent(event: BaseEvent): Promise<void> {
    const startTime = Date.now()
    
    // Ensure eventId and correlationId are present
    const processedEvent: BaseEvent = {
      ...event,
      eventId: event.eventId || generateMessageId(),
      correlationId: event.correlationId || generateCorrelationId(),
    }
    
    this.logger.queue(
      `Processing event ${processedEvent.eventType} for server ${processedEvent.serverId}`,
      {
        eventId: processedEvent.eventId,
        correlationId: processedEvent.correlationId,
        eventType: processedEvent.eventType,
        serverId: processedEvent.serverId,
      },
    )

    try {
      // Process through coordinators (including sagas) ONLY
      // Do NOT process through EventBus as that would cause duplication
      // The EventBus is already processing events from the ingress
      await this.processCoordinators(processedEvent)

      const processingTime = Date.now() - startTime
      this.logger.queue(
        `Event ${processedEvent.eventType} processed successfully in ${processingTime}ms`,
        {
          eventId: processedEvent.eventId,
          correlationId: processedEvent.correlationId,
          processingTimeMs: processingTime,
        },
      )
    } catch (error) {
      const processingTime = Date.now() - startTime
      this.logger.error(
        `Failed to process event ${processedEvent.eventType} in ${processingTime}ms: ${error instanceof Error ? error.message : String(error)}`,
        {
          eventId: processedEvent.eventId,
          correlationId: processedEvent.correlationId,
          eventType: processedEvent.eventType,
          serverId: processedEvent.serverId,
          error: error instanceof Error ? error.message : String(error),
          processingTimeMs: processingTime,
        },
      )
      throw error
    }
  }


  /**
   * Process event through registered coordinators (including sagas)
   */
  private async processCoordinators(event: BaseEvent): Promise<void> {
    if (this.coordinators.length === 0) {
      return
    }

    this.logger.debug(
      `Processing event ${event.eventType} through ${this.coordinators.length} coordinators`,
      {
        eventId: event.eventId,
        coordinators: this.coordinators.map(c => c.constructor.name),
      },
    )

    for (const coordinator of this.coordinators) {
      try {
        await coordinator.coordinateEvent(event)
        
        this.logger.debug(
          `Coordinator ${coordinator.constructor.name} processed event ${event.eventType} successfully`,
        )
      } catch (error) {
        this.logger.error(
          `Coordinator ${coordinator.constructor.name} failed for event ${event.eventType}: ${error instanceof Error ? error.message : String(error)}`,
          {
            eventId: event.eventId,
            coordinatorName: coordinator.constructor.name,
            error: error instanceof Error ? error.message : String(error),
          },
        )
        throw error
      }
    }
  }
}