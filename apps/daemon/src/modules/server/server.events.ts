/**
 * Server Module Event Handler
 *
 * Handles server-specific events including server lifecycle events,
 * admin actions, and server statistics updates.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/modules/event-handler.base"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import type { IServerService } from "@/modules/server/server.types"

export class ServerEventHandler extends BaseModuleEventHandler {
  constructor(
    logger: ILogger,
    private readonly serverService: IServerService,
    metrics?: EventMetrics,
  ) {
    super(logger, metrics)
    // No event registration needed - all events handled via RabbitMQ queue
  }

  // All EventBus handlers removed - server events are now queue-only (Phase 4)
  // - handleServerShutdown: SERVER_SHUTDOWN now processed via queue
  // - handleAdminAction: ADMIN_ACTION now processed via queue
  // - handleServerStatsUpdate: SERVER_STATS_UPDATE already migrated to queue
}
