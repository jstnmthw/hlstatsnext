/**
 * CS Parser Map Change Tests
 *
 * Tests for map change event parsing and round start map tracking
 */

import { describe, it, expect, beforeEach } from "vitest"
import { CsParser } from "./cs.parser"
import { EventType } from "@/shared/types/events"
import type { MapChangeEvent, RoundStartEvent } from "@/modules/match/match.types"

describe("CsParser - Map Change Events", () => {
  let parser: CsParser
  const serverId = 1

  beforeEach(() => {
    parser = new CsParser("csgo")
  })

  describe("parseMapChangeEvent", () => {
    it("should parse mapchange to pattern", () => {
      const logLine = "-------- Mapchange to cs_havana --------"
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeDefined()
      expect(result.event?.eventType).toBe(EventType.MAP_CHANGE)
      const mapEvent = result.event as MapChangeEvent
      expect(mapEvent.data.newMap).toBe("cs_havana")
      expect(mapEvent.data.previousMap).toBeUndefined()
    })

    it("should parse started map pattern", () => {
      const logLine = 'Started map "de_dust2" (CRC "-1352213912")'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeDefined()
      expect(result.event?.eventType).toBe(EventType.MAP_CHANGE)
      const mapEvent = result.event as MapChangeEvent
      expect(mapEvent.data.newMap).toBe("de_dust2")
    })

    it("should track previous map in subsequent changes", () => {
      // First map change
      const firstMapLine = "-------- Mapchange to cs_havana --------"
      const firstResult = parser.parseLine(firstMapLine, serverId)

      expect(firstResult.success).toBe(true)
      const firstMapEvent = firstResult.event as MapChangeEvent
      expect(firstMapEvent.data.newMap).toBe("cs_havana")
      expect(firstMapEvent.data.previousMap).toBeUndefined()

      // Second map change should have previous map
      const secondMapLine = 'Started map "de_dust2" (CRC "-1352213912")'
      const secondResult = parser.parseLine(secondMapLine, serverId)

      expect(secondResult.success).toBe(true)
      const secondMapEvent = secondResult.event as MapChangeEvent
      expect(secondMapEvent.data.newMap).toBe("de_dust2")
      expect(secondMapEvent.data.previousMap).toBe("cs_havana")
    })

    it("should handle changelevel command pattern", () => {
      const logLine = "changelevel: de_mirage"
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeDefined()
      expect(result.event?.eventType).toBe(EventType.MAP_CHANGE)
      const mapEvent = result.event as MapChangeEvent
      expect(mapEvent.data.newMap).toBe("de_mirage")
    })
  })

  describe("parseRoundStartEvent with map tracking", () => {
    it("should use current map from parser state", () => {
      // Set a map first
      const mapChangeLine = "-------- Mapchange to cs_havana --------"
      parser.parseLine(mapChangeLine, serverId)

      // Now parse a round start
      const roundStartLine = 'World triggered "Round_Start"'
      const result = parser.parseLine(roundStartLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeDefined()
      expect(result.event?.eventType).toBe(EventType.ROUND_START)
      const roundEvent = result.event as RoundStartEvent
      expect(roundEvent.data.map).toBe("cs_havana")
    })

    it("should handle round start without previous map change", () => {
      const roundStartLine = 'World triggered "Round_Start"'
      const result = parser.parseLine(roundStartLine, serverId)

      expect(result.success).toBe(true)
      expect(result.event).toBeDefined()
      expect(result.event?.eventType).toBe(EventType.ROUND_START)
      const roundEvent = result.event as RoundStartEvent
      expect(roundEvent.data.map).toBe("")
    })

    it("should persist map across multiple round starts", () => {
      // Set a map
      const mapChangeLine = 'Started map "de_dust2" (CRC "-1352213912")'
      parser.parseLine(mapChangeLine, serverId)

      // First round start
      const firstRoundLine = 'World triggered "Round_Start"'
      const firstResult = parser.parseLine(firstRoundLine, serverId)
      const firstRoundEvent = firstResult.event as RoundStartEvent
      expect(firstRoundEvent.data.map).toBe("de_dust2")

      // Second round start should still have the same map
      const secondResult = parser.parseLine(firstRoundLine, serverId)
      const secondRoundEvent = secondResult.event as RoundStartEvent
      expect(secondRoundEvent.data.map).toBe("de_dust2")
    })
  })

  describe("map change error handling", () => {
    it("should handle malformed map change events", () => {
      const logLine = "-------- Mapchange to  --------"
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Could not extract map name")
    })

    it("should handle missing map name in started map pattern", () => {
      const logLine = 'Started map "" (CRC "-1352213912")'
      const result = parser.parseLine(logLine, serverId)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Could not extract map name")
    })
  })
})
