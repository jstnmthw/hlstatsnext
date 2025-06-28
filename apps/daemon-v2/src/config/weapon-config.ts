export interface WeaponAttributes {
  /** Base body-shot damage for the weapon */
  baseDamage: number
  /** Skill multiplier used for ranking calculations */
  skillMultiplier: number
}

export type WeaponConfig = Record<string, WeaponAttributes>

// Map of per-game weapon configs. Initially empty because DB should be the source of truth.
export const WEAPON_CONFIGS: Record<string, WeaponConfig> = {}

// Baseline constants for unknown/uncatalogued weapons
export const DEFAULT_SKILL_MULTIPLIER = 1.0
export const DEFAULT_BASE_DAMAGE = 30

// Generic fallback configuration
export const FALLBACK_WEAPONS: WeaponConfig = {
  unknown: { baseDamage: DEFAULT_BASE_DAMAGE, skillMultiplier: DEFAULT_SKILL_MULTIPLIER },
}

/**
 * Retrieve weapon attributes for a given weapon and game.
 * If the weapon or game is unknown we fall back to sensible defaults so that
 * the processing pipeline never crashes on missing data.
 */
export function getWeaponAttributes(weapon: string, game: string = "csgo"): WeaponAttributes {
  const config = WEAPON_CONFIGS[game.toLowerCase()] ?? FALLBACK_WEAPONS

  const attr = config[weapon.toLowerCase()]
  if (attr) return attr
  return FALLBACK_WEAPONS.unknown as WeaponAttributes
}
