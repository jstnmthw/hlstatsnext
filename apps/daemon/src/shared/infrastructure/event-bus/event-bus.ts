/**
 * Event Bus Implementation
 *
 * Implements a decoupled event handling system following SOLID principles.
 */

import type {
  IEventBus,
  EventHandler,
  EventHandlerRegistration,
  EventBusStats,
  HandlerResult,
} from "./event-bus.types"
import type { BaseEvent, EventType } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"

export class EventBus implements IEventBus {
  private readonly handlers: Map<EventType, Set<EventHandlerRegistration>> = new Map()
  private readonly handlerMap: Map<string, EventHandlerRegistration> = new Map()
  private stats = {
    eventsEmitted: 0,
    errors: 0,
  }

  constructor(private readonly logger: ILogger) {}

  async emit(event: BaseEvent): Promise<void> {
    this.stats.eventsEmitted++
    const handlers = this.handlers.get(event.eventType)

    if (!handlers || handlers.size === 0) {
      this.logger.debug(`No handlers registered for event type: ${event.eventType}`)
      return
    }

    // Sort handlers by priority (higher priority first)
    const sortedHandlers = Array.from(handlers).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    )

    const results: HandlerResult[] = []

    // Execute handlers sequentially to maintain order
    for (const registration of sortedHandlers) {
      const startTime = Date.now()
      try {
        await registration.handler(event)
        results.push({
          handlerId: registration.id,
          success: true,
          duration: Date.now() - startTime,
        })
      } catch (error) {
        this.stats.errors++
        const errorObj = error instanceof Error ? error : new Error(String(error))
        
        this.logger.error(
          `Handler ${registration.id} failed for event ${event.eventType}: ${errorObj.message}`,
        )
        
        results.push({
          handlerId: registration.id,
          success: false,
          error: errorObj,
          duration: Date.now() - startTime,
        })
      }
    }

    // Log emission summary
    const failures = results.filter((r) => !r.success).length
    if (failures > 0) {
      this.logger.warn(
        `Event ${event.eventType} had ${failures} handler failures out of ${results.length}`,
      )
    }
  }

  on<T extends BaseEvent>(eventType: EventType, handler: EventHandler<T>): string {
    const handlerId = `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const registration: EventHandlerRegistration = {
      id: handlerId,
      eventType,
      handler: handler as EventHandler,
      priority: 0,
    }

    // Initialize set if needed
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }

    // Add to both maps
    this.handlers.get(eventType)!.add(registration)
    this.handlerMap.set(handlerId, registration)

    this.logger.debug(`Registered handler ${handlerId} for event type ${eventType}`)

    return handlerId
  }

  off(handlerId: string): void {
    const registration = this.handlerMap.get(handlerId)
    if (!registration) {
      this.logger.warn(`Attempted to unregister unknown handler: ${handlerId}`)
      return
    }

    // Remove from event type set
    const handlers = this.handlers.get(registration.eventType)
    if (handlers) {
      handlers.delete(registration)
      if (handlers.size === 0) {
        this.handlers.delete(registration.eventType)
      }
    }

    // Remove from handler map
    this.handlerMap.delete(handlerId)

    this.logger.debug(`Unregistered handler ${handlerId} for event type ${registration.eventType}`)
  }

  clearHandlers(eventType?: EventType): void {
    if (eventType) {
      // Clear specific event type
      const handlers = this.handlers.get(eventType)
      if (handlers) {
        for (const registration of handlers) {
          this.handlerMap.delete(registration.id)
        }
        this.handlers.delete(eventType)
        this.logger.info(`Cleared all handlers for event type ${eventType}`)
      }
    } else {
      // Clear all handlers
      this.handlers.clear()
      this.handlerMap.clear()
      this.logger.info("Cleared all event handlers")
    }
  }

  getStats(): EventBusStats {
    const handlersByType = new Map<EventType, number>()
    
    for (const [eventType, handlers] of this.handlers) {
      handlersByType.set(eventType, handlers.size)
    }

    return {
      totalHandlers: this.handlerMap.size,
      handlersByType,
      eventsEmitted: this.stats.eventsEmitted,
      errors: this.stats.errors,
    }
  }
}