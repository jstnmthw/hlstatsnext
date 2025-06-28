import { getWeaponAttributes } from "@/config/weapon-config"
import { resolveGameId } from "@/config/game-config"
import type { DatabaseClient } from "@/database/client"

/**
 * Centralised access point for weapon metadata (skill multipliers, base damage …).
 *
 *   – Prefers authoritative data from the `hlstats_Weapons` table.
 *   – Falls back to the static defaults in `weapon-config` to guarantee coverage.
 *   – Caches look-ups in memory for the lifetime of the daemon.
 */
export class WeaponService {
  private readonly cache = new Map<string, number>()

  constructor(private readonly db: DatabaseClient) {}

  /**
   * Get the skill multiplier used in ranking calculations for a given game/weapon.
   * @param game  Canonical or alias game identifier.
   * @param weapon Weapon code from log/event (case-insensitive).
   */
  async getSkillMultiplier(game: string | undefined, weapon: string): Promise<number> {
    const canonicalGame = resolveGameId(game)
    const key = `${canonicalGame}:${weapon.toLowerCase()}`
    if (this.cache.has(key)) return this.cache.get(key)!

    // 1) Try DB first
    const dbModifier = await this.db.getWeaponModifier(canonicalGame, weapon.toLowerCase())
    let multiplier: number | null = dbModifier

    // 2) Fallback → static defaults
    if (multiplier == null) {
      const { skillMultiplier } = getWeaponAttributes(weapon, canonicalGame)
      multiplier = skillMultiplier
    }

    // Guarantee a sensible default even if both sources fail (shouldn't happen)
    if (multiplier == null) multiplier = 1.0

    this.cache.set(key, multiplier)
    return multiplier
  }
}
