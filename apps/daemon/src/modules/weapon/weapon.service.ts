/**
 * Weapon Service
 */

import type { HandlerResult } from "@/shared/types/common"
import { EventType } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type {
  IWeaponRepository,
  IWeaponService,
  WeaponEvent,
  WeaponFireEvent,
  WeaponHitEvent,
} from "./weapon.types"

export class WeaponService implements IWeaponService {
  constructor(
    private readonly repository: IWeaponRepository,
    private readonly logger: ILogger,
  ) {}

  async handleWeaponEvent(event: WeaponEvent): Promise<HandlerResult> {
    try {
      switch (event.eventType) {
        case EventType.WEAPON_FIRE:
          return await this.handleWeaponFire(event)
        case EventType.WEAPON_HIT:
          return await this.handleWeaponHit(event)
        default:
          return { success: true }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async updateWeaponStats(
    weaponCode: string,
    stats: { shots?: number; hits?: number; damage?: number },
  ): Promise<void> {
    try {
      const updates: Record<string, unknown> = {}

      if (stats.shots !== undefined) {
        updates.shots = { increment: stats.shots }
      }
      if (stats.hits !== undefined) {
        updates.hits = { increment: stats.hits }
      }
      if (stats.damage !== undefined) {
        updates.damage = { increment: stats.damage }
      }

      await this.repository.updateWeaponStats(weaponCode, updates)
    } catch (error) {
      this.logger.error(`Failed to update weapon stats for ${weaponCode}: ${error}`)
      throw error
    }
  }

  private async handleWeaponFire(event: WeaponEvent): Promise<HandlerResult> {
    try {
      if (event.eventType !== EventType.WEAPON_FIRE) {
        return { success: false, error: "Invalid event type for handleWeaponFire" }
      }
      const fireEvent = event as WeaponFireEvent
      const { weaponCode } = fireEvent.data
      await this.updateWeaponStats(weaponCode, { shots: 1 })

      this.logger.debug(`Weapon fired: ${weaponCode}`)

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handleWeaponHit(event: WeaponEvent): Promise<HandlerResult> {
    try {
      if (event.eventType !== EventType.WEAPON_HIT) {
        return { success: false, error: "Invalid event type for handleWeaponHit" }
      }
      const hitEvent = event as WeaponHitEvent
      const { weaponCode, damage } = hitEvent.data
      await this.updateWeaponStats(weaponCode, { hits: 1, damage: damage || 0 })

      this.logger.debug(`Weapon hit: ${weaponCode} (${damage || 0} damage)`)

      return { success: true, affected: 1 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
