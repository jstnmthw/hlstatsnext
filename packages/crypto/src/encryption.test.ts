/**
 * Crypto Service Unit Tests
 */

import { beforeEach, describe, expect, it } from "vitest"
import { CryptoService } from "./encryption"
import { CryptoError, CryptoErrorCode } from "./types"

describe("CryptoService", () => {
  let cryptoService: CryptoService
  let testEncryptionKey: string

  beforeEach(() => {
    // Generate a fresh test key for each test
    testEncryptionKey = CryptoService.generateEncryptionKey()
    cryptoService = new CryptoService(testEncryptionKey)
  })

  describe("constructor", () => {
    it("should create service with valid encryption key", () => {
      expect(() => new CryptoService(testEncryptionKey)).not.toThrow()
    })

    it("should throw error with invalid encryption key", () => {
      expect(() => new CryptoService("invalid-key")).toThrow(CryptoError)
      expect(() => new CryptoService("invalid-key")).toThrow("Encryption key must be 32 bytes")
    })

    it("should throw error with wrong key length", () => {
      const shortKey = Buffer.from("too-short").toString("base64")
      expect(() => new CryptoService(shortKey)).toThrow(CryptoError)
      expect(() => new CryptoService(shortKey)).toThrow("Encryption key must be 32 bytes")
    })

    it("should accept custom configuration", () => {
      const config = {
        argon2: {
          timeCost: 2,
          memoryCost: 32768,
          parallelism: 2,
          hashLength: 16,
          saltLength: 8,
        },
      }

      expect(() => new CryptoService(testEncryptionKey, config)).not.toThrow()
    })
  })

  describe("password hashing", () => {
    describe("hashPassword", () => {
      it("should hash a password successfully", async () => {
        const password = "testPassword123"
        const hash = await cryptoService.hashPassword(password)

        expect(hash).toBeDefined()
        expect(typeof hash).toBe("string")
        expect(hash.length).toBeGreaterThan(50) // Argon2 hashes are long
        expect(hash.startsWith("$argon2id$")).toBe(true)
      })

      it("should generate different hashes for same password", async () => {
        const password = "testPassword123"
        const hash1 = await cryptoService.hashPassword(password)
        const hash2 = await cryptoService.hashPassword(password)

        expect(hash1).not.toBe(hash2) // Different salts should produce different hashes
      })

      it("should throw error for empty password", async () => {
        await expect(cryptoService.hashPassword("")).rejects.toThrow(CryptoError)
        await expect(cryptoService.hashPassword("")).rejects.toThrow("non-empty string")
      })

      it("should throw error for non-string password", async () => {
        // @ts-expect-error - Testing invalid input
        await expect(cryptoService.hashPassword(null)).rejects.toThrow(CryptoError)
        // @ts-expect-error - Testing invalid input
        await expect(cryptoService.hashPassword(undefined)).rejects.toThrow(CryptoError)
        // @ts-expect-error - Testing invalid input
        await expect(cryptoService.hashPassword(123)).rejects.toThrow(CryptoError)
      })
    })

    describe("verifyPassword", () => {
      it("should verify correct password", async () => {
        const password = "testPassword123"
        const hash = await cryptoService.hashPassword(password)

        const isValid = await cryptoService.verifyPassword(password, hash)
        expect(isValid).toBe(true)
      })

      it("should reject incorrect password", async () => {
        const password = "testPassword123"
        const wrongPassword = "wrongPassword456"
        const hash = await cryptoService.hashPassword(password)

        const isValid = await cryptoService.verifyPassword(wrongPassword, hash)
        expect(isValid).toBe(false)
      })

      it("should handle case-sensitive passwords", async () => {
        const password = "TestPassword123"
        const hash = await cryptoService.hashPassword(password)

        const isValid1 = await cryptoService.verifyPassword(password, hash)
        const isValid2 = await cryptoService.verifyPassword("testpassword123", hash)

        expect(isValid1).toBe(true)
        expect(isValid2).toBe(false)
      })

      it("should throw error for invalid inputs", async () => {
        const hash = await cryptoService.hashPassword("test")

        // @ts-expect-error - Testing invalid input
        await expect(cryptoService.verifyPassword(null, hash)).rejects.toThrow(CryptoError)
        // @ts-expect-error - Testing invalid input
        await expect(cryptoService.verifyPassword("test", null)).rejects.toThrow(CryptoError)
        await expect(cryptoService.verifyPassword("", hash)).rejects.toThrow(CryptoError)
        await expect(cryptoService.verifyPassword("test", "")).rejects.toThrow(CryptoError)
      })
    })
  })

  describe("encryption/decryption", () => {
    describe("encrypt", () => {
      it("should encrypt plaintext successfully", async () => {
        const plaintext = "sensitive-rcon-password-123"
        const ciphertext = await cryptoService.encrypt(plaintext)

        expect(ciphertext).toBeDefined()
        expect(typeof ciphertext).toBe("string")
        expect(ciphertext).not.toBe(plaintext)
        expect(ciphertext.length).toBeGreaterThan(plaintext.length)

        // Should be valid base64
        expect(() => Buffer.from(ciphertext, "base64")).not.toThrow()
      })

      it("should generate different ciphertext for same plaintext", async () => {
        const plaintext = "sensitive-data"
        const ciphertext1 = await cryptoService.encrypt(plaintext)
        const ciphertext2 = await cryptoService.encrypt(plaintext)

        expect(ciphertext1).not.toBe(ciphertext2) // Different IVs should produce different results
      })

      it("should handle special characters and unicode", async () => {
        const plaintext = "Special chars: !@#$%^&*()_+ 中文 🚀"
        const ciphertext = await cryptoService.encrypt(plaintext)

        expect(ciphertext).toBeDefined()
        expect(typeof ciphertext).toBe("string")
      })

      it("should throw error for empty plaintext", async () => {
        await expect(cryptoService.encrypt("")).rejects.toThrow(CryptoError)
        await expect(cryptoService.encrypt("")).rejects.toThrow("non-empty string")
      })

      it("should throw error for non-string plaintext", async () => {
        // @ts-expect-error - Testing invalid input
        await expect(cryptoService.encrypt(null)).rejects.toThrow(CryptoError)
        // @ts-expect-error - Testing invalid input
        await expect(cryptoService.encrypt(undefined)).rejects.toThrow(CryptoError)
        // @ts-expect-error - Testing invalid input
        await expect(cryptoService.encrypt(123)).rejects.toThrow(CryptoError)
      })
    })

    describe("decrypt", () => {
      it("should decrypt ciphertext successfully", async () => {
        const plaintext = "sensitive-rcon-password-123"
        const ciphertext = await cryptoService.encrypt(plaintext)
        const decrypted = await cryptoService.decrypt(ciphertext)

        expect(decrypted).toBe(plaintext)
      })

      it("should handle special characters and unicode", async () => {
        const plaintext = "Special chars: !@#$%^&*()_+ 中文 🚀"
        const ciphertext = await cryptoService.encrypt(plaintext)
        const decrypted = await cryptoService.decrypt(ciphertext)

        expect(decrypted).toBe(plaintext)
      })

      it("should handle long strings", async () => {
        const plaintext = "A".repeat(1000) // 1KB string
        const ciphertext = await cryptoService.encrypt(plaintext)
        const decrypted = await cryptoService.decrypt(ciphertext)

        expect(decrypted).toBe(plaintext)
      })

      it("should throw error for tampered ciphertext", async () => {
        const plaintext = "sensitive-data"
        const ciphertext = await cryptoService.encrypt(plaintext)

        // Decode the ciphertext to tamper with the internal data
        const encryptedData = JSON.parse(Buffer.from(ciphertext, "base64").toString("utf8"))

        // Tamper with the encrypted data portion
        encryptedData.data = encryptedData.data.slice(0, -1) + "X"

        // Re-encode the tampered data
        const tamperedCiphertext = Buffer.from(JSON.stringify(encryptedData)).toString("base64")

        await expect(cryptoService.decrypt(tamperedCiphertext)).rejects.toThrow(CryptoError)
        await expect(cryptoService.decrypt(tamperedCiphertext)).rejects.toThrow("Failed to decrypt")
      })

      it("should throw error for invalid base64", async () => {
        await expect(cryptoService.decrypt("invalid-base64!")).rejects.toThrow(CryptoError)
      })

      it("should throw error for empty ciphertext", async () => {
        await expect(cryptoService.decrypt("")).rejects.toThrow(CryptoError)
        await expect(cryptoService.decrypt("")).rejects.toThrow("non-empty string")
      })

      it("should throw error for non-string ciphertext", async () => {
        // @ts-expect-error - Testing invalid input
        await expect(cryptoService.decrypt(null)).rejects.toThrow(CryptoError)
        // @ts-expect-error - Testing invalid input
        await expect(cryptoService.decrypt(undefined)).rejects.toThrow(CryptoError)
        // @ts-expect-error - Testing invalid input
        await expect(cryptoService.decrypt(123)).rejects.toThrow(CryptoError)
      })
    })

    describe("encryption compatibility", () => {
      it("should work across different service instances with same key", async () => {
        const plaintext = "cross-instance-test"

        const service1 = new CryptoService(testEncryptionKey)
        const service2 = new CryptoService(testEncryptionKey)

        const ciphertext = await service1.encrypt(plaintext)
        const decrypted = await service2.decrypt(ciphertext)

        expect(decrypted).toBe(plaintext)
      })

      it("should fail with different keys", async () => {
        const plaintext = "different-key-test"
        const key1 = CryptoService.generateEncryptionKey()
        const key2 = CryptoService.generateEncryptionKey()

        const service1 = new CryptoService(key1)
        const service2 = new CryptoService(key2)

        const ciphertext = await service1.encrypt(plaintext)

        await expect(service2.decrypt(ciphertext)).rejects.toThrow(CryptoError)
      })
    })
  })

  describe("static utility methods", () => {
    describe("generateEncryptionKey", () => {
      it("should generate valid encryption key", () => {
        const key = CryptoService.generateEncryptionKey()

        expect(key).toBeDefined()
        expect(typeof key).toBe("string")
        expect(CryptoService.isValidEncryptionKey(key)).toBe(true)
      })

      it("should generate different keys each time", () => {
        const key1 = CryptoService.generateEncryptionKey()
        const key2 = CryptoService.generateEncryptionKey()

        expect(key1).not.toBe(key2)
      })
    })

    describe("isValidEncryptionKey", () => {
      it("should validate correct key format", () => {
        const validKey = CryptoService.generateEncryptionKey()
        expect(CryptoService.isValidEncryptionKey(validKey)).toBe(true)
      })

      it("should reject invalid key formats", () => {
        expect(CryptoService.isValidEncryptionKey("")).toBe(false)
        expect(CryptoService.isValidEncryptionKey("invalid")).toBe(false)
        expect(CryptoService.isValidEncryptionKey("dGVzdA==")).toBe(false) // Only 4 bytes

        // Too long
        const tooLong = Buffer.from("a".repeat(64)).toString("base64")
        expect(CryptoService.isValidEncryptionKey(tooLong)).toBe(false)
      })
    })
  })

  describe("error handling", () => {
    it("should provide meaningful error messages", async () => {
      try {
        await cryptoService.hashPassword("")
      } catch (error) {
        expect(error).toBeInstanceOf(CryptoError)
        expect((error as CryptoError).code).toBe(CryptoErrorCode.INVALID_INPUT)
        expect((error as CryptoError).message).toContain("non-empty string")
      }
    })

    it("should preserve original errors in chain", async () => {
      try {
        await cryptoService.decrypt("invalid-data")
      } catch (error) {
        expect(error).toBeInstanceOf(CryptoError)
        expect((error as CryptoError).originalError).toBeDefined()
      }
    })
  })
})
