/**
 * @repo/crypto - Unified Password Encryption Package
 *
 * Provides secure password hashing and encryption services for the HLStatsNext monorepo.
 * Used by all applications (daemon, api, web) for consistent security practices.
 */

export { CryptoService } from "./encryption"
export type { ICryptoService, CryptoConfig, EncryptedData } from "./types"
export { CryptoError, CryptoErrorCode, DEFAULT_CRYPTO_CONFIG } from "./types"

// Convenience factory function
import { CryptoService } from "./encryption"
import type { CryptoConfig } from "./types"

/**
 * Create a crypto service instance with environment configuration
 *
 * @param encryptionKey - Base64 encoded 32-byte master key (from env var)
 * @param config - Optional configuration overrides
 * @returns Configured crypto service instance
 *
 * @example
 * ```typescript
 * import { createCryptoService } from '@repo/crypto'
 *
 * const crypto = createCryptoService(process.env.ENCRYPTION_KEY!)
 *
 * // Hash a user password
 * const hashedPassword = await crypto.hashPassword('userPassword123')
 *
 * // Encrypt RCON password
 * const encryptedRcon = await crypto.encrypt('rconPassword456')
 * ```
 */
export function createCryptoService(
  encryptionKey?: string,
  config?: Partial<CryptoConfig>,
): CryptoService {
  const key = encryptionKey || process.env.ENCRYPTION_KEY

  if (!key) {
    throw new Error(
      "Encryption key is required. Set ENCRYPTION_KEY environment variable or pass key directly.",
    )
  }

  return new CryptoService(key, config)
}

/**
 * Create a crypto service instance for testing with a default key
 * Only use this in test environments
 */
export function createTestCryptoService(config?: Partial<CryptoConfig>): CryptoService {
  // Use a fixed test key for deterministic testing
  const testKey = Buffer.from("test-key-for-unit-testing-only-32b").toString("base64")
  return new CryptoService(testKey, config)
}

/**
 * Default crypto service instance using environment variables
 * Only available when ENCRYPTION_KEY is set
 *
 * @example
 * ```typescript
 * import { cryptoService } from '@repo/crypto'
 *
 * // Uses process.env.ENCRYPTION_KEY automatically
 * const hashedPassword = await cryptoService.hashPassword('password')
 * ```
 */
export const cryptoService = process.env.ENCRYPTION_KEY ? createCryptoService() : null
