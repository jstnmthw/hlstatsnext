/**
 * Server Module Event Handler
 *
 * Handles server-specific events including server lifecycle events,
 * admin actions, and server statistics updates.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/module-event-handler.base"
import type { BaseEvent } from "@/shared/types/events"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/event-metrics"
import type { IServerService } from "@/modules/server/server.types"
import { EventType } from "@/shared/types/events"

export class ServerEventHandler extends BaseModuleEventHandler {
  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    private readonly serverService: IServerService,
    metrics?: EventMetrics,
  ) {
    super(eventBus, logger, metrics)
    this.registerEventHandlers()
  }

  registerEventHandlers(): void {
    // Server lifecycle events
    this.registerHandler(EventType.SERVER_SHUTDOWN, this.handleServerShutdown.bind(this))
    this.registerHandler(EventType.SERVER_STATS_UPDATE, this.handleServerStatsUpdate.bind(this))
    this.registerHandler(EventType.ADMIN_ACTION, this.handleAdminAction.bind(this))
  }

  private async handleServerShutdown(event: BaseEvent): Promise<void> {
    this.logger.debug(`Server module handling SERVER_SHUTDOWN for server ${event.serverId}`)

    // Handle server shutdown logic
    await this.serverService.handleServerShutdown?.(event.serverId)
  }

  private async handleServerStatsUpdate(event: BaseEvent): Promise<void> {
    this.logger.debug(`Server module handling SERVER_STATS_UPDATE for server ${event.serverId}`)

    // Handle server statistics update
    await this.serverService.handleStatsUpdate?.(
      event.serverId,
      (event.data as Record<string, unknown>) || {},
    )
  }

  private async handleAdminAction(event: BaseEvent): Promise<void> {
    this.logger.debug(`Server module handling ADMIN_ACTION for server ${event.serverId}`)

    // Handle admin actions
    const adminData = event.data as Record<string, unknown>
    await this.serverService.handleAdminAction?.(
      (adminData?.adminId as number) || 0,
      (adminData?.action as string) || "unknown",
      adminData?.target as string,
    )
  }
}
