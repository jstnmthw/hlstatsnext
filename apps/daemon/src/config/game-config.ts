export const DEFAULT_GAME = "csgo"

/**
 * Mapping of legacy/alias game identifiers to canonical IDs.
 * This allows older log formats (e.g., "cstrike") to resolve to
 * the modern canonical identifier.
 */
export const GAME_ALIASES: Record<string, string> = {
  cstrike: "csgo",
}

/**
 * Resolve an input game identifier (possibly an alias) to the canonical ID.
 */
export function resolveGameId(input: string | undefined | null): string {
  if (!input) return DEFAULT_GAME
  const lower = input.toLowerCase()
  return GAME_ALIASES[lower] ?? lower
}
