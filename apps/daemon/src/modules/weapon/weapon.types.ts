/**
 * Weapon Module Types
 */

import type { BaseEvent, EventType, PlayerMeta } from "@/shared/types/events"
import type { HandlerResult } from "@/shared/types/common"
import type { FindOptions, UpdateOptions } from "@/shared/types/database"

// Weapon event types
export interface WeaponFireEvent extends BaseEvent {
  eventType: EventType.WEAPON_FIRE
  data: {
    playerId: number
    weaponCode: string
    weaponName?: string
    team: string
  }
  meta?: PlayerMeta
}

export interface WeaponHitEvent extends BaseEvent {
  eventType: EventType.WEAPON_HIT
  data: {
    playerId: number
    victimId?: number
    weaponCode: string
    weaponName?: string
    team: string
    damage?: number
  }
  meta?: PlayerMeta
}

export type WeaponEvent = WeaponFireEvent | WeaponHitEvent

// Service interfaces
export interface IWeaponService {
  handleWeaponEvent(event: WeaponEvent): Promise<HandlerResult>
  updateWeaponStats(
    weaponCode: string,
    stats: { shots?: number; hits?: number; damage?: number },
  ): Promise<void>
}

export interface IWeaponRepository {
  updateWeaponStats(
    weaponCode: string,
    updates: Record<string, unknown>,
    options?: UpdateOptions,
  ): Promise<void>
  findWeaponByCode(weaponCode: string, options?: FindOptions): Promise<unknown>
}
