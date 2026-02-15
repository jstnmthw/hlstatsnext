/**
 * RabbitMQ Event Processor
 *
 * Processes events consumed from RabbitMQ queues by routing them through
 * module handlers and optional coordinators. Uses "QUEUE" prefix
 * logging to distinguish from EventBus processing.
 */

import type { EventCoordinator } from "@/shared/application/event-coordinator"
import type { IEventProcessor } from "@/shared/infrastructure/messaging/queue/core/consumer"
import {
  generateCorrelationId,
  generateMessageId,
} from "@/shared/infrastructure/messaging/queue/utils/message-utils"
import type { BaseModuleEventHandler } from "@/shared/infrastructure/modules/event-handler.base"
import type { ModuleRegistry } from "@/shared/infrastructure/modules/registry"
import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { PrometheusMetricsExporter } from "@repo/observability"

/**
 * RabbitMQ Event Processor implementation that routes events through
 * the existing application infrastructure
 *
 * This class is responsible for processing events consumed from RabbitMQ queues.
 * It routes events through module handlers and optional coordinators.
 *
 * @param logger - The logger to use for logging
 * @param moduleRegistry - The module registry to use for routing events
 * @param coordinators - The coordinators to use for processing events
 * @returns void
 */
export class RabbitMQEventProcessor implements IEventProcessor {
  constructor(
    private readonly logger: ILogger,
    private readonly moduleRegistry: ModuleRegistry,
    private readonly coordinators: EventCoordinator[] = [],
    private readonly metrics?: PrometheusMetricsExporter,
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
      `Processing event: ${processedEvent.eventType} (Server ID: ${processedEvent.serverId})`,
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

      // Then process through coordinators (optional extension point)
      await this.processCoordinators(processedEvent)

      const processingTime = Date.now() - startTime

      // Record event metrics for Prometheus
      this.metrics?.incrementCounter("events_processed_total", {
        event_type: processedEvent.eventType,
        status: "success",
      })
      this.metrics?.recordHistogram(
        "event_processing_duration_seconds",
        { event_type: processedEvent.eventType },
        processingTime / 1000,
      )

      this.logger.info(
        `Event processed: ${processedEvent.eventType} (Server ID: ${processedEvent.serverId}, Event ID: ${processedEvent.eventId?.slice(-6)})`,
        {
          eventId: processedEvent.eventId,
          correlationId: processedEvent.correlationId,
          serverId: processedEvent.serverId,
          processingTimeMs: processingTime,
          status: "success",
        },
      )
    } catch (error) {
      const processingTime = Date.now() - startTime

      // Record failed event metrics for Prometheus
      this.metrics?.incrementCounter("events_processed_total", {
        event_type: processedEvent.eventType,
        status: "failed",
      })
      this.metrics?.recordHistogram(
        "event_processing_duration_seconds",
        { event_type: processedEvent.eventType },
        processingTime / 1000,
      )

      this.logger.error(
        `Event processing failed: ${processedEvent.eventType} (Server ID: ${processedEvent.serverId})`,
        {
          eventId: processedEvent.eventId,
          correlationId: processedEvent.correlationId,
          serverId: processedEvent.serverId,
          processingTimeMs: processingTime,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        },
      )
      throw error
    }
  }

  /**
   * Process event through registered module handlers (business logic)
   *
   * This method processes events through registered module handlers.
   * Module handlers are responsible for handling events and performing
   * business logic.
   *
   * @param event - The event to process
   */
  private async processModuleHandlers(event: BaseEvent): Promise<void> {
    const handlers = this.moduleRegistry.getHandlersForEvent(event.eventType)

    if (handlers.length === 0) {
      this.logger.warn(`No module handlers found for event type ${event.eventType}`)
      return
    }

    this.logger.info(
      `Processing event: ${event.eventType} through [${handlers.map((h) => h.name).join(", ")}] module handlers`,
      {
        eventId: event.eventId,
        handlers: handlers.map((h) => h.name),
      },
    )

    // Process through all matching module handlers in parallel
    const processingPromises = handlers.map(async (moduleHandler) => {
      const startTime = Date.now()

      try {
        // Get the handler instance (e.g., PlayerEventHandler)
        const handler = moduleHandler.handler as BaseModuleEventHandler & Record<string, unknown>

        // Try to call handler methods in order of preference:
        // 1. Generic handleEvent method (cleanest approach)
        // 2. Specific handler method based on event type (legacy support)

        let methodCalled = false

        if (handler.handleEvent && typeof handler.handleEvent === "function") {
          await handler.handleEvent(event)
          methodCalled = true
        } else {
          // Fallback to specific handler method for backward compatibility
          const eventTypeParts = event.eventType.split("_")
          const handlerMethodName = `handle${eventTypeParts
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join("")}`

          if (handler[handlerMethodName] && typeof handler[handlerMethodName] === "function") {
            await handler[handlerMethodName](event)
            methodCalled = true
          }
        }

        if (methodCalled) {
          const processingTime = Date.now() - startTime
          this.logger.debug(
            `Module ${moduleHandler.name} processed event ${event.eventType} successfully in ${processingTime}ms`,
          )
        } else {
          this.logger.warn(
            `No handler method found in ${moduleHandler.name} for event ${event.eventType}`,
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
   * Process event through registered coordinators (optional)
   *
   * This method processes events through registered coordinators.
   * Coordinators are optional and can be used to coordinate events
   * across multiple modules.
   *
   * @param event - The event to process
   * @returns void
   */
  private async processCoordinators(event: BaseEvent): Promise<void> {
    if (this.coordinators.length === 0) {
      return
    }

    this.logger.debug(
      `Processing event: ${event.eventType} through [${this.coordinators.map((c) => c.constructor.name).join(", ")}] coordinators`,
      {
        eventId: event.eventId,
        coordinators: this.coordinators.map((c) => c.constructor.name),
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
