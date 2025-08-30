/**
 * Message Utils Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  generateMessageId,
  generateCorrelationId,
  isValidMessageId,
  isValidCorrelationId,
  extractTimestampFromMessageId,
  calculateMessageAge,
  sanitizeRoutingKey,
  calculateRetryDelay,
  addJitter,
  formatBytes,
  formatDuration,
  safeJsonStringify,
  safeJsonParse,
  setUuidService,
} from "./message-utils"
import { SystemUuidService } from "@/shared/infrastructure/identifiers/system-uuid.service"
import { systemClock } from "@/shared/infrastructure/time"

describe("Message Utils", () => {
  beforeEach(() => {
    // Initialize UUID service for all tests
    setUuidService(new SystemUuidService(systemClock))
  })

  describe("ID Generation", () => {
    it("should generate valid message IDs", () => {
      const messageId = generateMessageId()
      expect(messageId).toMatch(/^msg_[a-z0-9]+_[a-f0-9]{16}$/)
      expect(isValidMessageId(messageId)).toBe(true)
    })

    it("should generate unique message IDs", () => {
      const id1 = generateMessageId()
      const id2 = generateMessageId()
      expect(id1).not.toBe(id2)
    })

    it("should generate valid correlation IDs", () => {
      const correlationId = generateCorrelationId()
      expect(correlationId).toMatch(/^corr_[a-z0-9]+_[a-f0-9]{12}$/)
      expect(isValidCorrelationId(correlationId)).toBe(true)
    })

    it("should generate unique correlation IDs", () => {
      const id1 = generateCorrelationId()
      const id2 = generateCorrelationId()
      expect(id1).not.toBe(id2)
    })
  })

  describe("ID Validation", () => {
    it("should validate correct message ID format", () => {
      const validIds = ["msg_abc123_1234567890abcdef", "msg_z9x8y7_fedcba0987654321"]

      validIds.forEach((id) => {
        expect(isValidMessageId(id)).toBe(true)
      })
    })

    it("should reject invalid message ID formats", () => {
      const invalidIds = [
        "invalid_format",
        "msg_1234567890abc_1234567890abcdef", // timestamp too long (>12 chars)
        "msg_123_tooshort", // random part not hex
        "msg_123_1234567890ABCDEF", // uppercase
        "",
        "msg__1234567890abcdef", // empty timestamp
        "msg_123_", // empty random
      ]

      invalidIds.forEach((id) => {
        expect(isValidMessageId(id)).toBe(false)
      })
    })

    it("should validate correct correlation ID format", () => {
      const validIds = ["corr_abc123_123456789abc", "corr_z9x8y7_fedcba098765"]

      validIds.forEach((id) => {
        expect(isValidCorrelationId(id)).toBe(true)
      })
    })

    it("should reject invalid correlation ID formats", () => {
      const invalidIds = [
        "invalid_format",
        "corr_123_tooshort",
        "corr_123_123456789ABCD", // uppercase
        "",
        "corr__123456789abc", // empty timestamp
        "corr_123_", // empty random
      ]

      invalidIds.forEach((id) => {
        expect(isValidCorrelationId(id)).toBe(false)
      })
    })
  })

  describe("Timestamp Extraction", () => {
    it("should extract timestamp from valid message ID", () => {
      const now = Date.now()
      const timestamp = now.toString(36)
      const messageId = `msg_${timestamp}_1234567890abcdef`

      const extracted = extractTimestampFromMessageId(messageId)
      expect(extracted).toBe(now)
    })

    it("should return null for invalid message ID", () => {
      const invalidIds = ["invalid_format", "msg_invalid_timestamp_abc", ""]

      invalidIds.forEach((id) => {
        expect(extractTimestampFromMessageId(id)).toBeNull()
      })
    })

    it("should calculate message age", () => {
      const pastTime = Date.now() - 5000 // 5 seconds ago
      const timestamp = pastTime.toString(36)
      const messageId = `msg_${timestamp}_1234567890abcdef`

      const age = calculateMessageAge(messageId)
      expect(age).toBeGreaterThan(4000) // At least 4 seconds
      expect(age).toBeLessThan(6000) // Less than 6 seconds
    })

    it("should return null for invalid message ID when calculating age", () => {
      expect(calculateMessageAge("invalid_id")).toBeNull()
    })
  })

  describe("Routing Key Sanitization", () => {
    it("should sanitize routing keys correctly", () => {
      const testCases = [
        { input: "player.kill", expected: "player.kill" },
        { input: "PLAYER.KILL", expected: "player.kill" },
        { input: "player..kill", expected: "player.kill" },
        { input: ".player.kill.", expected: "player.kill" },
        { input: "player@kill#event", expected: "player.kill.event" },
        { input: "player-kill_event", expected: "player.kill.event" },
        { input: "player.*", expected: "player.*" },
        { input: "player.#", expected: "player.#" },
      ]

      testCases.forEach(({ input, expected }) => {
        expect(sanitizeRoutingKey(input)).toBe(expected)
      })
    })

    it("should handle empty and whitespace strings", () => {
      expect(sanitizeRoutingKey("")).toBe("")
      expect(sanitizeRoutingKey("   ")).toBe("")
      expect(sanitizeRoutingKey("...")).toBe("")
    })
  })

  describe("Retry Logic", () => {
    it("should calculate exponential backoff delays", () => {
      const baseDelay = 1000
      const maxDelay = 30000

      expect(calculateRetryDelay(0, baseDelay, maxDelay)).toBe(1000)
      expect(calculateRetryDelay(1, baseDelay, maxDelay)).toBe(2000)
      expect(calculateRetryDelay(2, baseDelay, maxDelay)).toBe(4000)
      expect(calculateRetryDelay(3, baseDelay, maxDelay)).toBe(8000)
      expect(calculateRetryDelay(4, baseDelay, maxDelay)).toBe(16000)
      expect(calculateRetryDelay(5, baseDelay, maxDelay)).toBe(30000) // Capped at maxDelay
      expect(calculateRetryDelay(10, baseDelay, maxDelay)).toBe(30000) // Still capped
    })

    it("should use default values for retry delay", () => {
      expect(calculateRetryDelay(0)).toBe(1000)
      expect(calculateRetryDelay(1)).toBe(2000)
      expect(calculateRetryDelay(10)).toBe(30000) // Capped at default maxDelay
    })

    it("should add jitter to delays", () => {
      const delay = 1000
      const jitterFactor = 0.1

      // Mock Math.random to return a predictable value
      const originalRandom = Math.random
      vi.spyOn(Math, "random").mockReturnValue(0.5)

      const jitteredDelay = addJitter(delay, jitterFactor)
      expect(jitteredDelay).toBe(1050) // 1000 + (1000 * 0.1 * 0.5)

      // Test with default jitter factor
      const defaultJitteredDelay = addJitter(delay)
      expect(defaultJitteredDelay).toBe(1050) // Same result with default 0.1

      Math.random = originalRandom
    })

    it("should handle zero delay with jitter", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5)
      expect(addJitter(0)).toBe(0)
    })
  })

  describe("Formatting", () => {
    it("should format bytes correctly", () => {
      const testCases = [
        { input: 0, expected: "0 B" },
        { input: 512, expected: "512 B" },
        { input: 1024, expected: "1 KB" },
        { input: 1536, expected: "1.5 KB" },
        { input: 1048576, expected: "1 MB" },
        { input: 1073741824, expected: "1 GB" },
        { input: 1536000, expected: "1.46 MB" },
      ]

      testCases.forEach(({ input, expected }) => {
        expect(formatBytes(input)).toBe(expected)
      })
    })

    it("should format duration correctly", () => {
      const testCases = [
        { input: 500, expected: "500ms" },
        { input: 1500, expected: "1.5s" },
        { input: 30000, expected: "30.0s" },
        { input: 90000, expected: "1.5m" },
        { input: 3600000, expected: "60.0m" },
        { input: 7200000, expected: "2.0h" },
      ]

      testCases.forEach(({ input, expected }) => {
        expect(formatDuration(input)).toBe(expected)
      })
    })
  })

  describe("JSON Utilities", () => {
    it("should safely stringify valid objects", () => {
      const obj = { name: "test", value: 42 }
      const result = safeJsonStringify(obj)
      expect(result).toBe('{"name":"test","value":42}')
    })

    it("should handle circular references in stringify", () => {
      const obj: Record<string, unknown> = { name: "test" }
      obj.self = obj // Create circular reference

      const result = safeJsonStringify(obj)
      const parsed = JSON.parse(result)
      expect(parsed.error).toBe("Failed to serialize object")
      expect(parsed.message).toBeDefined()
    })

    it("should safely parse valid JSON", () => {
      const json = '{"name":"test","value":42}'
      const result = safeJsonParse(json)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ name: "test", value: 42 })
      }
    })

    it("should handle invalid JSON in parse", () => {
      const invalidJson = '{"name":"test",invalid}'
      const result = safeJsonParse(invalidJson)

      expect(result.success).toBe(false)
      if (!result.success) {
        // Accept both old and new error message formats
        expect(result.error).toMatch(/Unexpected token|Expected .* property name/)
      }
    })

    it("should parse with type parameter", () => {
      interface TestType {
        name: string
        value: number
      }

      const json = '{"name":"test","value":42}'
      const result = safeJsonParse<TestType>(json)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe("test")
        expect(result.data.value).toBe(42)
      }
    })

    it("should handle empty string in parse", () => {
      const result = safeJsonParse("")

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain("Unexpected end")
      }
    })
  })

  describe("Edge Cases", () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it("should handle errors in timestamp extraction", () => {
      // Create a message ID that would cause parseInt to fail
      const messageId = "msg_" + "z".repeat(20) + "_1234567890abcdef"
      const timestamp = extractTimestampFromMessageId(messageId)
      expect(timestamp).toBeNull()
    })

    it("should handle extreme values in retry delay calculation", () => {
      expect(calculateRetryDelay(-1)).toBe(500) // 1000 * 2^(-1) = 500
      expect(calculateRetryDelay(100, 1000, 5000)).toBe(5000) // Capped at maxDelay
    })

    it("should handle negative values in formatting", () => {
      expect(formatBytes(-100)).toBe("-100 B")
      expect(formatDuration(-1000)).toBe("-1000ms")
    })

    it("should handle very large numbers in formatting", () => {
      const largeBytes = 1024 * 1024 * 1024 * 1024 // 1TB
      const result = formatBytes(largeBytes)
      expect(result).toContain("TB") // Should correctly show as TB
    })
  })
})
