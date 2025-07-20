/**
 * Shared Validation Utilities
 */

export function validateSteamId(steamId: string): boolean {
  if (!steamId || typeof steamId !== "string") {
    return false
  }

  // Bot check
  if (steamId.toUpperCase() === "BOT") {
    return true
  }

  // Steam ID format: 17 digits
  return /^\d{17}$/.test(steamId)
}

export function validatePlayerName(name: string): boolean {
  if (!name || typeof name !== "string") {
    return false
  }

  // Name should be between 1 and 64 characters
  return name.trim().length >= 1 && name.trim().length <= 64
}

export function validateServerId(serverId: number): boolean {
  return typeof serverId === "number" && serverId > 0
}

export function validateEventType(eventType: string): boolean {
  return typeof eventType === "string" && eventType.length > 0
}

export function sanitizePlayerName(name: string): string {
  if (!name || typeof name !== "string") {
    return ""
  }

  return name
    .trim()
    .replace(/\s+/g, "_") // Spaces → underscores
    .replace(/[^A-Za-z0-9_-]/g, "") // Remove exotic chars
    .substring(0, 48) // Leave room for prefixes within 64-char limit
}
