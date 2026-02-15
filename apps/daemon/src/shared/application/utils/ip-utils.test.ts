/**
 * IP Utils Tests
 *
 * Tests for IP address utility functions.
 */

import { describe, expect, it } from "vitest"
import { extractIpFromAddress, ipv4ToBigInt, isIPv4, isIPv6, sanitizeIpAddress } from "./ip-utils"

describe("IP Utils", () => {
  describe("ipv4ToBigInt", () => {
    it("should convert valid IPv4 addresses to BigInt", () => {
      // 0.0.0.0
      expect(ipv4ToBigInt("0.0.0.0")).toBe(0n)
      // 0.0.0.1
      expect(ipv4ToBigInt("0.0.0.1")).toBe(1n)
      // 0.0.1.0
      expect(ipv4ToBigInt("0.0.1.0")).toBe(256n)
      // 0.1.0.0
      expect(ipv4ToBigInt("0.1.0.0")).toBe(65536n)
      // 1.0.0.0
      expect(ipv4ToBigInt("1.0.0.0")).toBe(16777216n)
      // 255.255.255.255
      expect(ipv4ToBigInt("255.255.255.255")).toBe(4294967295n)
    })

    it("should convert common IP addresses correctly", () => {
      // 127.0.0.1 -> 2130706433
      expect(ipv4ToBigInt("127.0.0.1")).toBe(2130706433n)
      // 192.168.1.1 -> 3232235777
      expect(ipv4ToBigInt("192.168.1.1")).toBe(3232235777n)
      // 10.0.0.1 -> 167772161
      expect(ipv4ToBigInt("10.0.0.1")).toBe(167772161n)
    })

    it("should return null for invalid IPv4 addresses", () => {
      expect(ipv4ToBigInt("")).toBeNull()
      expect(ipv4ToBigInt("invalid")).toBeNull()
      expect(ipv4ToBigInt("1.2.3")).toBeNull()
      expect(ipv4ToBigInt("1.2.3.4.5")).toBeNull()
      expect(ipv4ToBigInt("256.0.0.0")).toBeNull()
      expect(ipv4ToBigInt("1.2.3.-1")).toBeNull()
      expect(ipv4ToBigInt("1.2.3.256")).toBeNull()
      expect(ipv4ToBigInt("a.b.c.d")).toBeNull()
    })

    it("should return null for non-integer parts", () => {
      expect(ipv4ToBigInt("1.2.3.4.5")).toBeNull()
      expect(ipv4ToBigInt("1.2.3.a")).toBeNull()
      expect(ipv4ToBigInt("1.2.3.1.5")).toBeNull()
    })
  })

  describe("isIPv4", () => {
    it("should return true for valid IPv4 addresses", () => {
      expect(isIPv4("0.0.0.0")).toBe(true)
      expect(isIPv4("127.0.0.1")).toBe(true)
      expect(isIPv4("192.168.1.1")).toBe(true)
      expect(isIPv4("255.255.255.255")).toBe(true)
      expect(isIPv4("10.0.0.1")).toBe(true)
    })

    it("should return false for IPv6 addresses", () => {
      expect(isIPv4("::1")).toBe(false)
      expect(isIPv4("2001:db8::1")).toBe(false)
      expect(isIPv4("fe80::1")).toBe(false)
    })

    it("should return false for invalid addresses", () => {
      expect(isIPv4("")).toBe(false)
      expect(isIPv4("invalid")).toBe(false)
      expect(isIPv4("256.0.0.0")).toBe(false)
      expect(isIPv4("1.2.3")).toBe(false)
    })
  })

  describe("isIPv6", () => {
    it("should return true for valid IPv6 addresses", () => {
      expect(isIPv6("::1")).toBe(true)
      expect(isIPv6("::")).toBe(true)
      expect(isIPv6("2001:db8::1")).toBe(true)
      expect(isIPv6("fe80::1")).toBe(true)
      expect(isIPv6("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(true)
    })

    it("should return false for IPv4 addresses", () => {
      expect(isIPv6("127.0.0.1")).toBe(false)
      expect(isIPv6("192.168.1.1")).toBe(false)
    })

    it("should return false for invalid addresses", () => {
      expect(isIPv6("")).toBe(false)
      expect(isIPv6("invalid")).toBe(false)
      expect(isIPv6("not-an-ip")).toBe(false)
    })
  })

  describe("extractIpFromAddress", () => {
    it("should extract IP from address:port format", () => {
      expect(extractIpFromAddress("192.168.1.1:27015")).toBe("192.168.1.1")
      expect(extractIpFromAddress("10.0.0.1:8080")).toBe("10.0.0.1")
      expect(extractIpFromAddress("127.0.0.1:3000")).toBe("127.0.0.1")
    })

    it("should return IP as-is if no port", () => {
      expect(extractIpFromAddress("192.168.1.1")).toBe("192.168.1.1")
      expect(extractIpFromAddress("10.0.0.1")).toBe("10.0.0.1")
    })

    it("should handle edge cases", () => {
      expect(extractIpFromAddress("")).toBe("")
      expect(extractIpFromAddress("0.0.0.0:0")).toBe("0.0.0.0")
    })
  })

  describe("sanitizeIpAddress", () => {
    it("should return sanitized IP for valid addresses", () => {
      expect(sanitizeIpAddress("192.168.1.1:27015")).toBe("192.168.1.1")
      expect(sanitizeIpAddress("10.0.0.1")).toBe("10.0.0.1")
      expect(sanitizeIpAddress("127.0.0.1:8080")).toBe("127.0.0.1")
    })

    it("should return null for IPv6 addresses (not supported by extractIpFromAddress)", () => {
      // Note: Current implementation splits on ":" which breaks IPv6 addresses
      expect(sanitizeIpAddress("::1")).toBeNull()
      expect(sanitizeIpAddress("2001:db8::1")).toBeNull()
    })

    it("should return null for invalid addresses", () => {
      expect(sanitizeIpAddress("invalid")).toBeNull()
      expect(sanitizeIpAddress("not-an-ip:8080")).toBeNull()
      expect(sanitizeIpAddress("256.0.0.0:8080")).toBeNull()
    })

    it("should handle empty string", () => {
      expect(sanitizeIpAddress("")).toBeNull()
    })
  })
})
