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
import type { ModuleRegistry } from "@/shared/infrastructure/module-registry"
import { generateMessageId, generateCorrelationId } from "./utils"

/**
 * RabbitMQ Event Processor implementation that routes events through
 * the existing application infrastructure
 */
export class RabbitMQEventProcessor implements IEventProcessor {
  constructor(
    private readonly logger: ILogger,
    private readonly moduleRegistry: ModuleRegistry,
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
      // Process through module handlers first (for business logic like chat persistence)
      await this.processModuleHandlers(processedEvent)
      
      // Then process through coordinators (including sagas)
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
   * Process event through registered module handlers (business logic)
   */
  private async processModuleHandlers(event: BaseEvent): Promise<void> {
    const handlers = this.moduleRegistry.getHandlersForEvent(event.eventType)
    
    if (handlers.length === 0) {
      this.logger.debug(`No module handlers found for event type ${event.eventType}`)
      return
    }

    this.logger.debug(
      `Processing event ${event.eventType} through ${handlers.length} module handlers`,
      {
        eventId: event.eventId,
        handlers: handlers.map(h => h.name),
      },
    )

    // Process through all matching module handlers in parallel
    const processingPromises = handlers.map(async (moduleHandler) => {
      const startTime = Date.now()
      
      try {
        // Get the handler instance (e.g., PlayerEventHandler)
        const handler = moduleHandler.handler as any
        
        // Call the appropriate handler method based on event type
        const eventTypeParts = event.eventType.split('_')
        const handlerMethodName = `handle${eventTypeParts.map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join('')}`
        
        if (handler[handlerMethodName] && typeof handler[handlerMethodName] === 'function') {
          await handler[handlerMethodName](event)
          
          const processingTime = Date.now() - startTime
          this.logger.debug(
            `Module ${moduleHandler.name} processed event ${event.eventType} successfully in ${processingTime}ms`,
          )
        } else {
          this.logger.debug(
            `No handler method ${handlerMethodName} found in ${moduleHandler.name} for event ${event.eventType}`,
          )
        }
      } catch (error) {
        const processingTime = Date.now() - startTime
        this.logger.error(
          `Module ${moduleHandler.name} failed to process event ${event.eventType} in ${processingTime}ms: ${error instanceof Error ? error.message : String(error)}`,
          {
            eventId: event.eventId,
            moduleName: moduleHandler.name,
            error: error instanceof Error ? error.message : String(error),
            processingTimeMs: processingTime,
          },
        )
        throw error
      }
    })

    await Promise.all(processingPromises)
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