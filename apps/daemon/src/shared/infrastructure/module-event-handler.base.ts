/**
 * Base Module Event Handler
 * 
 * Abstract base class for module-specific event handlers that provides
 * common infrastructure for registering and managing event handlers.
 * This enables each module to handle its own events independently while
 * maintaining consistency across the application.
 */

import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { EventMetrics } from "@/shared/infrastructure/event-metrics"
import { EventType } from "@/shared/types/events"

export abstract class BaseModuleEventHandler {
  protected handlerIds: string[] = []

  constructor(
    protected readonly eventBus: IEventBus,
    protected readonly logger: ILogger,
    protected readonly metrics?: EventMetrics,
  ) {}

  /**
   * Register all event handlers for this module.
   * This method should be called by the concrete implementation's constructor.
   */
  abstract registerEventHandlers(): void

  /**
   * Register a handler for a specific event type with metrics collection
   * @param eventType - The type of event to handle
   * @param handler - The async function to handle the event
   */
  protected registerHandler<T extends BaseEvent>(
    eventType: EventType,
    handler: (event: T) => Promise<void>,
  ): void {
    const wrappedHandler = this.metrics 
      ? this.createMetricsWrapper(eventType, handler)
      : handler

    const handlerId = this.eventBus.on(eventType, wrappedHandler)
    this.handlerIds.push(handlerId)
    this.logger.debug(`Registered ${this.constructor.name} handler for ${eventType}`)
  }

  /**
   * Create a metrics-collecting wrapper for event handlers
   */
  private createMetricsWrapper<T extends BaseEvent>(
    eventType: EventType,
    handler: (event: T) => Promise<void>,
  ): (event: T) => Promise<void> {
    const moduleName = this.constructor.name

    return async (event: T) => {
      const startTime = Date.now()
      
      try {
        await handler(event)
        
        const duration = Date.now() - startTime
        this.metrics!.recordProcessingTime(eventType, duration, moduleName)
      } catch (error) {
        const duration = Date.now() - startTime
        this.metrics!.recordProcessingTime(eventType, duration, moduleName)
        this.metrics!.recordError(eventType, error instanceof Error ? error : new Error(String(error)), moduleName)
        throw error
      }
    }
  }

  /**
   * Unregister all event handlers for this module
   */
  destroy(): void {
    for (const handlerId of this.handlerIds) {
      this.eventBus.off(handlerId)
    }
    this.handlerIds.length = 0
    this.logger.debug(`${this.constructor.name} unregistered all event handlers`)
  }
}