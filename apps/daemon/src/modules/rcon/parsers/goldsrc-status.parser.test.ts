/**
 * GoldSrc Status Response Parser Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { GoldSrcStatusParser } from "./goldsrc-status.parser"
import { createMockLogger } from "@/tests/mocks/logger"

describe("GoldSrcStatusParser", () => {
  let parser: GoldSrcStatusParser
  const mockLogger = createMockLogger()

  beforeEach(() => {
    vi.clearAllMocks()
    parser = new GoldSrcStatusParser(mockLogger)
  })

  describe("parseStatus", () => {
    it("should parse complete GoldSrc status response", () => {
      const response = `hostname:  [DEV] CS1.6 Test Server
version :  48/1.1.2.7/Stdio 10211 secure  (10)
tcp/ip  :  0.0.0.0:27015
map     :  de_cbble at: 0 x, 0 y, 0 z
players :  15 active (32 max)
fps     :  100.0
cpu     :  25.5`

      const result = parser.parseStatus(response)

      expect(result).toEqual({
        hostname: "[DEV] CS1.6 Test Server",
        version: "48/1.1.2.7/Stdio 10211 secure  (10)",
        map: "de_cbble",
        players: 15,
        maxPlayers: 32,
        fps: 100.0,
        cpu: 25.5,
        uptime: 0,
        timestamp: expect.any(Date),
      })

      expect(mockLogger.debug).toHaveBeenCalledWith("📊 Parsed server status", {
        hostname: "[DEV] CS1.6 Test Server",
        map: "de_cbble",
        players: "15/32",
        version: "48/1.1.2.7/Stdio 10211 secure  (10)",
      })
    })

    it("should parse minimal status response with defaults", () => {
      const response = "hostname: Simple Server"

      const result = parser.parseStatus(response)

      expect(result).toEqual({
        hostname: "Simple Server",
        map: "unknown",
        players: 0,
        maxPlayers: 0,
        uptime: 0,
        fps: 0,
        cpu: undefined,
        version: undefined,
        timestamp: expect.any(Date),
      })
    })

    it("should handle player count format '30 active (32 max)'", () => {
      const response = "players: 30 active (32 max)"

      const result = parser.parseStatus(response)

      expect(result.players).toBe(30)
      expect(result.maxPlayers).toBe(32)
    })

    it("should handle player count format '30 (32 max)'", () => {
      const response = "players: 30 (32 max)"

      const result = parser.parseStatus(response)

      expect(result.players).toBe(30)
      expect(result.maxPlayers).toBe(32)
    })

    it("should handle player count format '30/32'", () => {
      const response = "players: 30/32"

      const result = parser.parseStatus(response)

      expect(result.players).toBe(30)
      expect(result.maxPlayers).toBe(32)
    })

    it("should extract map name from full map information", () => {
      const response = "map: de_cbble at: 0 x, 0 y, 0 z"

      const result = parser.parseStatus(response)

      expect(result.map).toBe("de_cbble")
    })

    it("should handle simple map name", () => {
      const response = "map: de_dust2"

      const result = parser.parseStatus(response)

      expect(result.map).toBe("de_dust2")
    })

    it("should parse FPS values", () => {
      const testCases = [
        { input: "fps: 100.0", expected: 100.0 },
        { input: "fps: 66.7 avg", expected: 66.7 },
        { input: "fps: 100", expected: 100 },
      ]

      testCases.forEach(({ input, expected }) => {
        const result = parser.parseStatus(input)
        expect(result.fps).toBe(expected)
      })
    })

    it("should parse CPU values", () => {
      const testCases = [
        { input: "cpu: 25.5", expected: 25.5 },
        { input: "cpu: 50.0%", expected: 50.0 },
        { input: "cpu: 10", expected: 10 },
      ]

      testCases.forEach(({ input, expected }) => {
        const result = parser.parseStatus(input)
        expect(result.cpu).toBe(expected)
      })
    })

    it("should handle empty lines and whitespace", () => {
      const response = `
      
hostname: Test Server

map: de_dust2

players: 5/32

      `

      const result = parser.parseStatus(response)

      expect(result.hostname).toBe("Test Server")
      expect(result.map).toBe("de_dust2")
      expect(result.players).toBe(5)
      expect(result.maxPlayers).toBe(32)
    })

    it("should handle invalid lines gracefully", () => {
      const response = `hostname: Test Server
invalid line without colon
map: de_dust2
another invalid line
players: 10/20`

      const result = parser.parseStatus(response)

      expect(result.hostname).toBe("Test Server")
      expect(result.map).toBe("de_dust2")
      expect(result.players).toBe(10)
      expect(result.maxPlayers).toBe(20)
    })

    it("should handle duplicate keys by taking the last value", () => {
      const response = `hostname: First Server
hostname: Second Server
map: de_dust2`

      const result = parser.parseStatus(response)

      expect(result.hostname).toBe("Second Server")
      expect(result.map).toBe("de_dust2")
    })

    it("should handle case-insensitive keys", () => {
      const response = `HOSTNAME: Test Server
MAP: de_dust2
PLAYERS: 5/32`

      const result = parser.parseStatus(response)

      expect(result.hostname).toBe("Test Server")
      expect(result.map).toBe("de_dust2")
      expect(result.players).toBe(5)
      expect(result.maxPlayers).toBe(32)
    })

    it("should handle malformed player counts gracefully", () => {
      const testCases = [
        "players: invalid",
        "players: (32 max)",
        "players: 5 active",
        "players: /32",
        "players: 5/",
      ]

      testCases.forEach((input) => {
        const result = parser.parseStatus(input)
        expect(result.players).toBe(0)
        expect(result.maxPlayers).toBe(0)
      })
    })

    it("should handle malformed FPS and CPU values", () => {
      const response = `fps: invalid
cpu: not a number`

      const result = parser.parseStatus(response)

      expect(result.fps).toBe(0) // Default value, not modified since no match
      expect(result.cpu).toBeUndefined() // Not set since no match
    })

    it("should preserve version strings exactly", () => {
      const versionString = "48/1.1.2.7/Stdio 10211 secure  (10)"
      const response = `version: ${versionString}`

      const result = parser.parseStatus(response)

      expect(result.version).toBe(versionString)
    })

    it("should handle complex server names with colons", () => {
      const response = "hostname: [TAG] Server Name: With Colons"

      const result = parser.parseStatus(response)

      expect(result.hostname).toBe("[TAG] Server Name: With Colons")
    })

    it("should handle different map formats", () => {
      const testCases = [
        { input: "map: de_dust2_2x2", expected: "de_dust2_2x2" },
        { input: "map: fy_iceworld at: 123 x, 456 y, 789 z", expected: "fy_iceworld" },
        { input: "map: cs_office", expected: "cs_office" },
      ]

      testCases.forEach(({ input, expected }) => {
        const result = parser.parseStatus(input)
        expect(result.map).toBe(expected)
      })
    })

    it("should set timestamp to current time", () => {
      const beforeParse = new Date()
      const result = parser.parseStatus("hostname: Test")
      const afterParse = new Date()

      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(beforeParse.getTime())
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(afterParse.getTime())
    })

    it("should handle empty response", () => {
      const result = parser.parseStatus("")

      expect(result).toEqual({
        map: "unknown",
        players: 0,
        maxPlayers: 0,
        uptime: 0,
        fps: 0,
        timestamp: expect.any(Date),
      })
    })

    it("should handle response with only whitespace", () => {
      const result = parser.parseStatus("   \n   \t   \n   ")

      expect(result).toEqual({
        map: "unknown",
        players: 0,
        maxPlayers: 0,
        uptime: 0,
        fps: 0,
        timestamp: expect.any(Date),
      })
    })
  })
})
