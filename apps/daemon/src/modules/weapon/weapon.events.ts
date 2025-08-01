/**
 * Weapon Module Event Handler
 *
 * Handles weapon-specific events including weapon fire and weapon hits.
 * This handler allows the weapon module to manage its own events and statistics independently.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/modules/event-handler.base"
import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import type { IWeaponService, WeaponEvent } from "@/modules/weapon/weapon.types"

export class WeaponEventHandler extends BaseModuleEventHandler {
  constructor(
    logger: ILogger,
    private readonly weaponService: IWeaponService,
    metrics?: EventMetrics,
  ) {
    super(logger, metrics)
    // No event registration needed - all events handled via RabbitMQ queue
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
