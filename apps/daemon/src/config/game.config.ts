/**
 * Game Configuration
 * 
 * Re-exports GameConfigService and common types for application use.
 */

import { 
  GameConfigService, 
  BOOTSTRAP_CONFIG,
  getDefaultGame,
  getUnknownMap,
  type GameRecord,
  type GamePattern 
} from "./game-config.service"

export { 
  GameConfigService, 
  BOOTSTRAP_CONFIG,
  getDefaultGame,
  getUnknownMap,
  type GameRecord,
  type GamePattern 
}

// Commonly used game codes
export const GAMES = {
  COUNTER_STRIKE_16: "cstrike",
  COUNTER_STRIKE_SOURCE: "css", 
  COUNTER_STRIKE_GO: "csgo",
  TEAM_FORTRESS_2: "tf2",
  TEAM_FORTRESS_CLASSIC: "tfc",
  DAY_OF_DEFEAT: "dod",
  HALF_LIFE_2_DEATHMATCH: "hl2dm",
  LEFT_4_DEAD_2: "l4d2",
} as const

export type GameCode = typeof GAMES[keyof typeof GAMES]

// Compatibility wrapper for current code
export const GameConfig = {
  GAMES,
  getDefaultGame: getDefaultGame,
  getUnknownMap: getUnknownMap,
  getMapFallback: () => BOOTSTRAP_CONFIG.MAP.FALLBACK,
}