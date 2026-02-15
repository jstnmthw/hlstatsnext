/**
 * Validator Tests
 *
 * Tests for validation utilities.
 */

import { describe, expect, it } from "vitest"
import { isValidAddress, validateAddress } from "./address-validator"
import { isValidGameCode, validateGameCode } from "./game-code-validator"
import { isValidPort, validatePort } from "./port-validator"

describe("Address Validator", () => {
  describe("validateAddress", () => {
    it("should accept valid IPv4 addresses", () => {
      expect(() => validateAddress("192.168.1.1")).not.toThrow()
      expect(() => validateAddress("10.0.0.1")).not.toThrow()
      expect(() => validateAddress("127.0.0.1")).not.toThrow()
      expect(() => validateAddress("255.255.255.255")).not.toThrow()
    })

    it("should accept valid IPv4 addresses with port", () => {
      expect(() => validateAddress("192.168.1.1:27015")).not.toThrow()
      expect(() => validateAddress("10.0.0.1:8080")).not.toThrow()
    })

    it("should reject empty addresses", () => {
      expect(() => validateAddress("")).toThrow("Address must be a non-empty string")
      expect(() => validateAddress("   ")).toThrow("Address must be a non-empty string")
    })

    it("should reject non-string addresses", () => {
      expect(() => validateAddress(null as unknown as string)).toThrow(
        "Address must be a non-empty string",
      )
      expect(() => validateAddress(undefined as unknown as string)).toThrow(
        "Address must be a non-empty string",
      )
    })

    it("should reject invalid IP formats", () => {
      expect(() => validateAddress("999.999.999.999")).toThrow("Invalid IP address format")
      expect(() => validateAddress("invalid")).toThrow("Invalid IP address format")
      expect(() => validateAddress("1.2.3")).toThrow("Invalid IP address format")
    })
  })

  describe("isValidAddress", () => {
    it("should return true for valid addresses", () => {
      expect(isValidAddress("192.168.1.1")).toBe(true)
      expect(isValidAddress("10.0.0.1:27015")).toBe(true)
    })

    it("should return false for invalid addresses", () => {
      expect(isValidAddress("")).toBe(false)
      expect(isValidAddress("invalid")).toBe(false)
      expect(isValidAddress("999.999.999.999")).toBe(false)
    })
  })
})

describe("Port Validator", () => {
  describe("validatePort", () => {
    it("should accept valid ports", () => {
      expect(() => validatePort(1)).not.toThrow()
      expect(() => validatePort(80)).not.toThrow()
      expect(() => validatePort(443)).not.toThrow()
      expect(() => validatePort(27015)).not.toThrow()
      expect(() => validatePort(65535)).not.toThrow()
    })

    it("should reject port 0", () => {
      expect(() => validatePort(0)).toThrow("Port must be an integer between 1 and 65535")
    })

    it("should reject negative ports", () => {
      expect(() => validatePort(-1)).toThrow("Port must be an integer between 1 and 65535")
      expect(() => validatePort(-100)).toThrow("Port must be an integer between 1 and 65535")
    })

    it("should reject ports above 65535", () => {
      expect(() => validatePort(65536)).toThrow("Port must be an integer between 1 and 65535")
      expect(() => validatePort(100000)).toThrow("Port must be an integer between 1 and 65535")
    })

    it("should reject non-integer ports", () => {
      expect(() => validatePort(3.14)).toThrow("Port must be an integer between 1 and 65535")
      expect(() => validatePort(NaN)).toThrow("Port must be an integer between 1 and 65535")
    })
  })

  describe("isValidPort", () => {
    it("should return true for valid ports", () => {
      expect(isValidPort(1)).toBe(true)
      expect(isValidPort(27015)).toBe(true)
      expect(isValidPort(65535)).toBe(true)
    })

    it("should return false for invalid ports", () => {
      expect(isValidPort(0)).toBe(false)
      expect(isValidPort(-1)).toBe(false)
      expect(isValidPort(65536)).toBe(false)
      expect(isValidPort(3.14)).toBe(false)
    })
  })
})

describe("Game Code Validator", () => {
  describe("validateGameCode", () => {
    it("should accept valid game codes", () => {
      expect(() => validateGameCode("cstrike")).not.toThrow()
      expect(() => validateGameCode("tf")).not.toThrow()
      expect(() => validateGameCode("dod")).not.toThrow()
      expect(() => validateGameCode("csgo")).not.toThrow()
      expect(() => validateGameCode("valve")).not.toThrow()
      expect(() => validateGameCode("cs2")).not.toThrow()
    })

    it("should accept game codes with underscores", () => {
      expect(() => validateGameCode("half_life")).not.toThrow()
      expect(() => validateGameCode("counter_strike")).not.toThrow()
    })

    it("should accept game codes with numbers", () => {
      expect(() => validateGameCode("cs2")).not.toThrow()
      expect(() => validateGameCode("hl2")).not.toThrow()
    })

    it("should reject empty game codes", () => {
      expect(() => validateGameCode("")).toThrow("Game code must be a non-empty string")
      expect(() => validateGameCode("   ")).toThrow("Game code must be a non-empty string")
    })

    it("should reject non-string game codes", () => {
      expect(() => validateGameCode(null as unknown as string)).toThrow(
        "Game code must be a non-empty string",
      )
      expect(() => validateGameCode(undefined as unknown as string)).toThrow(
        "Game code must be a non-empty string",
      )
    })

    it("should reject game codes with special characters", () => {
      expect(() => validateGameCode("cs-go")).toThrow("Invalid game code format")
      expect(() => validateGameCode("cs.go")).toThrow("Invalid game code format")
      expect(() => validateGameCode("cs go")).toThrow("Invalid game code format")
      expect(() => validateGameCode("cs@go")).toThrow("Invalid game code format")
    })
  })

  describe("isValidGameCode", () => {
    it("should return true for valid game codes", () => {
      expect(isValidGameCode("cstrike")).toBe(true)
      expect(isValidGameCode("tf")).toBe(true)
      expect(isValidGameCode("half_life")).toBe(true)
    })

    it("should return false for invalid game codes", () => {
      expect(isValidGameCode("")).toBe(false)
      expect(isValidGameCode("cs-go")).toBe(false)
      expect(isValidGameCode("cs go")).toBe(false)
    })
  })
})
