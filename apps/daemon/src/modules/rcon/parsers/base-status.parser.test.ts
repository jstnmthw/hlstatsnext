/**
 * Base Status Response Parser Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { BaseStatusParser, type StatusLine } from "./base-status.parser"
import type { ServerStatus } from "../types/rcon.types"
import { createMockLogger } from "@/tests/mocks/logger"

// Concrete implementation for testing the abstract base class
class TestStatusParser extends BaseStatusParser {
  parseStatus(response: string): ServerStatus {
    const status = this.createDefaultStatus()
    const statusLines = this.extractStatusLines(response)

    for (const line of statusLines) {
      if (line.key === "hostname") {
        status.hostname = line.value
      } else if (line.key === "players") {
        status.players = this.parseInt(line.value)
      } else if (line.key === "fps") {
        status.fps = this.parseFloat(line.value)
      }
    }

    this.logParsingResult(status)
    return status
  }

  // Expose protected methods for testing
  public testExtractStatusLines(response: string): StatusLine[] {
    return this.extractStatusLines(response)
  }

  public testParseStatusLine(line: string): StatusLine | null {
    return this.parseStatusLine(line)
  }

  public testCreateDefaultStatus(): ServerStatus {
    return this.createDefaultStatus()
  }

  public testParseInt(value: string, fallback?: number): number {
    return this.parseInt(value, fallback)
  }

  public testParseFloat(value: string, fallback?: number): number {
    return this.parseFloat(value, fallback)
  }

  public testLogParsingResult(status: ServerStatus): void {
    this.logParsingResult(status)
  }
}

describe("BaseStatusParser", () => {
  let parser: TestStatusParser
  const mockLogger = createMockLogger()

  beforeEach(() => {
    vi.clearAllMocks()
    parser = new TestStatusParser(mockLogger)
  })

  describe("extractStatusLines", () => {
    it("should extract key-value pairs from multi-line response", () => {
      const response = `hostname: Test Server
map: de_dust2
players: 15`

      const result = parser.testExtractStatusLines(response)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        key: "hostname",
        value: "Test Server",
        rawLine: "hostname: Test Server",
      })
      expect(result[1]).toEqual({
        key: "map",
        value: "de_dust2",
        rawLine: "map: de_dust2",
      })
      expect(result[2]).toEqual({
        key: "players",
        value: "15",
        rawLine: "players: 15",
      })
    })

    it("should skip empty and whitespace-only lines", () => {
      const response = `hostname: Test Server

      
map: de_dust2

players: 15
   `

      const result = parser.testExtractStatusLines(response)

      expect(result).toHaveLength(3)
      expect(result.map((r) => r.key)).toEqual(["hostname", "map", "players"])
    })

    it("should handle lines without colons", () => {
      const response = `hostname: Test Server
invalid line without colon
map: de_dust2`

      const result = parser.testExtractStatusLines(response)

      expect(result).toHaveLength(2)
      expect(result.map((r) => r.key)).toEqual(["hostname", "map"])
    })

    it("should handle empty response", () => {
      const result = parser.testExtractStatusLines("")
      expect(result).toHaveLength(0)
    })

    it("should handle response with only whitespace", () => {
      const result = parser.testExtractStatusLines("   \n   \t   \n   ")
      expect(result).toHaveLength(0)
    })
  })

  describe("parseStatusLine", () => {
    it("should parse valid key-value line", () => {
      const result = parser.testParseStatusLine("hostname: Test Server")

      expect(result).toEqual({
        key: "hostname",
        value: "Test Server",
        rawLine: "hostname: Test Server",
      })
    })

    it("should handle values with colons", () => {
      const result = parser.testParseStatusLine("description: Server: With: Colons")

      expect(result).toEqual({
        key: "description",
        value: "Server: With: Colons",
        rawLine: "description: Server: With: Colons",
      })
    })

    it("should trim whitespace from keys and values", () => {
      const result = parser.testParseStatusLine("  hostname  :  Test Server  ")

      expect(result).toEqual({
        key: "hostname",
        value: "Test Server",
        rawLine: "  hostname  :  Test Server  ",
      })
    })

    it("should convert keys to lowercase", () => {
      const result = parser.testParseStatusLine("HOSTNAME: Test Server")

      expect(result?.key).toBe("hostname")
    })

    it("should return null for lines without colons", () => {
      const result = parser.testParseStatusLine("invalid line without colon")
      expect(result).toBeNull()
    })

    it("should handle empty key", () => {
      const result = parser.testParseStatusLine(": Test Value")

      expect(result).toEqual({
        key: "",
        value: "Test Value",
        rawLine: ": Test Value",
      })
    })

    it("should handle empty value", () => {
      const result = parser.testParseStatusLine("hostname:")

      expect(result).toEqual({
        key: "hostname",
        value: "",
        rawLine: "hostname:",
      })
    })

    it("should handle colon at the beginning", () => {
      const result = parser.testParseStatusLine(":value")

      expect(result).toEqual({
        key: "",
        value: "value",
        rawLine: ":value",
      })
    })
  })

  describe("createDefaultStatus", () => {
    it("should create default status object with correct structure", () => {
      const result = parser.testCreateDefaultStatus()

      expect(result).toEqual({
        map: "unknown",
        players: 0,
        maxPlayers: 0,
        uptime: 0,
        fps: 0,
        timestamp: expect.any(Date),
      })
    })

    it("should set current timestamp", () => {
      const beforeCreate = new Date()
      const result = parser.testCreateDefaultStatus()
      const afterCreate = new Date()

      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
    })
  })

  describe("parseInt", () => {
    it("should parse valid integers", () => {
      expect(parser.testParseInt("123")).toBe(123)
      expect(parser.testParseInt("0")).toBe(0)
      expect(parser.testParseInt("-456")).toBe(-456)
      expect(parser.testParseInt("42")).toBe(42)
    })

    it("should handle invalid values with default fallback", () => {
      expect(parser.testParseInt("invalid")).toBe(0)
      expect(parser.testParseInt("")).toBe(0)
      expect(parser.testParseInt("abc123")).toBe(0) // NaN case
    })

    it("should use custom fallback value", () => {
      expect(parser.testParseInt("invalid", -1)).toBe(-1)
      expect(parser.testParseInt("", 999)).toBe(999)
    })

    it("should parse string representations of floats as integers", () => {
      expect(parser.testParseInt("123.456")).toBe(123)
      expect(parser.testParseInt("99.9")).toBe(99)
    })

    it("should handle leading/trailing whitespace", () => {
      expect(parser.testParseInt("  123  ")).toBe(123)
      expect(parser.testParseInt("\t456\n")).toBe(456)
    })
  })

  describe("parseFloat", () => {
    it("should parse valid float values", () => {
      expect(parser.testParseFloat("123.456")).toBe(123.456)
      expect(parser.testParseFloat("0.0")).toBe(0.0)
      expect(parser.testParseFloat("-456.789")).toBe(-456.789)
      expect(parser.testParseFloat("42")).toBe(42)
    })

    it("should handle invalid values with default fallback", () => {
      expect(parser.testParseFloat("invalid")).toBe(0)
      expect(parser.testParseFloat("")).toBe(0)
      expect(parser.testParseFloat("abc123")).toBe(0) // NaN case
    })

    it("should use custom fallback value", () => {
      expect(parser.testParseFloat("invalid", -1.5)).toBe(-1.5)
      expect(parser.testParseFloat("", 999.999)).toBe(999.999)
    })

    it("should handle scientific notation", () => {
      expect(parser.testParseFloat("1.23e2")).toBe(123)
      expect(parser.testParseFloat("1.5e-2")).toBe(0.015)
    })

    it("should handle leading/trailing whitespace", () => {
      expect(parser.testParseFloat("  123.456  ")).toBe(123.456)
      expect(parser.testParseFloat("\t99.9\n")).toBe(99.9)
    })

    it("should handle special float values", () => {
      expect(parser.testParseFloat("Infinity")).toBe(Infinity)
      expect(parser.testParseFloat("-Infinity")).toBe(-Infinity)
      expect(parser.testParseFloat("NaN")).toBe(0) // NaN should use fallback
    })
  })

  describe("logParsingResult", () => {
    it("should log parsing result with status details", () => {
      const status: ServerStatus = {
        hostname: "Test Server",
        map: "de_dust2",
        players: 15,
        maxPlayers: 32,
        uptime: 3600,
        fps: 100.0,
        version: "1.6",
        timestamp: new Date(),
      }

      parser.testLogParsingResult(status)

      expect(mockLogger.debug).toHaveBeenCalledWith("Parsed server status", {
        hostname: "Test Server",
        map: "de_dust2",
        players: "15/32",
        version: "1.6",
      })
    })

    it("should handle undefined optional fields", () => {
      const status: ServerStatus = {
        map: "de_dust2",
        players: 5,
        maxPlayers: 10,
        uptime: 0,
        fps: 0,
        timestamp: new Date(),
      }

      parser.testLogParsingResult(status)

      expect(mockLogger.debug).toHaveBeenCalledWith("Parsed server status", {
        hostname: undefined,
        map: "de_dust2",
        players: "5/10",
        version: undefined,
      })
    })
  })

  describe("integration test with parseStatus", () => {
    it("should demonstrate full parsing workflow", () => {
      const response = `hostname: Integration Test Server
players: 25
fps: 128.5`

      const result = parser.parseStatus(response)

      expect(result).toEqual({
        hostname: "Integration Test Server",
        map: "unknown",
        players: 25,
        maxPlayers: 0,
        uptime: 0,
        fps: 128.5,
        timestamp: expect.any(Date),
      })

      expect(mockLogger.debug).toHaveBeenCalledWith("Parsed server status", {
        hostname: "Integration Test Server",
        map: "unknown",
        players: "25/0",
        version: undefined,
      })
    })
  })
})
