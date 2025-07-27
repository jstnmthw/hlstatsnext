/**
 * Event Publisher Adapter
 *
 * Provides a unified interface for both EventBus and EventPublisher
 * to enable gradual migration from EventBus to RabbitMQ.
 */

import type { BaseEvent } from '@/shared/types/events'
import type { IEventBus } from './event-bus/event-bus.types'
import type { IEventPublisher } from './queue/queue.types'

/**
 * Unified interface for event publishing
 */
export interface IEventEmitter {
  emit(event: BaseEvent): Promise<void>
}

/**
 * Adapter that makes IEventBus compatible with IEventEmitter
 */
export class EventBusAdapter implements IEventEmitter {
  constructor(private readonly eventBus: IEventBus) {}

  async emit(event: BaseEvent): Promise<void> {
    await this.eventBus.emit(event)
  }
}

/**
 * Adapter that makes IEventPublisher compatible with IEventEmitter
 */
export class EventPublisherAdapter implements IEventEmitter {
  constructor(private readonly eventPublisher: IEventPublisher) {}

  async emit(event: BaseEvent): Promise<void> {
    await this.eventPublisher.publish(event)
  }
}

/**
 * Factory function to create an appropriate adapter
 */
export function createEventEmitterAdapter(
  eventBusOrPublisher: IEventBus | IEventPublisher,
): IEventEmitter {
  // Check if it has an 'emit' method (EventBus)
  if ('emit' in eventBusOrPublisher) {
    return new EventBusAdapter(eventBusOrPublisher as IEventBus)
  }
  
  // Otherwise it's an EventPublisher
  return new EventPublisherAdapter(eventBusOrPublisher as IEventPublisher)
}