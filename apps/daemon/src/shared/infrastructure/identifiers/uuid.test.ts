/**
 * UUID Service Tests
 *
 * Comprehensive tests for both SystemUuidService and DeterministicUuidService
 */

import { describe, it, expect, beforeEach } from "vitest"
import { SystemUuidService } from "./system-uuid.service"
import { DeterministicUuidService } from "./deterministic-uuid.service"
import { TestClock } from "../time/test-clock"
import type { IUuidService } from "./uuid.interface"
import type { IClock } from "../time/clock.interface"

describe("SystemUuidService", () => {
  let clock: IClock
  let uuidService: SystemUuidService

  beforeEach(() => {
    clock = new TestClock(new Date("2024-01-01T00:00:00.000Z"))
    uuidService = new SystemUuidService(clock)
  })

  describe("generateMessageId()", () => {
    it("should generate valid message ID format", () => {
      const messageId = uuidService.generateMessageId()

      expect(messageId).toMatch(/^msg_[a-z0-9]{6,12}_[a-f0-9]{16}$/)
      expect(uuidService.isValidMessageId(messageId)).toBe(true)
    })

    it("should generate unique message IDs", () => {
      const ids = new Set()
      for (let i = 0; i < 100; i++) {
        ids.add(uuidService.generateMessageId())
      }

      expect(ids.size).toBe(100)
    })

    it("should include timestamp component", () => {
      const messageId = uuidService.generateMessageId()
      const extractedTimestamp = uuidService.extractTimestampFromMessageId(messageId)

      expect(extractedTimestamp).toBe(clock.timestamp())
    })
  })

  describe("generateCorrelationId()", () => {
    it("should generate valid correlation ID format", () => {
      const correlationId = uuidService.generateCorrelationId()

      expect(correlationId).toMatch(/^corr_[a-z0-9]+_[a-f0-9]{12}$/)
      expect(uuidService.isValidCorrelationId(correlationId)).toBe(true)
    })

    it("should generate unique correlation IDs", () => {
      const ids = new Set()
      for (let i = 0; i < 100; i++) {
        ids.add(uuidService.generateCorrelationId())
      }

      expect(ids.size).toBe(100)
    })

    it("should include timestamp component", () => {
      const correlationId = uuidService.generateCorrelationId()

      // Should contain the base36 timestamp
      const expectedTimestamp = clock.timestamp().toString(36)
      expect(correlationId).toContain(expectedTimestamp)
    })
  })

  describe("generateUuid()", () => {
    it("should generate valid UUID v4 format", () => {
      const uuid = uuidService.generateUuid()

      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it("should generate unique UUIDs", () => {
      const uuids = new Set()
      for (let i = 0; i < 100; i++) {
        uuids.add(uuidService.generateUuid())
      }

      expect(uuids.size).toBe(100)
    })
  })

  describe("generateShortId()", () => {
    it("should generate short hex IDs", () => {
      const shortId = uuidService.generateShortId()

      expect(shortId).toMatch(/^[a-f0-9]{8}$/)
      expect(shortId.length).toBe(8)
    })

    it("should generate unique short IDs", () => {
      const ids = new Set()
      for (let i = 0; i < 100; i++) {
        ids.add(uuidService.generateShortId())
      }

      expect(ids.size).toBe(100)
    })
  })

  describe("validation methods", () => {
    it("should validate message IDs correctly", () => {
      const validId = "msg_abc123_0123456789abcdef"
      const invalidIds = [
        "invalid",
        "msg_toolong123456789_0123456789abcdef",
        "msg_abc_tooshort",
        "wrong_abc123_0123456789abcdef",
      ]

      expect(uuidService.isValidMessageId(validId)).toBe(true)
      invalidIds.forEach((id) => {
        expect(uuidService.isValidMessageId(id)).toBe(false)
      })
    })

    it("should validate correlation IDs correctly", () => {
      const validId = "corr_abc123_0123456789ab"
      const invalidIds = [
        "invalid",
        "corr_abc_tooshort",
        "wrong_abc123_0123456789ab",
        "corr_abc123_toolong123456",
      ]

      expect(uuidService.isValidCorrelationId(validId)).toBe(true)
      invalidIds.forEach((id) => {
        expect(uuidService.isValidCorrelationId(id)).toBe(false)
      })
    })
  })

  describe("extractTimestampFromMessageId()", () => {
    it("should extract valid timestamp", () => {
      const messageId = uuidService.generateMessageId()
      const timestamp = uuidService.extractTimestampFromMessageId(messageId)

      expect(timestamp).toBe(clock.timestamp())
    })

    it("should return null for invalid message ID", () => {
      const invalidIds = [
        "invalid", // Wrong format completely
        "msg_abc123_invalid", // Invalid hex in random part
        "msg_notValidFormat", // Wrong structure
      ]

      invalidIds.forEach((id) => {
        expect(uuidService.extractTimestampFromMessageId(id)).toBeNull()
      })
    })

    it("should validate timestamp ranges", () => {
      // Create a message ID with timestamp way in the future
      const futureId = "msg_zzzzzzzzz_0123456789abcdef"
      expect(uuidService.extractTimestampFromMessageId(futureId)).toBeNull()
    })
  })
})

describe("DeterministicUuidService", () => {
  let clock: TestClock
  let uuidService: DeterministicUuidService

  beforeEach(() => {
    clock = new TestClock(new Date("2024-01-01T00:00:00.000Z"))
    uuidService = new DeterministicUuidService(clock)
  })

  describe("deterministic behavior", () => {
    it("should generate predictable message IDs", () => {
      const service1 = new DeterministicUuidService(clock)
      const service2 = new DeterministicUuidService(clock)

      expect(service1.generateMessageId()).toBe(service2.generateMessageId())
    })

    it("should increment counters consistently", () => {
      const id1 = uuidService.generateMessageId()
      const id2 = uuidService.generateMessageId()
      const id3 = uuidService.generateMessageId()

      // Should have same timestamp but different sequence numbers
      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)

      // Should be valid format
      expect(uuidService.isValidMessageId(id1)).toBe(true)
      expect(uuidService.isValidMessageId(id2)).toBe(true)
      expect(uuidService.isValidMessageId(id3)).toBe(true)
    })
  })

  describe("generateMessageId()", () => {
    it("should generate valid format", () => {
      const messageId = uuidService.generateMessageId()

      expect(messageId).toMatch(/^msg_[a-z0-9]{6,12}_[0-9a-f]{16}$/)
      expect(uuidService.isValidMessageId(messageId)).toBe(true)
    })

    it("should increment sequence numbers", () => {
      const ids: string[] = []
      for (let i = 0; i < 5; i++) {
        ids.push(uuidService.generateMessageId())
      }

      // All should be unique
      expect(new Set(ids).size).toBe(5)

      // Extract sequence parts (after second underscore)
      const sequences = ids.map((id) => id.split("_")[2])
      expect(sequences[0]).toBe("0000000000000001")
      expect(sequences[1]).toBe("0000000000000002")
      expect(sequences[2]).toBe("0000000000000003")
    })
  })

  describe("generateCorrelationId()", () => {
    it("should generate valid format", () => {
      const correlationId = uuidService.generateCorrelationId()

      expect(correlationId).toMatch(/^corr_[a-z0-9]+_[0-9a-f]{12}$/)
      expect(uuidService.isValidCorrelationId(correlationId)).toBe(true)
    })

    it("should have separate counter from message IDs", () => {
      const messageId = uuidService.generateMessageId()
      const correlationId = uuidService.generateCorrelationId()

      // Both should start from 1 in their respective counters
      expect(messageId.split("_")[2]).toBe("0000000000000001")
      expect(correlationId.split("_")[2]).toBe("000000000001")
    })
  })

  describe("generateUuid()", () => {
    it("should generate deterministic UUIDs", () => {
      const service1 = new DeterministicUuidService(clock)
      const service2 = new DeterministicUuidService(clock)

      expect(service1.generateUuid()).toBe(service2.generateUuid())
    })

    it("should increment UUID counter", () => {
      const uuid1 = uuidService.generateUuid()
      const uuid2 = uuidService.generateUuid()
      const uuid3 = uuidService.generateUuid()

      expect(uuid1).toBe("00000000-0000-4000-8000-0000000100000000")
      expect(uuid2).toBe("00000000-0000-4000-8000-0000000200000000")
      expect(uuid3).toBe("00000000-0000-4000-8000-0000000300000000")
    })
  })

  describe("generateShortId()", () => {
    it("should generate deterministic short IDs", () => {
      const id1 = uuidService.generateShortId()
      const id2 = uuidService.generateShortId()
      const id3 = uuidService.generateShortId()

      expect(id1).toBe("00000001")
      expect(id2).toBe("00000002")
      expect(id3).toBe("00000003")
    })
  })

  describe("counter management", () => {
    it("should reset all counters", () => {
      // Generate some IDs to increment counters
      uuidService.generateMessageId()
      uuidService.generateCorrelationId()
      uuidService.generateUuid()
      uuidService.generateShortId()

      uuidService.reset()

      // Should start from 1 again
      expect(uuidService.generateMessageId().split("_")[2]).toBe("0000000000000001")
      expect(uuidService.generateCorrelationId().split("_")[2]).toBe("000000000001")
      expect(uuidService.generateUuid()).toBe("00000000-0000-4000-8000-0000000100000000")
      expect(uuidService.generateShortId()).toBe("00000001")
    })

    it("should set specific counter values", () => {
      uuidService.setCounters({
        messageId: 100,
        correlationId: 200,
        uuid: 300,
        shortId: 400,
      })

      expect(uuidService.generateMessageId().split("_")[2]).toBe("0000000000000065") // 101 in hex
      expect(uuidService.generateCorrelationId().split("_")[2]).toBe("0000000000c9") // 201 in hex (padded to 12 chars)
      expect(uuidService.generateUuid()).toBe("00000000-0000-4000-8000-0000012d00000000") // 301 in hex
      expect(uuidService.generateShortId()).toBe("00000191") // 401 in hex
    })
  })

  describe("timestamp extraction", () => {
    it("should extract timestamps correctly from deterministic IDs", () => {
      const messageId = uuidService.generateMessageId()
      const timestamp = uuidService.extractTimestampFromMessageId(messageId)

      expect(timestamp).toBe(clock.timestamp())
    })
  })
})

describe("UUID Service Interface Compliance", () => {
  const clock = new TestClock()
  const services: [string, IUuidService][] = [
    ["SystemUuidService", new SystemUuidService(clock)],
    ["DeterministicUuidService", new DeterministicUuidService(clock)],
  ]

  services.forEach(([name, service]) => {
    describe(`${name} interface compliance`, () => {
      it("should implement all IUuidService methods", () => {
        expect(typeof service.generateMessageId).toBe("function")
        expect(typeof service.generateCorrelationId).toBe("function")
        expect(typeof service.generateUuid).toBe("function")
        expect(typeof service.generateShortId).toBe("function")
        expect(typeof service.isValidMessageId).toBe("function")
        expect(typeof service.isValidCorrelationId).toBe("function")
        expect(typeof service.extractTimestampFromMessageId).toBe("function")
      })

      it("should return correct types", () => {
        expect(typeof service.generateMessageId()).toBe("string")
        expect(typeof service.generateCorrelationId()).toBe("string")
        expect(typeof service.generateUuid()).toBe("string")
        expect(typeof service.generateShortId()).toBe("string")
        expect(typeof service.isValidMessageId("test")).toBe("boolean")
        expect(typeof service.isValidCorrelationId("test")).toBe("boolean")

        const messageId = service.generateMessageId()
        const timestamp = service.extractTimestampFromMessageId(messageId)
        expect(typeof timestamp === "number" || timestamp === null).toBe(true)
      })
    })
  })
})

describe("Integration with Clock Services", () => {
  describe("time-based ID generation", () => {
    it("should reflect clock changes in IDs", () => {
      const testClock = new TestClock(new Date("2024-01-01T00:00:00.000Z"))
      const uuidService = new DeterministicUuidService(testClock)

      const id1 = uuidService.generateMessageId()
      testClock.advance(60000) // 1 minute
      const id2 = uuidService.generateMessageId()

      const timestamp1 = uuidService.extractTimestampFromMessageId(id1)
      const timestamp2 = uuidService.extractTimestampFromMessageId(id2)

      expect(timestamp2! - timestamp1!).toBe(60000)
    })
  })

  describe("cross-service consistency", () => {
    it("should work with different clock implementations", () => {
      const testClock = new TestClock()
      const detService = new DeterministicUuidService(testClock)
      const sysService = new SystemUuidService(testClock)

      // Both should accept the same clock and generate valid IDs
      expect(detService.isValidMessageId(detService.generateMessageId())).toBe(true)
      expect(sysService.isValidMessageId(sysService.generateMessageId())).toBe(true)
    })
  })
})
