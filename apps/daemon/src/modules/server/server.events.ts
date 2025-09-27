/**
 * Server Module Event Handler
 *
 * Handles server-specific events including server lifecycle events,
 * admin actions, and server statistics updates.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/modules/event-handler.base"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"

export class ServerEventHandler extends BaseModuleEventHandler {
  constructor(logger: ILogger, metrics?: EventMetrics) {
    super(logger, metrics)
  }
}
