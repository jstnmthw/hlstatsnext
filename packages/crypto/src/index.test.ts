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

    it("should round-trip a secret with the key from the environment", async () => {
      process.env.ENCRYPTION_KEY = CryptoService.generateEncryptionKey()

      const service = createCryptoService()
      const ciphertext = await service.encrypt("rcon-password")

      expect(ciphertext).not.toBe("rcon-password")
      expect(await service.decrypt(ciphertext)).toBe("rcon-password")
    })
  })

  describe("exports", () => {
    it("should export all necessary types and classes", async () => {
      const exports = await import("./index.js")

      expect(exports.CryptoService).toBeDefined()
      expect(exports.createCryptoService).toBeDefined()
      expect(exports.CryptoError).toBeDefined()
      expect(exports.CryptoErrorCode).toBeDefined()
      expect(exports.generateToken).toBeDefined()
      expect(exports.hashToken).toBeDefined()
    })
  })
})
