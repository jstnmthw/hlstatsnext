import type { GameEvent } from "@/types/common/events"
import type { HandlerResult } from "./weapon.handler"

export interface IWeaponHandler {
  handleEvent(event: GameEvent): Promise<HandlerResult>
}
