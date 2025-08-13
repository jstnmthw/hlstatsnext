/**
 * Game code validation utilities
 *
 * Validates game code format and structure.
 */

/**
 * Validates game code format
 *
 * @param gameCode - The game code to validate
 * @throws Error if game code is invalid
 */
export function validateGameCode(gameCode: string): void {
  if (!gameCode || typeof gameCode !== "string" || gameCode.trim().length === 0) {
    throw new Error("Game code must be a non-empty string")
  }

  // Basic validation for game code format (alphanumeric and underscores)
  if (!/^[a-zA-Z0-9_]+$/.test(gameCode)) {
    throw new Error(`Invalid game code format: ${gameCode}`)
  }
}

/**
 * Checks if game code is valid without throwing
 *
 * @param gameCode - The game code to validate
 * @returns true if game code is valid, false otherwise
 */
export function isValidGameCode(gameCode: string): boolean {
  try {
    validateGameCode(gameCode)
    return true
  } catch {
    return false
  }
}
