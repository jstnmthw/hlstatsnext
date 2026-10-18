/**
 * @repo/crypto
 *
 * Secrets that cross the API/daemon boundary: AES-256-GCM encryption for RCON
 * passwords at rest, and SHA-256 hashing for server authentication tokens.
 * The API encrypts and issues; the daemon decrypts and verifies, so both must
 * share one implementation.
 */

export { CryptoService } from "./encryption"
export { CryptoError, CryptoErrorCode } from "./types"
export type { EncryptedData, ICryptoService } from "./types"

// Token utilities for server authentication
export {
  extractTokenPrefix,
  generateToken,
  hashToken,
  isValidTokenFormat,
  TOKEN_CONSTANTS,
} from "./token"
export type { GeneratedToken } from "./token"

import { CryptoService } from "./encryption"

/**
 * Create a crypto service instance with environment configuration
 *
 * @param encryptionKey - Base64 encoded 32-byte master key (defaults to ENCRYPTION_KEY)
 * @returns Configured crypto service instance
 */
export function createCryptoService(encryptionKey?: string): CryptoService {
  const key = encryptionKey || process.env.ENCRYPTION_KEY

  if (!key) {
    throw new Error(
      "Encryption key is required. Set ENCRYPTION_KEY environment variable or pass key directly.",
    )
  }

  return new CryptoService(key)
}
