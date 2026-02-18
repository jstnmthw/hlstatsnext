/**
 * Rate Limiter Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthRateLimiter } from "./rate-limiter"

describe("AuthRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("isBlocked", () => {
    it("should return false for unknown IPs", () => {
      const limiter = new AuthRateLimiter()
      expect(limiter.isBlocked("192.168.1.1")).toBe(false)
    })

    it("should return true for blocked IPs", () => {
      const limiter = new AuthRateLimiter({ maxAttempts: 2 })

      limiter.recordFailure("192.168.1.1")
      limiter.recordFailure("192.168.1.1")

      expect(limiter.isBlocked("192.168.1.1")).toBe(true)
    })

    it("should return false after block expires", () => {
      const limiter = new AuthRateLimiter({
        maxAttempts: 1,
        blockDurationMs: 1000,
      })

      limiter.recordFailure("192.168.1.1")
      expect(limiter.isBlocked("192.168.1.1")).toBe(true)

      // Advance past block duration
      vi.advanceTimersByTime(1001)

      expect(limiter.isBlocked("192.168.1.1")).toBe(false)
    })
  })

  describe("recordFailure", () => {
    it("should not block before threshold", () => {
      const limiter = new AuthRateLimiter({ maxAttempts: 3 })

      expect(limiter.recordFailure("192.168.1.1")).toBe(false)
      expect(limiter.recordFailure("192.168.1.1")).toBe(false)
      expect(limiter.isBlocked("192.168.1.1")).toBe(false)
    })

    it("should block at threshold", () => {
      const limiter = new AuthRateLimiter({ maxAttempts: 3 })

      limiter.recordFailure("192.168.1.1")
      limiter.recordFailure("192.168.1.1")
      const blocked = limiter.recordFailure("192.168.1.1")

      expect(blocked).toBe(true)
      expect(limiter.isBlocked("192.168.1.1")).toBe(true)
    })

    it("should return true if already blocked", () => {
      const limiter = new AuthRateLimiter({ maxAttempts: 1 })

      limiter.recordFailure("192.168.1.1")
      expect(limiter.recordFailure("192.168.1.1")).toBe(true)
    })

    it("should track different IPs separately", () => {
      const limiter = new AuthRateLimiter({ maxAttempts: 2 })

      limiter.recordFailure("192.168.1.1")
      limiter.recordFailure("192.168.1.1")

      expect(limiter.isBlocked("192.168.1.1")).toBe(true)
      expect(limiter.isBlocked("192.168.1.2")).toBe(false)
    })

    it("should expire old attempts outside window", () => {
      const limiter = new AuthRateLimiter({
        maxAttempts: 3,
        windowMs: 1000,
      })

      limiter.recordFailure("192.168.1.1")
      limiter.recordFailure("192.168.1.1")

      // Advance past window
      vi.advanceTimersByTime(1001)

      // These should be within a new window
      limiter.recordFailure("192.168.1.1")
      limiter.recordFailure("192.168.1.1")

      // Should not be blocked (only 2 in current window)
      expect(limiter.isBlocked("192.168.1.1")).toBe(false)
    })
  })

  describe("getRemainingAttempts", () => {
    it("should return max attempts for unknown IP", () => {
      const limiter = new AuthRateLimiter({ maxAttempts: 5 })
      expect(limiter.getRemainingAttempts("192.168.1.1")).toBe(5)
    })

    it("should decrease with each failure", () => {
      const limiter = new AuthRateLimiter({ maxAttempts: 5 })

      limiter.recordFailure("192.168.1.1")
      expect(limiter.getRemainingAttempts("192.168.1.1")).toBe(4)

      limiter.recordFailure("192.168.1.1")
      expect(limiter.getRemainingAttempts("192.168.1.1")).toBe(3)
    })

    it("should return 0 when blocked", () => {
      const limiter = new AuthRateLimiter({ maxAttempts: 1 })

      limiter.recordFailure("192.168.1.1")
      expect(limiter.getRemainingAttempts("192.168.1.1")).toBe(0)
    })
  })

  describe("clear", () => {
    it("should clear specific IP", () => {
      const limiter = new AuthRateLimiter({ maxAttempts: 1 })

      limiter.recordFailure("192.168.1.1")
      limiter.recordFailure("192.168.1.2")

      limiter.clear("192.168.1.1")

      expect(limiter.isBlocked("192.168.1.1")).toBe(false)
      expect(limiter.isBlocked("192.168.1.2")).toBe(true)
    })

    it("should clear all IPs when no argument", () => {
      const limiter = new AuthRateLimiter({ maxAttempts: 1 })

      limiter.recordFailure("192.168.1.1")
      limiter.recordFailure("192.168.1.2")

      limiter.clear()

      expect(limiter.isBlocked("192.168.1.1")).toBe(false)
      expect(limiter.isBlocked("192.168.1.2")).toBe(false)
    })
  })
})
