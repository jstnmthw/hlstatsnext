/**
 * Server Module Event Handler
 *
 * Handles server-specific events including server lifecycle events,
 * admin actions, and server statistics updates. Registered for
 * SERVER_SHUTDOWN and delegates per-server cleanup fan-out to
 * ServerLifecycleCoordinator.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/modules/event-handler.base"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { ServerLifecycleCoordinator } from "./server-lifecycle.coordinator"

export class ServerEventHandler extends BaseModuleEventHandler {
  private lifecycleCoordinator?: ServerLifecycleCoordinator

  constructor(
    logger: ILogger,
    lifecycleCoordinator?: ServerLifecycleCoordinator,
    metrics?: EventMetrics,
  ) {
    super(logger, metrics)
    this.lifecycleCoordinator = lifecycleCoordinator
  }

  /**
   * Late-bind the coordinator. The fan-out needs services constructed in
   * context.ts after this handler — the coordinator must be set before the
   * first SERVER_SHUTDOWN arrives.
   */
  setLifecycleCoordinator(coordinator: ServerLifecycleCoordinator): void {
    this.lifecycleCoordinator = coordinator
  }

  /**
   * SERVER_SHUTDOWN handler — fan out cleanup across every module that holds
   * per-server state. Idempotent so duplicate redeliveries are safe.
   */
  async handleServerShutdown(event: BaseEvent): Promise<void> {
    if (!this.lifecycleCoordinator) {
      this.logger.debug(
        `SERVER_SHUTDOWN received for server ${event.serverId} but no lifecycle coordinator wired`,
      )
      return
    }
    await this.lifecycleCoordinator.handleShutdown(event.serverId)
  }
}
