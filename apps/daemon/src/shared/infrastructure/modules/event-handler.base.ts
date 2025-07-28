/**
 * Base Module Event Handler
 *
 * Abstract base class for module-specific event handlers that provides
 * common infrastructure for registering and managing event handlers.
 * This enables each module to handle its own events independently while
 * maintaining consistency across the application.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"

export abstract class BaseModuleEventHandler {
  constructor(
    protected readonly logger: ILogger,
    protected readonly metrics?: EventMetrics,
  ) {}

  /**
   * Register all event handlers for this module.
   * This method should be called by the concrete implementation's constructor.
   * Note: All events are now processed via RabbitMQ queue, no EventBus handlers needed.
   */
  abstract registerEventHandlers(): void

  /**
   * Cleanup method for consistency (no-op since no EventBus handlers to unregister)
   */
  destroy(): void {
    this.logger.debug(`${this.constructor.name} cleanup completed (queue-only processing)`)
  }
}
