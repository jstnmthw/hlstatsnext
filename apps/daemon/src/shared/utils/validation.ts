/**
 * Shared Validation Utilities
 */

export function normalizeSteamId(steamId: unknown): string | null {
  if (typeof steamId !== "string") {
    return null
  }

  const raw = steamId.trim()
  if (raw.length === 0) {
    return null
  }

  // BOT special-case - support "BOT", "BOT:name", and "BOT_serverId_name" formats
  if (
    raw.toUpperCase() === "BOT" ||
    raw.toUpperCase().startsWith("BOT:") ||
    /^BOT_\d+_/.test(raw)
  ) {
    return raw
  }

  // Steam64: 17 digits
  if (/^\d{17}$/.test(raw)) {
    return raw
  }

  // Steam2: STEAM_X:Y:Z (accept X 0-5, Y 0|1, Z >= 0)
  const steam2Match = /^STEAM_[0-5]:([01]):(\d+)$/.exec(raw)
  if (steam2Match) {
    const y = Number(steam2Match[1])
    const z = Number(steam2Match[2])
    const base = 76561197960265728n
    const steam64 = base + BigInt(z) * 2n + BigInt(y)
    return steam64.toString()
  }

  // Steam3: [U:1:A] → base + A; we only accept individual user type U
  const steam3Match = /^\[([A-Za-z]):([0-5]):(\d+)\]$/.exec(raw)
  if (steam3Match) {
    const type = (steam3Match[1] ?? "").toUpperCase()
    const aStr = steam3Match[3]
    if (aStr === undefined) return null
    const a = BigInt(aStr)
    if (type === "U") {
      const base = 76561197960265728n
      const steam64 = base + a
      return steam64.toString()
    }
  }

  return null
}

export function validateSteamId(steamId: unknown): boolean {
  return normalizeSteamId(steamId) !== null
}

export function validatePlayerName(name: unknown): boolean {
  if (!name || typeof name !== "string") {
    return false
  }

  // Name should be between 1 and 64 characters
  return name.trim().length >= 1 && name.trim().length <= 64
}

export function validateServerId(serverId: unknown): boolean {
  return typeof serverId === "number" && serverId > 0
}

export function validateEventType(eventType: unknown): boolean {
  return typeof eventType === "string" && eventType.length > 0 && eventType.length <= 64
}

export function sanitizePlayerName(name: unknown): string {
  if (!name || typeof name !== "string") {
    return ""
  }

  return name
    .trim()
    .replace(/\s+/g, "_") // Spaces → underscores
    .replace(/[^A-Za-z0-9_-]/g, "") // Remove exotic chars
    .substring(0, 48) // Leave room for prefixes within 64-char limit
}
