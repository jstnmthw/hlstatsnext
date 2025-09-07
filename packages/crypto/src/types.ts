/**
 * Crypto Service Types
 *
 * Type definitions for the unified password encryption service
 * supporting both user authentication and RCON password encryption.
 */

/**
 * Main crypto service interface
 */
export interface ICryptoService {
  /**
   * Hash a user password using Argon2id (one-way)
   * @param password - Plain text password to hash
   * @returns Promise<string> - Argon2id hash string
   */
  hashPassword(password: string): Promise<string>

  /**
   * Verify a user password against its hash
   * @param password - Plain text password to verify
   * @param hash - Stored Argon2id hash to verify against
   * @returns Promise<boolean> - True if password matches hash
   */
  verifyPassword(password: string, hash: string): Promise<boolean>

  /**
   * Encrypt sensitive data (like RCON passwords) using AES-256-GCM (two-way)
   * @param plaintext - Plain text data to encrypt
   * @returns Promise<string> - Base64 encoded encrypted data with IV and auth tag
   */
  encrypt(plaintext: string): Promise<string>

  /**
   * Decrypt sensitive data using AES-256-GCM
   * @param ciphertext - Base64 encoded encrypted data with IV and auth tag
   * @returns Promise<string> - Decrypted plain text data
   */
  decrypt(ciphertext: string): Promise<string>
}

/**
 * Configuration options for the crypto service
 */
export interface CryptoConfig {
  /**
   * Base64 encoded master key (32 bytes)
   * Used for both Argon2 salt derivation and AES key derivation
   */
  encryptionKey: string

  /**
   * Argon2 configuration options
   */
  argon2: {
    /**
     * Time cost parameter (iterations)
     * @default 3
     */
    timeCost: number

    /**
     * Memory cost parameter in KB
     * @default 65536 (64MB)
     */
    memoryCost: number

    /**
     * Parallelism parameter
     * @default 4
     */
    parallelism: number

    /**
     * Hash length in bytes
     * @default 32
     */
    hashLength: number

    /**
     * Salt length in bytes
     * @default 16
     */
    saltLength: number
  }
}

/**
 * Default crypto service configuration
 */
export const DEFAULT_CRYPTO_CONFIG: Omit<CryptoConfig, "encryptionKey"> = {
  argon2: {
    timeCost: 3,
    memoryCost: 65536, // 64MB
    parallelism: 4,
    hashLength: 32,
    saltLength: 16,
  },
}

/**
 * Crypto service errors
 */
export class CryptoError extends Error {
  constructor(
    message: string,
    public readonly code: CryptoErrorCode,
    public readonly originalError?: unknown,
  ) {
    super(message)
    this.name = "CryptoError"
  }
}

export enum CryptoErrorCode {
  INVALID_CONFIGURATION = "INVALID_CONFIGURATION",
  ENCRYPTION_FAILED = "ENCRYPTION_FAILED",
  DECRYPTION_FAILED = "DECRYPTION_FAILED",
  HASH_FAILED = "HASH_FAILED",
  VERIFICATION_FAILED = "VERIFICATION_FAILED",
  INVALID_INPUT = "INVALID_INPUT",
  INVALID_KEY = "INVALID_KEY",
}

/**
 * Encrypted data structure for AES-256-GCM
 */
export interface EncryptedData {
  /**
   * Initialization vector (12 bytes for GCM)
   */
  iv: string

  /**
   * Encrypted data
   */
  data: string

  /**
   * Authentication tag (16 bytes for GCM)
   */
  authTag: string

  /**
   * Algorithm identifier for future extensibility
   */
  algorithm: "aes-256-gcm"
}
