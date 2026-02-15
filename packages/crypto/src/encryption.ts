/**
 * Crypto Service Implementation
 *
 * Unified encryption service for both user passwords and RCON passwords.
 * Uses Argon2id for password hashing and AES-256-GCM for encryption.
 */

import { hash, verify } from "argon2"
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "crypto"
import type { CryptoConfig, EncryptedData, ICryptoService } from "./types"
import {
  CryptoError as CryptoErrorClass,
  DEFAULT_CRYPTO_CONFIG,
  CryptoErrorCode as ErrorCodes,
} from "./types"

export class CryptoService implements ICryptoService {
  private readonly config: CryptoConfig
  private readonly masterKey: Buffer

  constructor(encryptionKey: string, config?: Partial<CryptoConfig>) {
    // Validate and decode the encryption key
    try {
      this.masterKey = Buffer.from(encryptionKey, "base64")
      if (this.masterKey.length !== 32) {
        throw new CryptoErrorClass(
          "Encryption key must be 32 bytes (256 bits)",
          ErrorCodes.INVALID_KEY,
        )
      }
    } catch (error) {
      if (error instanceof CryptoErrorClass) {
        throw error
      }
      throw new CryptoErrorClass(
        "Invalid encryption key format. Expected base64-encoded 32-byte key.",
        ErrorCodes.INVALID_KEY,
        error,
      )
    }

    // Merge with default config
    this.config = {
      encryptionKey,
      argon2: {
        ...DEFAULT_CRYPTO_CONFIG.argon2,
        ...config?.argon2,
      },
    }
  }

  /**
   * Hash a password using Argon2id
   */
  async hashPassword(password: string): Promise<string> {
    if (!password || typeof password !== "string") {
      throw new CryptoErrorClass("Password must be a non-empty string", ErrorCodes.INVALID_INPUT)
    }

    try {
      // Generate a unique salt using the master key as additional entropy
      const salt = randomBytes(this.config.argon2.saltLength)

      // Derive salt using master key to ensure uniqueness across instances
      const derivedSalt = pbkdf2Sync(
        salt,
        this.masterKey,
        1000,
        this.config.argon2.saltLength,
        "sha256",
      )

      const hashedPassword = await hash(password, {
        type: 2, // Argon2id
        memoryCost: this.config.argon2.memoryCost,
        timeCost: this.config.argon2.timeCost,
        parallelism: this.config.argon2.parallelism,
        hashLength: this.config.argon2.hashLength,
        salt: derivedSalt,
      })

      return hashedPassword
    } catch (error) {
      throw new CryptoErrorClass("Failed to hash password", ErrorCodes.HASH_FAILED, error)
    }
  }

  /**
   * Verify a password against its Argon2id hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!password || typeof password !== "string") {
      throw new CryptoErrorClass("Password must be a non-empty string", ErrorCodes.INVALID_INPUT)
    }

    if (!hash || typeof hash !== "string") {
      throw new CryptoErrorClass("Hash must be a non-empty string", ErrorCodes.INVALID_INPUT)
    }

    try {
      return await verify(hash, password)
    } catch (error) {
      throw new CryptoErrorClass("Failed to verify password", ErrorCodes.VERIFICATION_FAILED, error)
    }
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  async encrypt(plaintext: string): Promise<string> {
    if (!plaintext || typeof plaintext !== "string") {
      throw new CryptoErrorClass("Plaintext must be a non-empty string", ErrorCodes.INVALID_INPUT)
    }

    try {
      // Generate random IV (12 bytes for GCM)
      const iv = randomBytes(12)

      // Derive encryption key from master key
      const encryptionKey = pbkdf2Sync(this.masterKey, "aes-encryption", 10000, 32, "sha256")

      // Create cipher
      const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv)

      // Encrypt the data
      let encrypted = cipher.update(plaintext, "utf8", "base64")
      encrypted += cipher.final("base64")

      // Get the authentication tag
      const authTag = cipher.getAuthTag()

      // Create the encrypted data structure
      const encryptedData: EncryptedData = {
        algorithm: "aes-256-gcm",
        iv: iv.toString("base64"),
        data: encrypted,
        authTag: authTag.toString("base64"),
      }

      // Return as JSON string encoded in base64
      return Buffer.from(JSON.stringify(encryptedData)).toString("base64")
    } catch (error) {
      throw new CryptoErrorClass("Failed to encrypt data", ErrorCodes.ENCRYPTION_FAILED, error)
    }
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   */
  async decrypt(ciphertext: string): Promise<string> {
    if (!ciphertext || typeof ciphertext !== "string") {
      throw new CryptoErrorClass("Ciphertext must be a non-empty string", ErrorCodes.INVALID_INPUT)
    }

    try {
      // Decode the JSON structure
      const encryptedData: EncryptedData = JSON.parse(
        Buffer.from(ciphertext, "base64").toString("utf8"),
      )

      // Validate the encrypted data structure
      if (!encryptedData.algorithm || encryptedData.algorithm !== "aes-256-gcm") {
        throw new Error("Unsupported encryption algorithm")
      }

      // Extract components
      const iv = Buffer.from(encryptedData.iv, "base64")
      const authTag = Buffer.from(encryptedData.authTag, "base64")
      const encrypted = encryptedData.data

      // Derive the same encryption key
      const encryptionKey = pbkdf2Sync(this.masterKey, "aes-encryption", 10000, 32, "sha256")

      // Create decipher
      const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv)
      decipher.setAuthTag(authTag)

      // Decrypt the data
      let decrypted = decipher.update(encrypted, "base64", "utf8")
      decrypted += decipher.final("utf8")

      return decrypted
    } catch (error) {
      throw new CryptoErrorClass("Failed to decrypt data", ErrorCodes.DECRYPTION_FAILED, error)
    }
  }

  /**
   * Generate a secure random encryption key
   * Utility method for creating new master keys
   */
  static generateEncryptionKey(): string {
    return randomBytes(32).toString("base64")
  }

  /**
   * Validate an encryption key format
   */
  static isValidEncryptionKey(key: string): boolean {
    try {
      const decoded = Buffer.from(key, "base64")
      return decoded.length === 32
    } catch {
      return false
    }
  }
}
