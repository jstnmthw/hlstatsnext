/**
 * Match Module Event Handler
 *
 * Handles match-specific events including rounds, objectives, and match statistics.
 * This handler manages match lifecycle events and coordinates match-related
 * statistics independently from other modules.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/module-event-handler.base"
import type { BaseEvent } from "@/shared/types/events"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/event-metrics"
import type { IMatchService, MatchEvent, ObjectiveEvent } from "@/modules/match/match.types"

export class MatchEventHandler extends BaseModuleEventHandler {
  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    private readonly matchService: IMatchService,
    metrics?: EventMetrics,
  ) {
    super(eventBus, logger, metrics)
    this.registerEventHandlers()
  }

  registerEventHandlers(): void {
    // All match events have been migrated to queue-only processing (Phase 2 & 3)
    // - Match lifecycle: ROUND_START, ROUND_END, TEAM_WIN, MAP_CHANGE
    // - Objective events: BOMB_*, HOSTAGE_*, FLAG_*, CONTROL_POINT_*
    // - Kill events: PLAYER_KILL
    // These are now handled via RabbitMQConsumer and no longer use EventBus
  }

  // Queue-compatible handler methods (called by RabbitMQConsumer)
  // Match lifecycle handlers
  async handleRoundStart(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling ROUND_START for server ${event.serverId}`)
    await this.matchService.handleMatchEvent(event as MatchEvent)
  }

  async handleRoundEnd(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling ROUND_END for server ${event.serverId}`)
    await this.matchService.handleMatchEvent(event as MatchEvent)
  }

  async handleTeamWin(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling TEAM_WIN for server ${event.serverId}`)
    await this.matchService.handleMatchEvent(event as MatchEvent)
  }

  async handleMapChange(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling MAP_CHANGE for server ${event.serverId}`)
    await this.matchService.handleMatchEvent(event as MatchEvent)
  }

  // Objective event handlers
  async handleBombPlant(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling BOMB_PLANT for server ${event.serverId}`)
    await this.matchService.handleObjectiveEvent(event as ObjectiveEvent)
  }

  async handleBombDefuse(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling BOMB_DEFUSE for server ${event.serverId}`)
    await this.matchService.handleObjectiveEvent(event as ObjectiveEvent)
  }

  async handleBombExplode(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling BOMB_EXPLODE for server ${event.serverId}`)
    await this.matchService.handleObjectiveEvent(event as ObjectiveEvent)
  }

  async handleHostageRescue(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling HOSTAGE_RESCUE for server ${event.serverId}`)
    await this.matchService.handleObjectiveEvent(event as ObjectiveEvent)
  }

  async handleHostageTouch(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling HOSTAGE_TOUCH for server ${event.serverId}`)
    await this.matchService.handleObjectiveEvent(event as ObjectiveEvent)
  }

  async handleFlagCapture(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling FLAG_CAPTURE for server ${event.serverId}`)
    await this.matchService.handleObjectiveEvent(event as ObjectiveEvent)
  }

  async handleFlagDefend(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling FLAG_DEFEND for server ${event.serverId}`)
    await this.matchService.handleObjectiveEvent(event as ObjectiveEvent)
  }

  async handleFlagPickup(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling FLAG_PICKUP for server ${event.serverId}`)
    await this.matchService.handleObjectiveEvent(event as ObjectiveEvent)
  }

  async handleFlagDrop(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling FLAG_DROP for server ${event.serverId}`)
    await this.matchService.handleObjectiveEvent(event as ObjectiveEvent)
  }

  async handleControlPointCapture(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling CONTROL_POINT_CAPTURE for server ${event.serverId}`)
    await this.matchService.handleObjectiveEvent(event as ObjectiveEvent)
  }

  async handleControlPointDefend(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling CONTROL_POINT_DEFEND for server ${event.serverId}`)
    await this.matchService.handleObjectiveEvent(event as ObjectiveEvent)
  }

  // Kill event handler for match statistics
  async handlePlayerKill(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module processing kill event for match stats`)
    await this.matchService.handleKillInMatch(event)
  }
}
