/**
 * Token Extractor
 *
 * Classifies incoming log lines as either authentication beacons
 * (HLXTOKEN:...) or regular engine-generated log lines.
 */

/** Prefix for authentication beacon lines */
const TOKEN_LINE_PREFIX = "HLXTOKEN:"

/**
 * Result of classifying a log line.
 * Discriminated union for explicit handling.
 */
export type LineClassification =
  | { kind: "beacon"; token: string; gamePort: number }
  | { kind: "log_line"; logLine: string }

/**
 * Classify an incoming log line as a beacon or regular log line.
 *
 * Beacon format: `HLXTOKEN:<token>:<gamePort>`
 * Example: `HLXTOKEN:hlxn_K7gNU3sdo-OL0wNhv0-ATkGjQL1qOlRhsGAhK7eo-Xc:27015`
 *
 * @param rawLine - The raw log line received via UDP
 * @returns Classification result with extracted data
 */
export function classifyLine(rawLine: string): LineClassification {
  // Quick check for beacon prefix
  if (!rawLine.startsWith(TOKEN_LINE_PREFIX)) {
    return { kind: "log_line", logLine: rawLine }
  }

  // Extract payload after prefix
  const payload = rawLine.slice(TOKEN_LINE_PREFIX.length).trim()

  // Find the last colon to split token from port
  const lastColon = payload.lastIndexOf(":")

  // No colon or colon at end - malformed, but try to use as token with default port
  if (lastColon === -1 || lastColon === payload.length - 1) {
    if (payload.length === 0) {
      // Empty payload - treat as regular log line (malformed)
      return { kind: "log_line", logLine: rawLine }
    }
    // No port specified - use default
    return { kind: "beacon", token: payload, gamePort: 27015 }
  }

  const token = payload.slice(0, lastColon)
  const portStr = payload.slice(lastColon + 1)
  const gamePort = parseInt(portStr, 10)

  // Validate extracted values
  if (token.length === 0 || isNaN(gamePort) || gamePort < 1 || gamePort > 65535) {
    // Malformed beacon - treat as regular log line
    return { kind: "log_line", logLine: rawLine }
  }

  return { kind: "beacon", token, gamePort }
}

/**
 * Check if a line is a beacon (quick check without full parsing).
 *
 * @param rawLine - The raw log line
 * @returns true if the line starts with HLXTOKEN:
 */
export function isBeaconLine(rawLine: string): boolean {
  return rawLine.startsWith(TOKEN_LINE_PREFIX)
}

// Export prefix for testing
export const BEACON_PREFIX = TOKEN_LINE_PREFIX
