/**
 * Crypto Service Types
 */

/**
 * Two-way encryption for secrets that must be read back, such as RCON
 * passwords stored at rest. User passwords are hashed by Better Auth, not here.
 */
export interface ICryptoService {
  /**
   * Encrypt sensitive data using AES-256-GCM
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
  ENCRYPTION_FAILED = "ENCRYPTION_FAILED",
  DECRYPTION_FAILED = "DECRYPTION_FAILED",
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
