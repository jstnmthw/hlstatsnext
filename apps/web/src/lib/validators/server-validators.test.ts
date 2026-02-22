import { describe, expect, it } from "vitest"
import {
  extractIPFromAddress,
  isValidIPAddress,
  isValidPort,
  isValidUrl,
  sanitizeIPAddress,
} from "./server-validators"

describe("isValidIPAddress", () => {
  it("returns true for valid IPv4 addresses", () => {
    expect(isValidIPAddress("192.168.1.1")).toBe(true)
    expect(isValidIPAddress("10.0.0.1")).toBe(true)
    expect(isValidIPAddress("255.255.255.255")).toBe(true)
    expect(isValidIPAddress("0.0.0.0")).toBe(true)
  })

  it("returns false for invalid addresses", () => {
    expect(isValidIPAddress("256.1.1.1")).toBe(false)
    expect(isValidIPAddress("abc")).toBe(false)
    expect(isValidIPAddress("")).toBe(false)
    expect(isValidIPAddress("192.168.1")).toBe(false)
  })

  it("returns false for IPv6 addresses", () => {
    expect(isValidIPAddress("::1")).toBe(false)
    expect(isValidIPAddress("2001:db8::1")).toBe(false)
  })
})

describe("isValidPort", () => {
  it("returns true for valid ports", () => {
    expect(isValidPort(1)).toBe(true)
    expect(isValidPort(80)).toBe(true)
    expect(isValidPort(27015)).toBe(true)
    expect(isValidPort(65535)).toBe(true)
  })

  it("returns false for out-of-range ports", () => {
    expect(isValidPort(0)).toBe(false)
    expect(isValidPort(-1)).toBe(false)
    expect(isValidPort(65536)).toBe(false)
  })

  it("returns false for non-integer ports", () => {
    expect(isValidPort(1.5)).toBe(false)
    expect(isValidPort(NaN)).toBe(false)
  })
})

describe("isValidUrl", () => {
  it("returns true for valid URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true)
    expect(isValidUrl("http://localhost:3000")).toBe(true)
    expect(isValidUrl("https://status.example.com/server/1")).toBe(true)
  })

  it("returns false for invalid URLs", () => {
    expect(isValidUrl("not-a-url")).toBe(false)
    expect(isValidUrl("")).toBe(false)
    expect(isValidUrl("://missing-scheme")).toBe(false)
  })
})

describe("extractIPFromAddress", () => {
  it("extracts IP from address:port format", () => {
    expect(extractIPFromAddress("192.168.1.1:27015")).toBe("192.168.1.1")
  })

  it("returns the address if no port", () => {
    expect(extractIPFromAddress("192.168.1.1")).toBe("192.168.1.1")
  })
})

describe("sanitizeIPAddress", () => {
  it("returns sanitized IPv4 address", () => {
    expect(sanitizeIPAddress("192.168.1.1")).toBe("192.168.1.1")
    expect(sanitizeIPAddress("192.168.1.1:27015")).toBe("192.168.1.1")
  })

  it("returns null for invalid addresses", () => {
    expect(sanitizeIPAddress("invalid")).toBe(null)
    expect(sanitizeIPAddress("999.999.999.999")).toBe(null)
  })
})
