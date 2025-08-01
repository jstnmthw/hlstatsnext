/**
 * Event Bus Types
 *
 * Type definitions for the event bus system.
 */

import type { BaseEvent, EventType } from "@/shared/types/events"

/**
 * Handler function for processing events
 */
export type EventHandler<T extends BaseEvent = BaseEvent> = (event: T) => Promise<void>

/**
 * Event handler registration with metadata
 */
export interface EventHandlerRegistration {
  readonly id: string
  readonly eventType: EventType
  readonly handler: EventHandler
  readonly priority?: number
}

/**
 * Event bus interface for decoupled event handling
 */
export interface IEventBus {
  /**
   * Emit an event to all registered handlers
   */
  emit(event: BaseEvent): Promise<void>

  /**
   * Register a handler for a specific event type
   * @returns Handler ID for unregistration
   */
  on<T extends BaseEvent>(eventType: EventType, handler: EventHandler<T>): string

  /**
   * Unregister a handler by ID
   */
  off(handlerId: string): void

  /**
   * Clear all handlers for a specific event type
   */
  clearHandlers(eventType?: EventType): void

  /**
   * Get statistics about registered handlers
   */
  getStats(): EventBusStats
}

/**
 * Event bus statistics
 */
export interface EventBusStats {
  readonly totalHandlers: number
  readonly handlersByType: ReadonlyMap<EventType, number>
  readonly eventsEmitted: number
  readonly errors: number
}

/**
 * Event emission result
 */

/**
 * Individual handler execution result
 */
export interface HandlerResult {
  readonly handlerId: string
  readonly success: boolean
  readonly error?: Error
  readonly duration: number
}
