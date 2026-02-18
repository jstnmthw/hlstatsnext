import { describe, expect, it } from "vitest"
import {
  extractTokenPrefix,
  generateToken,
  hashToken,
  isValidTokenFormat,
  TOKEN_CONSTANTS,
} from "./token"

describe("token utilities", () => {
  describe("generateToken", () => {
    it("should generate a token with the correct prefix", () => {
      const { raw } = generateToken()
      expect(raw).toMatch(/^hlxn_/)
    })

    it("should generate a token with the correct length", () => {
      const { raw } = generateToken()
      expect(raw.length).toBe(TOKEN_CONSTANTS.EXPECTED_LENGTH) // 48 chars
    })

    it("should generate unique tokens", () => {
      const tokens = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const { raw } = generateToken()
        expect(tokens.has(raw)).toBe(false)
        tokens.add(raw)
      }
    })

    it("should generate a valid SHA-256 hash (64 hex chars)", () => {
      const { hash } = generateToken()
      expect(hash.length).toBe(64)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it("should generate a display prefix of correct length", () => {
      const { prefix } = generateToken()
      // "hlxn_" (5) + 8 display chars = 13
      expect(prefix.length).toBe(
        TOKEN_CONSTANTS.PREFIX.length + TOKEN_CONSTANTS.DISPLAY_PREFIX_LENGTH,
      )
      expect(prefix).toMatch(/^hlxn_[A-Za-z0-9_-]{8}$/)
    })
  })

  describe("hashToken", () => {
    it("should produce consistent hashes for the same input", () => {
      const token = "hlxn_testtoken123456789012345678901234567890"
      const hash1 = hashToken(token)
      const hash2 = hashToken(token)
      expect(hash1).toBe(hash2)
    })

    it("should produce different hashes for different inputs", () => {
      const hash1 = hashToken("hlxn_token1234567890123456789012345678901234")
      const hash2 = hashToken("hlxn_token1234567890123456789012345678901235")
      expect(hash1).not.toBe(hash2)
    })

    it("should produce a 64-character lowercase hex string", () => {
      const hash = hashToken("test")
      expect(hash.length).toBe(64)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it("should match known SHA-256 output", () => {
      // SHA-256 of "test" is known
      const hash = hashToken("test")
      expect(hash).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
    })
  })

  describe("isValidTokenFormat", () => {
    it("should accept valid tokens", () => {
      // Generate a real token and verify it passes validation
      const { raw } = generateToken()
      expect(isValidTokenFormat(raw)).toBe(true)
    })

    it("should reject tokens without the correct prefix", () => {
      expect(isValidTokenFormat("wrongprefix_K7gNU3sdo-OL0wNhv0-ATkGjQL1qOlRhsGAhK7eo-Xc")).toBe(
        false,
      )
    })

    it("should reject tokens that are too short", () => {
      expect(isValidTokenFormat("hlxn_tooshort")).toBe(false)
    })

    it("should reject tokens that are too long", () => {
      expect(isValidTokenFormat("hlxn_K7gNU3sdo-OL0wNhv0-ATkGjQL1qOlRhsGAhK7eo-XcXXX")).toBe(false)
    })

    it("should reject empty strings", () => {
      expect(isValidTokenFormat("")).toBe(false)
    })

    it("should reject non-string inputs", () => {
      // @ts-expect-error Testing invalid input
      expect(isValidTokenFormat(null)).toBe(false)
      // @ts-expect-error Testing invalid input
      expect(isValidTokenFormat(undefined)).toBe(false)
      // @ts-expect-error Testing invalid input
      expect(isValidTokenFormat(12345)).toBe(false)
    })
  })

  describe("extractTokenPrefix", () => {
    it("should extract the display prefix from a raw token", () => {
      // Create a known token
      const raw = "hlxn_K7gNU3sdo-OL0wNhv0-ATkGjQL1qOlRhsGAhK7eo-Xc"
      const prefix = extractTokenPrefix(raw)
      expect(prefix).toBe("hlxn_K7gNU3sd")
    })

    it("should extract prefix from generated tokens", () => {
      const { raw, prefix } = generateToken()
      expect(extractTokenPrefix(raw)).toBe(prefix)
    })
  })

  describe("TOKEN_CONSTANTS", () => {
    it("should have correct prefix", () => {
      expect(TOKEN_CONSTANTS.PREFIX).toBe("hlxn_")
    })

    it("should have correct byte length (256-bit security)", () => {
      expect(TOKEN_CONSTANTS.BYTE_LENGTH).toBe(32)
    })

    it("should have correct display prefix length", () => {
      expect(TOKEN_CONSTANTS.DISPLAY_PREFIX_LENGTH).toBe(8)
    })

    it("should have correct expected total length", () => {
      // prefix (5) + base64url of 32 bytes (43) = 48
      expect(TOKEN_CONSTANTS.EXPECTED_LENGTH).toBe(48)
    })
  })
})
