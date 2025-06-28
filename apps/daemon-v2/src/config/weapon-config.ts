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
export const CS_WEAPONS: WeaponConfig = {
  ak47: { baseDamage: 36, skillMultiplier: 1.0 }, // Assault Rifle
  m4a4: { baseDamage: 33, skillMultiplier: 1.0 }, // Assault Rifle
  m4a1_silencer: { baseDamage: 33, skillMultiplier: 1.0 },
  awp: { baseDamage: 115, skillMultiplier: 1.4 }, // Precision Rifle
  ssg08: { baseDamage: 88, skillMultiplier: 1.4 }, // Scout (Precision Rifle)
  aug: { baseDamage: 33, skillMultiplier: 1.0 }, // Assault Rifle
  famas: { baseDamage: 33, skillMultiplier: 1.0 }, // Assault Rifle
  galil: { baseDamage: 33, skillMultiplier: 1.0 }, // Assault Rifle
  m4a1: { baseDamage: 33, skillMultiplier: 1.0 }, // Assault Rifle
  deagle: { baseDamage: 53, skillMultiplier: 0.8 }, // Pistol
  glock: { baseDamage: 28, skillMultiplier: 0.8 }, // Pistol
  usp: { baseDamage: 35, skillMultiplier: 0.8 }, // Pistol
  ump45: { baseDamage: 35, skillMultiplier: 0.9 }, // SMG
  mp5: { baseDamage: 26, skillMultiplier: 0.9 }, // SMG
  knife: { baseDamage: 42, skillMultiplier: 2.0 }, // Knife/Melee
  p90: { baseDamage: 26, skillMultiplier: 0.9 },
  grenade: { baseDamage: 140, skillMultiplier: 1.0 }, // Explosives not in table, baseline 1.0
}

/** Generic fallback configuration */
export const DEFAULT_WEAPONS: WeaponConfig = {
  unknown: { baseDamage: 30, skillMultiplier: 1.0 },
}

// Support easy extensibility: map per-game configs
export const WEAPON_CONFIGS: Record<string, WeaponConfig> = {
  cstrike: CS_WEAPONS,
}

/**
 * Retrieve weapon attributes for a given weapon and game.
 * If the weapon or game is unknown we fall back to sensible defaults so that
 * the processing pipeline never crashes on missing data.
 */
export function getWeaponAttributes(weapon: string, game: string = "cstrike"): WeaponAttributes {
  const config = WEAPON_CONFIGS[game.toLowerCase()] ?? DEFAULT_WEAPONS

  const attr = config[weapon.toLowerCase()]
  if (attr) return attr
  return DEFAULT_WEAPONS.unknown as WeaponAttributes
}
