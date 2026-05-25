/**
 * Event Assembly Helper
 *
 * Pure builder for the common BaseEvent envelope shared by every parser
 * handler: timestamp, eventId, correlationId, raw line, serverId.
 *
 * Kept side-effect free so handler functions can be exercised in isolation.
 */

import {
  generateCorrelationId,
  generateMessageId,
} from "@/shared/infrastructure/messaging/queue/utils/message-utils"
import type { IClock } from "@/shared/infrastructure/time/clock.interface"
import type { BaseEvent, EventType } from "@/shared/types/events"

export interface AssembleEventInput<T extends EventType> {
  eventType: T
  serverId: number
  raw: string
  data: BaseEvent["data"]
  meta?: BaseEvent["meta"]
}

export class EventAssemblyHelper {
  constructor(private readonly clock: IClock) {}

  assemble<T extends EventType>(input: AssembleEventInput<T>): BaseEvent {
    const event: BaseEvent = {
      eventType: input.eventType,
      timestamp: this.clock.now(),
      serverId: input.serverId,
      raw: input.raw,
      eventId: generateMessageId(),
      correlationId: generateCorrelationId(),
      data: input.data,
    }

    if (input.meta !== undefined) {
      event.meta = input.meta
    }

    return event
  }
}
