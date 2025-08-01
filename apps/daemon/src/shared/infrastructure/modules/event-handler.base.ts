/**
 * Base Module Event Handler
 *
 * Base class for module-specific event handlers that provides
 * common infrastructure for logging and metrics.
 * Events are processed via RabbitMQ queues and no longer require registration.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"

export abstract class BaseModuleEventHandler {
  constructor(
    protected readonly logger: ILogger,
    protected readonly metrics?: EventMetrics,
  ) {}

  /**
   * Cleanup method for consistency (no-op since no EventBus handlers to unregister)
   */
  destroy(): void {
    this.logger.debug(`${this.constructor.name} cleanup completed (queue-only processing)`)
  }
}
