/**
 * Queue-First Event Publisher
 *
 * Primary publisher that sends events to RabbitMQ queues.
 * Maintains temporary EventBus fallback only for events not yet migrated.
 * Goal: Complete EventBus removal once all events are queue-compatible.
 */

import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { IEventEmitter } from "@/shared/infrastructure/event-publisher-adapter"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IEventPublisher } from "./queue.types"

/**
 * Events that are fully migrated to queue-only processing
 * These no longer use EventBus at all
 */
const QUEUE_ONLY_EVENTS = new Set<EventType>([
  // Phase 1: Simple, stateless events ✅ Completed
  EventType.CHAT_MESSAGE, // ✅ Already working
  EventType.PLAYER_CONNECT, // Simple player state
  EventType.PLAYER_DISCONNECT, // Simple player state
  EventType.PLAYER_CHANGE_NAME, // Simple player data
  EventType.ACTION_PLAYER, // Simple action logging
  EventType.ACTION_PLAYER_PLAYER, // Simple action logging
  EventType.ACTION_TEAM, // Simple action logging
  EventType.ACTION_WORLD, // Simple action logging
  EventType.SERVER_STATS_UPDATE, // Periodic aggregation
  EventType.WEAPON_FIRE, // Simple weapon tracking
  EventType.WEAPON_HIT, // Simple weapon tracking

  // Phase 2: Match & Objective Events ✅ Completed
  EventType.ROUND_START, // Match coordination
  EventType.ROUND_END, // Match coordination
  EventType.TEAM_WIN, // Match results
  EventType.MAP_CHANGE, // Match transitions
  EventType.BOMB_PLANT, // Objective events
  EventType.BOMB_DEFUSE, // Objective events
  EventType.BOMB_EXPLODE, // Objective events
  EventType.HOSTAGE_RESCUE, // Objective events
  EventType.HOSTAGE_TOUCH, // Objective events
  EventType.FLAG_CAPTURE, // Objective events
  EventType.FLAG_DEFEND, // Objective events
  EventType.FLAG_PICKUP, // Objective events
  EventType.FLAG_DROP, // Objective events
  EventType.CONTROL_POINT_CAPTURE, // Objective events
  EventType.CONTROL_POINT_DEFEND, // Objective events

  // Phase 3: Complex Events with Idempotent Sagas ✅ Now Migrated
  EventType.PLAYER_KILL, // IdempotentKillEventSaga (4-step transaction)
  EventType.PLAYER_DEATH, // Ranking coordination (idempotent)
  EventType.PLAYER_TEAMKILL, // Cross-module coordination (idempotent)
  EventType.PLAYER_SUICIDE, // Player stats coordination (idempotent)
  EventType.PLAYER_DAMAGE, // Potential ranking impact (idempotent)

  // Phase 4: Server System Events ✅ Migrated
  EventType.SERVER_SHUTDOWN, // Server lifecycle management
  EventType.ADMIN_ACTION, // Administrative actions

  // Phase 5: Final Player Events ✅ Migrated
  EventType.PLAYER_ENTRY, // Player entry processing
  EventType.PLAYER_CHANGE_TEAM, // Team change coordination
  EventType.PLAYER_CHANGE_ROLE, // Role change coordination
])

/**
 * Events that still require EventBus (temporary)
 * 🎉 ALL EVENTS NOW MIGRATED TO QUEUE-ONLY! 🎉
 * EventBus can now be completely eliminated!
 */
const EVENTBUS_FALLBACK_EVENTS = new Set<EventType>([
  // 🚀 No EventBus fallback events remaining - full migration complete!
])

/**
 * Publisher metrics for monitoring migration progress
 */
export interface QueueFirstMetrics {
  readonly totalEvents: number
  readonly queueOnlyEvents: number
  readonly eventBusFallbackEvents: number
  readonly failedEvents: number
  readonly queueOnlySuccessRate: number
}

/**
 * Queue-First Event Publisher
 *
 * Prioritizes RabbitMQ queues with EventBus fallback during migration.
 * Designed for eventual EventBus removal.
 */
export class QueueFirstPublisher implements IEventEmitter {
  private metrics: QueueFirstMetrics = {
    totalEvents: 0,
    queueOnlyEvents: 0,
    eventBusFallbackEvents: 0,
    failedEvents: 0,
    queueOnlySuccessRate: 100,
  }

  constructor(
    private readonly queuePublisher: IEventPublisher,
    private readonly logger: ILogger,
    private readonly eventBusFallback?: IEventBus,
  ) {
    this.logger.info("Queue-first publisher initialized", {
      hasQueuePublisher: !!this.queuePublisher,
      hasEventBusFallback: !!this.eventBusFallback,
      queueOnlyEvents: QUEUE_ONLY_EVENTS.size,
      eventBusFallbackEvents: EVENTBUS_FALLBACK_EVENTS.size,
    })

    // Log migration status
    this.logMigrationStatus()
  }

  /**
   * Emit event using queue-first approach
   */
  async emit(event: BaseEvent): Promise<void> {
    const startTime = Date.now()

    try {
      this.metrics = {
        ...this.metrics,
        totalEvents: this.metrics.totalEvents + 1,
      }

      if (QUEUE_ONLY_EVENTS.has(event.eventType)) {
        // Fully migrated events - queue only
        await this.publishToQueueOnly(event)
        this.metrics = {
          ...this.metrics,
          queueOnlyEvents: this.metrics.queueOnlyEvents + 1,
        }
      } else if (EVENTBUS_FALLBACK_EVENTS.has(event.eventType)) {
        // Not yet migrated - use EventBus fallback
        await this.publishToEventBusFallback(event)
        this.metrics = {
          ...this.metrics,
          eventBusFallbackEvents: this.metrics.eventBusFallbackEvents + 1,
        }
      } else {
        // Unknown event type - log warning and use fallback
        this.logger.warn("Unknown event type, using EventBus fallback", {
          eventType: event.eventType,
          eventId: event.eventId,
        })
        await this.publishToEventBusFallback(event)
        this.metrics = {
          ...this.metrics,
          eventBusFallbackEvents: this.metrics.eventBusFallbackEvents + 1,
        }
      }

      // Update success rate
      this.updateSuccessRate()

      const processingTime = Date.now() - startTime
      this.logger.debug("Event published successfully", {
        eventType: event.eventType,
        eventId: event.eventId,
        isQueueOnly: QUEUE_ONLY_EVENTS.has(event.eventType),
        processingTimeMs: processingTime,
      })
    } catch (error) {
      this.metrics = {
        ...this.metrics,
        failedEvents: this.metrics.failedEvents + 1,
      }

      const processingTime = Date.now() - startTime
      this.logger.error("Failed to publish event", {
        eventType: event.eventType,
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
        processingTimeMs: processingTime,
      })

      throw error
    }
  }

  /**
   * Publish to queue only (migrated events)
   */
  private async publishToQueueOnly(event: BaseEvent): Promise<void> {
    await this.queuePublisher.publish(event)
  }

  /**
   * Publish to EventBus fallback (not yet migrated)
   */
  private async publishToEventBusFallback(event: BaseEvent): Promise<void> {
    if (!this.eventBusFallback) {
      throw new Error(`Event ${event.eventType} requires EventBus fallback but none provided`)
    }

    this.logger.debug(`Using EventBus fallback for ${event.eventType}`, {
      eventId: event.eventId,
      serverId: event.serverId,
    })

    await this.eventBusFallback.emit(event)
  }

  /**
   * Update queue-only success rate metric
   */
  private updateSuccessRate(): void {
    if (this.metrics.totalEvents === 0) {
      this.metrics = { ...this.metrics, queueOnlySuccessRate: 100 }
      return
    }

    const successfulEvents = this.metrics.totalEvents - this.metrics.failedEvents
    const successRate = (successfulEvents / this.metrics.totalEvents) * 100

    this.metrics = {
      ...this.metrics,
      queueOnlySuccessRate: Math.round(successRate),
    }
  }

  /**
   * Get current publishing metrics
   */
  getMetrics(): QueueFirstMetrics {
    return { ...this.metrics }
  }

  /**
   * Check if event type is fully migrated to queue-only
   */
  isQueueOnly(eventType: EventType): boolean {
    return QUEUE_ONLY_EVENTS.has(eventType)
  }

  /**
   * Get migration status summary
   */
  getMigrationStatus(): {
    queueOnlyEvents: EventType[]
    eventBusFallbackEvents: EventType[]
    migrationProgress: string
  } {
    const totalConfiguredEvents = QUEUE_ONLY_EVENTS.size + EVENTBUS_FALLBACK_EVENTS.size
    const migrationProgress = (QUEUE_ONLY_EVENTS.size / totalConfiguredEvents) * 100

    return {
      queueOnlyEvents: Array.from(QUEUE_ONLY_EVENTS),
      eventBusFallbackEvents: Array.from(EVENTBUS_FALLBACK_EVENTS),
      migrationProgress: `${Math.round(migrationProgress * 100) / 100}%`,
    }
  }

  /**
   * Log current migration status
   */
  private logMigrationStatus(): void {
    const status = this.getMigrationStatus()

    this.logger.info("EventBus → Queue migration status", {
      queueOnlyEvents: status.queueOnlyEvents.length,
      eventBusFallbackEvents: status.eventBusFallbackEvents.length,
      migrationProgress: `${status.migrationProgress}%`,
      phase1Complete: status.queueOnlyEvents.length >= 11, // Phase 1 (11 events)
      phase2Complete: status.queueOnlyEvents.length >= 25, // Phase 1 + 2 (25 events)
      phase3Complete: status.queueOnlyEvents.length >= 30, // Phase 1 + 2 + 3 (30 events)
      migratedPhases:
        status.queueOnlyEvents.length >= 30
          ? "Phase 1, 2 & 3"
          : status.queueOnlyEvents.length >= 25
            ? "Phase 1 & 2"
            : status.queueOnlyEvents.length >= 11
              ? "Phase 1"
              : "Partial",
      eventBusAlmostDeprecated: status.eventBusFallbackEvents.length <= 5,
    })
  }

  /**
   * Migrate an event type from EventBus to queue-only
   * This is called when an event type is ready for full migration
   */
  migrateEventToQueueOnly(eventType: EventType): void {
    if (QUEUE_ONLY_EVENTS.has(eventType)) {
      this.logger.warn(`Event ${eventType} is already queue-only, no migration needed`, {
        currentStatus: "queue_only",
        requestedStatus: "queue_only",
      })
      return
    }

    if (!EVENTBUS_FALLBACK_EVENTS.has(eventType)) {
      this.logger.warn(`Event ${eventType} is not in EventBus fallback set`)
      return
    }

    // This would require code changes to the constants above
    // For now, just log the migration request
    this.logger.info(`Migration requested for event ${eventType}`, {
      currentStatus: "eventbus_fallback",
      requestedStatus: "queue_only",
      note: "Requires code update to complete migration",
    })
  }
}
