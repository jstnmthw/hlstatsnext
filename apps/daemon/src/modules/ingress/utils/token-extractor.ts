/**
 * Token Extractor
 *
 * Classifies incoming log lines as either authentication beacons
 * (HLXTOKEN:...) or regular engine-generated log lines.
 */

/** Prefix for authentication beacon lines */
const TOKEN_LINE_PREFIX = "HLXTOKEN:"

/** Regex to strip the GoldSrc/Source log timestamp prefix: "L MM/DD/YYYY - HH:MM:SS: " */
const LOG_TIMESTAMP_RE = /^L \d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}:\d{2}: /

/**
 * Result of classifying a log line.
 * Discriminated union for explicit handling.
 */
export type LineClassification =
  | { kind: "beacon"; token: string; gamePort: number }
  | { kind: "log_line"; logLine: string }
  | { kind: "rejected" }

/**
 * Classify an incoming log line as a beacon or regular log line.
 *
 * Beacons arrive wrapped in the standard engine log format:
 *   `L 02/22/2026 - 09:48:09: HLXTOKEN:<token>:<gamePort>`
 * We strip the timestamp prefix before checking for the HLXTOKEN: marker.
 *
 * @param rawLine - The raw log line received via UDP (after OOB header stripping)
 * @returns Classification result with extracted data
 */
export function classifyLine(rawLine: string): LineClassification {
  // Strip timestamp prefix for beacon detection
  // Engine wraps all log lines (including plugin beacons) in "L MM/DD/YYYY - HH:MM:SS: "
  const stripped = rawLine.replace(LOG_TIMESTAMP_RE, "")

  // Quick check for beacon prefix
  if (!stripped.startsWith(TOKEN_LINE_PREFIX)) {
    return { kind: "log_line", logLine: rawLine }
  }

  // Extract payload after prefix
  const payload = stripped.slice(TOKEN_LINE_PREFIX.length).trim()

  // Find the last colon to split token from port
  const lastColon = payload.lastIndexOf(":")

  // No colon or colon at end — malformed beacon
  if (lastColon === -1 || lastColon === payload.length - 1) {
    if (payload.length === 0) {
      return { kind: "rejected" }
    }
    // No port specified — use default
    return { kind: "beacon", token: payload, gamePort: 27015 }
  }

  const token = payload.slice(0, lastColon)
  const portStr = payload.slice(lastColon + 1)
  const gamePort = parseInt(portStr, 10)

  // Validate extracted values — reject ambiguous payloads instead of
  // falling back to log_line processing (RT-011: prevents data injection)
  if (token.length === 0 || isNaN(gamePort) || gamePort < 1 || gamePort > 65535) {
    return { kind: "rejected" }
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
