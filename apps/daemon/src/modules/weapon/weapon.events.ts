/**
 * Weapon Module Event Handler
 * 
 * Handles weapon-specific events including weapon fire, weapon hits,
 * and weapon statistics from kill events. This handler allows the weapon
 * module to manage its own events and statistics independently.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/module-event-handler.base"
import type { BaseEvent } from "@/shared/types/events"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/event-metrics"
import type { IWeaponService, WeaponEvent } from "@/modules/weapon/weapon.types"
import { EventType } from "@/shared/types/events"

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
    // Direct weapon events
    this.registerHandler(EventType.WEAPON_FIRE, this.handleWeaponFire.bind(this))
    this.registerHandler(EventType.WEAPON_HIT, this.handleWeaponHit.bind(this))
    
    // Listen to PLAYER_KILL for weapon statistics
    // This demonstrates how modules can independently listen to the same event
    this.registerHandler(EventType.PLAYER_KILL, this.handleKillForWeaponStats.bind(this))
  }

  private async handleWeaponFire(event: BaseEvent): Promise<void> {
    this.logger.debug(`Weapon module handling WEAPON_FIRE for server ${event.serverId}`)
    
    await this.weaponService.handleWeaponEvent(event as WeaponEvent)
  }

  private async handleWeaponHit(event: BaseEvent): Promise<void> {
    this.logger.debug(`Weapon module handling WEAPON_HIT for server ${event.serverId}`)
    
    await this.weaponService.handleWeaponEvent(event as WeaponEvent)
  }

  private async handleKillForWeaponStats(event: BaseEvent): Promise<void> {
    this.logger.debug(`Weapon module processing kill event for weapon stats`)
    
    // Extract weapon information from kill event and update statistics
    // The weapon service only cares about weapon-related data from the kill
    await this.weaponService.handleWeaponEvent(event as WeaponEvent)
  }
}