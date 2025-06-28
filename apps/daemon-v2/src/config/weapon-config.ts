export interface WeaponAttributes {
  /** Base body-shot damage for the weapon */
  baseDamage: number
  /** Skill multiplier used for ranking calculations */
  skillMultiplier: number
}

export type WeaponConfig = Record<string, WeaponAttributes>

/**
 * Counter-Strike-style default weapon configuration.
 * These values should eventually live in the database so that admins can tweak
 * them per-game, but this in-memory map is sufficient for initial development.
 */
export const CSGO_WEAPONS: WeaponConfig = {
  ak47: { baseDamage: 36, skillMultiplier: 1.1 },
  m4a4: { baseDamage: 33, skillMultiplier: 1.0 },
  m4a1_silencer: { baseDamage: 33, skillMultiplier: 1.0 },
  awp: { baseDamage: 115, skillMultiplier: 1.3 },
  deagle: { baseDamage: 53, skillMultiplier: 1.2 },
  glock: { baseDamage: 28, skillMultiplier: 0.9 },
  usp: { baseDamage: 35, skillMultiplier: 1.0 },
  knife: { baseDamage: 42, skillMultiplier: 1.5 },
  p90: { baseDamage: 26, skillMultiplier: 0.8 },
  mp5: { baseDamage: 26, skillMultiplier: 0.8 },
  grenade: { baseDamage: 140, skillMultiplier: 1.3 },
}

/** Generic fallback configuration */
export const DEFAULT_WEAPONS: WeaponConfig = {
  unknown: { baseDamage: 30, skillMultiplier: 1.0 },
}

/**
 * Retrieve weapon attributes for a given weapon and game.
 * If the weapon or game is unknown we fall back to sensible defaults so that
 * the processing pipeline never crashes on missing data.
 */
export function getWeaponAttributes(weapon: string, game: string = "csgo"): WeaponAttributes {
  const config = game.toLowerCase().includes("cs") ? CSGO_WEAPONS : DEFAULT_WEAPONS

  const attr = config[weapon.toLowerCase()]
  if (attr) return attr
  return DEFAULT_WEAPONS.unknown as WeaponAttributes
}
