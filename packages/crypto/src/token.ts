/**
 * Server Token Utilities
 *
 * Provides token generation, hashing, and validation for the token-based
 * authentication system. Tokens use the format `hlxn_<base64url(32 random bytes)>`.
 */

import { createHash, randomBytes } from "crypto"

/** Token prefix for identification and grep-ability */
const TOKEN_PREFIX = "hlxn_"

/** Number of random bytes for token entropy (256 bits) */
const TOKEN_BYTE_LENGTH = 32

/** Characters from prefix to store for display (after hlxn_) */
const TOKEN_DISPLAY_PREFIX_LENGTH = 8

/**
 * Expected total token length: prefix (5) + base64url of 32 bytes (43) = 48
 * Base64url encoding: ceil(32 * 8 / 6) = 43 chars
 */
const EXPECTED_TOKEN_LENGTH = TOKEN_PREFIX.length + 43 // 48

export interface GeneratedToken {
  /** Full raw token to show once to admin (never stored) */
  readonly raw: string
  /** SHA-256 hash of raw token (stored in DB) */
  readonly hash: string
  /** Display prefix for admin UI (e.g., "hlxn_K7gNU3sd...") */
  readonly prefix: string
}

/**
 * Generate a new server authentication token
 *
 * @returns Object containing raw token, hash, and display prefix
 *
 * @example
 * ```typescript
 * const { raw, hash, prefix } = generateToken()
 * // raw: "hlxn_K7gNU3sdo-OL0wNhv0-ATkGjQL1qOlRhsGAhK7eo-Xc"
 * // hash: "a948904f2f0f479b8f8..." (64 hex chars)
 * // prefix: "hlxn_K7gNU3sd"
 * ```
 */
export function generateToken(): GeneratedToken {
  const bytes = randomBytes(TOKEN_BYTE_LENGTH)
  const raw = TOKEN_PREFIX + bytes.toString("base64url")
  const hash = hashToken(raw)
  const prefix = raw.slice(0, TOKEN_PREFIX.length + TOKEN_DISPLAY_PREFIX_LENGTH)

  return { raw, hash, prefix }
}

/**
 * Hash a raw token using SHA-256
 *
 * @param raw - The raw token string
 * @returns 64-character lowercase hex string
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex")
}

/**
 * Validate token format without checking database
 *
 * Checks:
 * - Is a non-empty string
 * - Starts with "hlxn_" prefix
 * - Has expected length (48 chars)
 *
 * @param token - Token to validate
 * @returns true if format is valid
 */
export function isValidTokenFormat(token: string): boolean {
  return (
    typeof token === "string" &&
    token.startsWith(TOKEN_PREFIX) &&
    token.length === EXPECTED_TOKEN_LENGTH
  )
}

/**
 * Extract the display prefix from a raw token
 *
 * @param raw - The raw token string
 * @returns Display prefix (e.g., "hlxn_K7gNU3sd")
 */
export function extractTokenPrefix(raw: string): string {
  return raw.slice(0, TOKEN_PREFIX.length + TOKEN_DISPLAY_PREFIX_LENGTH)
}

// Constants exported for testing
export const TOKEN_CONSTANTS = {
  PREFIX: TOKEN_PREFIX,
  BYTE_LENGTH: TOKEN_BYTE_LENGTH,
  DISPLAY_PREFIX_LENGTH: TOKEN_DISPLAY_PREFIX_LENGTH,
  EXPECTED_LENGTH: EXPECTED_TOKEN_LENGTH,
} as const
