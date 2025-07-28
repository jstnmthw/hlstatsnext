/**
 * Weapon Module Event Handler
 *
 * Handles weapon-specific events including weapon fire and weapon hits.
 * This handler allows the weapon module to manage its own events and statistics independently.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/module-event-handler.base"
import type { BaseEvent } from "@/shared/types/events"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/event-metrics"
import type { IWeaponService, WeaponEvent } from "@/modules/weapon/weapon.types"

export class WeaponEventHandler extends BaseModuleEventHandler {
  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    private readonly weaponService: IWeaponService,
    metrics?: EventMetrics,
  ) {
    super(eventBus, logger, metrics)
    this.registerEventHandlers()
  }

  registerEventHandlers(): void {
    // All weapon events have been migrated to queue-only processing (Phase 1 & 3)
    // - Direct weapon events: WEAPON_FIRE, WEAPON_HIT (Phase 1)
    // - Kill events: PLAYER_KILL (Phase 3)
    // These are now handled via RabbitMQConsumer and no longer use EventBus
  }

  // Queue-compatible handler methods (called by RabbitMQConsumer)
  async handleWeaponFire(event: BaseEvent): Promise<void> {
    this.logger.debug(`Weapon module handling WEAPON_FIRE for server ${event.serverId}`)

    await this.weaponService.handleWeaponEvent(event as WeaponEvent)
  }

  async handleWeaponHit(event: BaseEvent): Promise<void> {
    this.logger.debug(`Weapon module handling WEAPON_HIT for server ${event.serverId}`)

    await this.weaponService.handleWeaponEvent(event as WeaponEvent)
  }

  async handlePlayerKill(event: BaseEvent): Promise<void> {
    this.logger.debug(`Weapon module handling PLAYER_KILL for server ${event.serverId}`)

    await this.weaponService.handleWeaponEvent(event as WeaponEvent)
  }
}
