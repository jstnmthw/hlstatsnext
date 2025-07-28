/**
 * Event Publisher Implementation
 *
 * Implements event publishing to RabbitMQ with message formatting, routing,
 * priority-based publishing, and metrics integration.
 */

import type {
  IEventPublisher,
  IQueueClient,
  QueueChannel,
  EventMessage,
  MessageMetadata,
  RoutingKeyMapper,
  PriorityMapper,
} from "./queue.types"
import { MessagePriority, QueuePublishError } from "./queue.types"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import { generateMessageId, generateCorrelationId } from "./utils"

/**
 * Event publisher for RabbitMQ with comprehensive message handling
 */
export class EventPublisher implements IEventPublisher {
  private channel: QueueChannel | null = null
  private publishedCount = 0
  private failedCount = 0

  constructor(
    private readonly client: IQueueClient,
    private readonly logger: ILogger,
    private readonly routingKeyMapper: RoutingKeyMapper = defaultRoutingKeyMapper,
    private readonly priorityMapper: PriorityMapper = defaultPriorityMapper,
  ) {}

  async publish<T extends BaseEvent>(event: T): Promise<void> {
    const message = this.createMessage(event)
    const routingKey = this.routingKeyMapper(event)
    const priority = this.priorityMapper(event)

    try {
      await this.ensureChannel()

      const published = this.channel!.publish(
        "hlstats.events",
        routingKey,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          priority,
          messageId: message.id,
          timestamp: Date.now(),
          headers: {
            "x-correlation-id": message.correlationId,
            "x-event-type": event.eventType,
            "x-server-id": event.serverId,
            "x-routing-key": routingKey,
          },
        },
      )

      if (!published) {
        throw new QueuePublishError("Channel buffer full - message not published")
      }

      this.publishedCount++

      this.logger.debug(
        `Event published successfully: messageId=${message.id}, eventType=${event.eventType}, routingKey=${routingKey}, priority=${priority}, serverId=${event.serverId}`,
      )
    } catch (error) {
      this.failedCount++

      this.logger.error(
        `Failed to publish event ${event.eventType} to ${routingKey}: ${error instanceof Error ? error.message : String(error)}`,
      )

      throw error instanceof QueuePublishError
        ? error
        : new QueuePublishError(`Failed to publish ${event.eventType}`, error as Error)
    }
  }

  async publishBatch<T extends BaseEvent>(events: T[]): Promise<void> {
    if (events.length === 0) {
      return
    }

    const batchId = generateMessageId()
    this.logger.debug(`Publishing batch of ${events.length} events (batchId: ${batchId})`)

    // Process events in parallel but with controlled concurrency
    const batchSize = 50 // Process in chunks of 50
    for (let i = 0; i < events.length; i += batchSize) {
      const chunk = events.slice(i, i + batchSize)

      try {
        await Promise.all(chunk.map((event) => this.publish(event)))
      } catch (error) {
        this.logger.error(
          `Batch publish failed at chunk ${Math.floor(i / batchSize) + 1} (batchId: ${batchId}, chunkStart: ${i}, chunkSize: ${chunk.length}): ${error instanceof Error ? error.message : String(error)}`,
        )
        throw error
      }
    }

    this.logger.info(
      `Successfully published batch of ${events.length} events (batchId: ${batchId})`,
    )
  }

  /**
   * Get publisher statistics
   */
  getStats(): { published: number; failed: number } {
    return {
      published: this.publishedCount,
      failed: this.failedCount,
    }
  }

  private async ensureChannel(): Promise<void> {
    if (!this.channel) {
      this.channel = await this.client.createChannel("publisher")
    }
  }

  private createMessage<T extends BaseEvent>(event: T): EventMessage<T> {
    const correlationId = event.correlationId ?? generateCorrelationId()
    const routingKey = this.routingKeyMapper(event)
    const priority = this.priorityMapper(event)

    const metadata: MessageMetadata = {
      source: {
        serverId: event.serverId,
        serverAddress: event.serverAddress ?? "unknown",
        serverPort: event.serverPort ?? 0,
      },
      routing: {
        key: routingKey,
        priority,
        retryCount: 0,
      },
      hints: {
        requiresAck: true,
        skipValidation: false,
      },
    }

    return {
      id: generateMessageId(),
      version: "1.0",
      timestamp: new Date().toISOString(),
      correlationId,
      metadata,
      payload: event,
    }
  }
}

/**
 * Default routing key mapper based on event types
 */
export function defaultRoutingKeyMapper(event: BaseEvent): string {
  const routingMap: Record<EventType, string> = {
    // Player events
    [EventType.PLAYER_KILL]: "player.kill",
    [EventType.PLAYER_DEATH]: "player.death",
    [EventType.PLAYER_SUICIDE]: "player.suicide",
    [EventType.PLAYER_TEAMKILL]: "player.teamkill",
    [EventType.PLAYER_CONNECT]: "player.connect",
    [EventType.PLAYER_DISCONNECT]: "player.disconnect",
    [EventType.PLAYER_ENTRY]: "player.entry",
    [EventType.PLAYER_CHANGE_TEAM]: "player.change.team",
    [EventType.PLAYER_CHANGE_ROLE]: "player.change.role",
    [EventType.PLAYER_CHANGE_NAME]: "player.change.name",
    [EventType.PLAYER_DAMAGE]: "player.damage",

    // Action events
    [EventType.ACTION_PLAYER]: "action.player",
    [EventType.ACTION_PLAYER_PLAYER]: "action.player.player",
    [EventType.ACTION_TEAM]: "action.team",
    [EventType.ACTION_WORLD]: "action.world",

    // Match events
    [EventType.ROUND_START]: "round.start",
    [EventType.ROUND_END]: "round.end",
    [EventType.TEAM_WIN]: "team.win",
    [EventType.MAP_CHANGE]: "map.change",

    // Objective events
    [EventType.BOMB_PLANT]: "bomb.plant",
    [EventType.BOMB_DEFUSE]: "bomb.defuse",
    [EventType.BOMB_EXPLODE]: "bomb.explode",
    [EventType.HOSTAGE_RESCUE]: "hostage.rescue",
    [EventType.HOSTAGE_TOUCH]: "hostage.touch",
    [EventType.FLAG_CAPTURE]: "flag.capture",
    [EventType.FLAG_DEFEND]: "flag.defend",
    [EventType.FLAG_PICKUP]: "flag.pickup",
    [EventType.FLAG_DROP]: "flag.drop",
    [EventType.CONTROL_POINT_CAPTURE]: "control.capture",
    [EventType.CONTROL_POINT_DEFEND]: "control.defend",

    // Weapon events
    [EventType.WEAPON_FIRE]: "weapon.fire",
    [EventType.WEAPON_HIT]: "weapon.hit",

    // System events
    [EventType.SERVER_SHUTDOWN]: "server.shutdown",
    [EventType.SERVER_STATS_UPDATE]: "server.stats",
    [EventType.ADMIN_ACTION]: "admin.action",
    [EventType.CHAT_MESSAGE]: "chat.message",
  }

  return routingMap[event.eventType] ?? "unknown"
}

/**
 * Default priority mapper based on event types
 */
export function defaultPriorityMapper(event: BaseEvent): MessagePriority {
  // High priority events that need immediate processing
  const highPriorityEvents = new Set([
    EventType.PLAYER_KILL,
    EventType.PLAYER_SUICIDE,
    EventType.PLAYER_TEAMKILL,
    EventType.ROUND_START,
    EventType.ROUND_END,
    EventType.BOMB_PLANT,
    EventType.BOMB_DEFUSE,
    EventType.BOMB_EXPLODE,
    EventType.SERVER_SHUTDOWN,
  ])

  // Low priority events that can be processed later
  const lowPriorityEvents = new Set([
    EventType.WEAPON_FIRE,
    EventType.WEAPON_HIT,
    EventType.SERVER_STATS_UPDATE,
    EventType.CHAT_MESSAGE,
  ])

  if (highPriorityEvents.has(event.eventType)) {
    return MessagePriority.HIGH
  }

  if (lowPriorityEvents.has(event.eventType)) {
    return MessagePriority.LOW
  }

  return MessagePriority.NORMAL
}
