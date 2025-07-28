/**
 * Server Module Event Handler
 *
 * Handles server-specific events including server lifecycle events,
 * admin actions, and server statistics updates.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/module-event-handler.base"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/event-metrics"
import type { IServerService } from "@/modules/server/server.types"

export class ServerEventHandler extends BaseModuleEventHandler {
  constructor(
    logger: ILogger,
    private readonly serverService: IServerService,
    metrics?: EventMetrics,
  ) {
    super(logger, metrics)
    this.registerEventHandlers()
  }

  registerEventHandlers(): void {
    // All server events have been migrated to queue-only processing (Phase 4)
    // - SERVER_SHUTDOWN: Queue-only server lifecycle management
    // - ADMIN_ACTION: Queue-only administrative actions
    // - SERVER_STATS_UPDATE: Queue-only periodic statistics (already migrated)
    // These are now handled via RabbitMQConsumer and no longer use EventBus
  }

  // All EventBus handlers removed - server events are now queue-only (Phase 4)
  // - handleServerShutdown: SERVER_SHUTDOWN now processed via queue
  // - handleAdminAction: ADMIN_ACTION now processed via queue
  // - handleServerStatsUpdate: SERVER_STATS_UPDATE already migrated to queue
}
