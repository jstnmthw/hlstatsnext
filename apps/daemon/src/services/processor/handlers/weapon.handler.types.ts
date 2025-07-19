import type { GameEvent } from "@/types/common/events"

export interface HandlerResult {
  success: boolean
  error?: string
  weaponsAffected?: string[]
}

export interface WeaponStats {
  weaponName: string
  kills: number
  headshots: number
  shots: number
  hits: number
  accuracy: number
  damage: number
  weaponsAffected?: string[]
}

export interface PlayerWeaponStats {
  playerId: number
  weapon: string
  shots: number
  hits: number
  kills: number
  headshots: number
  damage: number
}

export interface IWeaponHandler {
  handleEvent(event: GameEvent): Promise<HandlerResult>
}
