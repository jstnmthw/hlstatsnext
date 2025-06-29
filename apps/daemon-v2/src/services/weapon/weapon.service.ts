import { getWeaponAttributes, DEFAULT_SKILL_MULTIPLIER } from "@/config/weapon-config"
import { resolveGameId } from "@/config/game-config"
import { DatabaseClient, databaseClient as defaultDb } from "@/database/client"
import { ILogger } from "@/utils/logger.types"
import { logger as defaultLogger } from "@/utils/logger"
import { IWeaponService } from "./weapon.types"

/**
 * Centralised access point for weapon metadata and multipliers.
 *
 *   – Prefers authoritative data from the database.
 *   – Falls back to static defaults to guarantee coverage.
 *   – Caches look-ups in memory for the lifetime of the daemon.
 */
export class WeaponService implements IWeaponService {
  private readonly cache = new Map<string, number>()

  // Weapon damage constants
  private readonly HEADSHOT_DAMAGE_MULTIPLIER = 4.0
  private readonly BODY_SHOT_MULTIPLIER = 1.0

  constructor(
    private readonly db: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  /**
   * Fetch weapon modifier (skill multiplier) for a given game + weapon code.
   * Returns null if the weapon is not present in the database.
   */
  async getWeaponModifier(game: string, code: string): Promise<number | null> {
    try {
      const weapon = await this.db.prisma.weapon.findFirst({
        where: {
          game,
          code,
        },
        select: {
          modifier: true,
        },
      })

      return weapon?.modifier ?? null
    } catch (error) {
      this.logger.error(`Failed to fetch weapon modifier for ${game}:${code}: ${error as string}`)
      return null
    }
  }

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
    const dbModifier = await this.getWeaponModifier(canonicalGame, weapon.toLowerCase())
    let multiplier: number | null = dbModifier

    // 2) Fallback → static defaults
    if (multiplier == null) {
      const { skillMultiplier } = getWeaponAttributes(weapon, canonicalGame)
      multiplier = skillMultiplier
    }

    // Guarantee a sensible default even if both sources fail (shouldn't happen)
    if (multiplier == null) multiplier = DEFAULT_SKILL_MULTIPLIER

    this.cache.set(key, multiplier)
    return multiplier
  }

  /**
   * Get weapon damage multiplier for damage calculations
   */
  async getDamageMultiplier(weapon: string, headshot: boolean): Promise<number> {
    const { baseDamage } = getWeaponAttributes(weapon)
    const headshotMultiplier = headshot ? this.HEADSHOT_DAMAGE_MULTIPLIER : this.BODY_SHOT_MULTIPLIER
    return baseDamage * headshotMultiplier
  }

  /**
   * Clear the weapon multiplier cache
   */
  clearCache(): void {
    this.cache.clear()
    this.logger.info("Weapon service cache cleared")
  }

  /**
   * Get cached weapon count for monitoring
   */
  getCacheSize(): number {
    return this.cache.size
  }
}

export function createWeaponService(
  databaseClient: DatabaseClient = defaultDb,
  logger: ILogger = defaultLogger,
): IWeaponService {
  return new WeaponService(databaseClient, logger)
}
