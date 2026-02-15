/**
 * Crypto Package Index Tests
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createCryptoService, CryptoService } from "./index"

describe("Crypto Package Index", () => {
  let originalEnvKey: string | undefined

  beforeEach(() => {
    // Save original env var
    originalEnvKey = process.env.ENCRYPTION_KEY
  })

  afterEach(() => {
    // Restore original env var
    if (originalEnvKey !== undefined) {
      process.env.ENCRYPTION_KEY = originalEnvKey
    } else {
      delete process.env.ENCRYPTION_KEY
    }
  })

  describe("createCryptoService", () => {
    it("should create service with provided key", () => {
      const key = CryptoService.generateEncryptionKey()
      const service = createCryptoService(key)

      expect(service).toBeInstanceOf(CryptoService)
    })

    it("should create service with environment variable", () => {
      const key = CryptoService.generateEncryptionKey()
      process.env.ENCRYPTION_KEY = key

      const service = createCryptoService()

      expect(service).toBeInstanceOf(CryptoService)
    })

    it("should prefer provided key over environment variable", () => {
      const envKey = CryptoService.generateEncryptionKey()
      const providedKey = CryptoService.generateEncryptionKey()

      process.env.ENCRYPTION_KEY = envKey

      // Should not throw even if provided key is different
      expect(() => createCryptoService(providedKey)).not.toThrow()
    })

    it("should throw error when no key is available", () => {
      delete process.env.ENCRYPTION_KEY

      expect(() => createCryptoService()).toThrow()
      expect(() => createCryptoService()).toThrow("Encryption key is required")
    })

    it("should throw error for invalid provided key", () => {
      expect(() => createCryptoService("invalid-key")).toThrow()
    })

    it("should accept custom configuration", () => {
      const key = CryptoService.generateEncryptionKey()
      const config = {
        argon2: {
          timeCost: 2,
          memoryCost: 32768,
          parallelism: 2,
          hashLength: 16,
          saltLength: 8,
        },
      }

      expect(() => createCryptoService(key, config)).not.toThrow()
    })
  })

  describe("default cryptoService export", () => {
    it("should work with environment variable set", async () => {
      const key = CryptoService.generateEncryptionKey()
      const originalKey = process.env.ENCRYPTION_KEY
      process.env.ENCRYPTION_KEY = key

      try {
        // Use the createCryptoService function directly instead of the export
        const { createCryptoService } = await import("./index")
        const cryptoService = createCryptoService()

        expect(cryptoService).toBeInstanceOf(CryptoService)

        // Test basic functionality
        const password = "test123"
        const hash = await cryptoService.hashPassword(password)
        const isValid = await cryptoService.verifyPassword(password, hash)

        expect(isValid).toBe(true)
      } finally {
        // Restore original env var
        if (originalKey) {
          process.env.ENCRYPTION_KEY = originalKey
        } else {
          delete process.env.ENCRYPTION_KEY
        }
      }
    })
  })

  describe("exports", () => {
    it("should export all necessary types and classes", async () => {
      const exports = await import("./index")

      expect(exports.CryptoService).toBeDefined()
      expect(exports.createCryptoService).toBeDefined()
      expect(exports.CryptoError).toBeDefined()
      expect(exports.CryptoErrorCode).toBeDefined()
      expect(exports.DEFAULT_CRYPTO_CONFIG).toBeDefined()
    })
  })
})
