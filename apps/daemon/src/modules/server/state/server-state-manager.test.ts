/**
 * Server State Manager Tests
 *
 * Tests for centralized server state management.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ServerStateManager } from "./server-state-manager"

describe("ServerStateManager", () => {
  let stateManager: ServerStateManager
  let mockLogger: ILogger

  beforeEach(() => {
    vi.useFakeTimers()
    mockLogger = createMockLogger()
    stateManager = new ServerStateManager(mockLogger)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("getServerState", () => {
    it("should create default state for new server", () => {
      const state = stateManager.getServerState(1)

      expect(state.currentMap).toBe("")
      expect(state.currentRound).toBe(0)
      expect(state.matchState).toBe("waiting")
      expect(state.teamCounts.terrorists).toBe(0)
      expect(state.teamCounts.counterTerrorists).toBe(0)
      expect(state.teamCounts.spectators).toBe(0)
      expect(state.maxPlayers).toBe(0)
      expect(mockLogger.debug).toHaveBeenCalledWith("Created default state for server 1")
    })

    it("should return existing state for known server", () => {
      // First call creates state
      const state1 = stateManager.getServerState(1)
      state1.currentMap = "de_dust2"

      // Second call returns same state
      const state2 = stateManager.getServerState(1)

      expect(state2.currentMap).toBe("de_dust2")
    })
  })

  describe("updateMap", () => {
    it("should update map and reset round counter", () => {
      const state = stateManager.getServerState(1)
      state.currentRound = 5

      const result = stateManager.updateMap(1, "de_inferno")

      expect(result.changed).toBe(true)
      expect(result.previousMap).toBeUndefined() // Empty string becomes undefined
      expect(state.currentMap).toBe("de_inferno")
      expect(state.currentRound).toBe(0)
    })

    it("should not change state for same map", () => {
      stateManager.updateMap(1, "de_dust2")

      const result = stateManager.updateMap(1, "de_dust2")

      expect(result.changed).toBe(false)
    })

    it("should notify listeners on map change", () => {
      const listener = vi.fn()
      stateManager.onStateChange(listener)

      stateManager.updateMap(1, "de_dust2")

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 1,
          changeType: "map_change",
          newState: expect.objectContaining({ currentMap: "de_dust2" }),
        }),
      )
    })
  })

  describe("startRound", () => {
    it("should increment round counter", () => {
      stateManager.startRound(1)
      stateManager.startRound(1)
      const result = stateManager.startRound(1)

      expect(result.roundNumber).toBe(3)
    })

    it("should set round start time", () => {
      const now = new Date("2024-01-15T12:00:00Z")
      vi.setSystemTime(now)

      stateManager.startRound(1)
      const state = stateManager.getServerState(1)

      expect(state.roundStartTime).toEqual(now)
    })

    it("should clear previous winning team", () => {
      stateManager.setWinningTeam(1, "CT")
      stateManager.startRound(1)

      const state = stateManager.getServerState(1)
      expect(state.lastWinningTeam).toBeUndefined()
    })

    it("should notify listeners on round start", () => {
      const listener = vi.fn()
      stateManager.onStateChange(listener)

      stateManager.startRound(1)

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 1,
          changeType: "round_start",
          newState: expect.objectContaining({ currentRound: 1 }),
        }),
      )
    })
  })

  describe("endRound", () => {
    it("should return current round number and winning team", () => {
      stateManager.startRound(1)
      stateManager.setWinningTeam(1, "TERRORIST")

      const result = stateManager.endRound(1)

      expect(result.roundNumber).toBe(1)
      expect(result.winningTeam).toBe("TERRORIST")
    })

    it("should notify listeners on round end", () => {
      const listener = vi.fn()
      stateManager.onStateChange(listener)
      stateManager.startRound(1)

      stateManager.endRound(1)

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 1,
          changeType: "round_end",
        }),
      )
    })
  })

  describe("setWinningTeam", () => {
    it("should set winning team for current round", () => {
      stateManager.setWinningTeam(1, "CT")

      const state = stateManager.getServerState(1)
      expect(state.lastWinningTeam).toBe("CT")
    })

    it("should notify listeners on team win", () => {
      const listener = vi.fn()
      stateManager.onStateChange(listener)

      stateManager.setWinningTeam(1, "TERRORIST")

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 1,
          changeType: "team_win",
          newState: expect.objectContaining({ lastWinningTeam: "TERRORIST" }),
        }),
      )
    })
  })

  describe("updatePlayerCounts", () => {
    it("should update terrorist count", () => {
      stateManager.updatePlayerCounts(1, { terrorists: 5 })

      const state = stateManager.getServerState(1)
      expect(state.teamCounts.terrorists).toBe(5)
    })

    it("should update counter-terrorist count", () => {
      stateManager.updatePlayerCounts(1, { counterTerrorists: 4 })

      const state = stateManager.getServerState(1)
      expect(state.teamCounts.counterTerrorists).toBe(4)
    })

    it("should update spectator count", () => {
      stateManager.updatePlayerCounts(1, { spectators: 2 })

      const state = stateManager.getServerState(1)
      expect(state.teamCounts.spectators).toBe(2)
    })

    it("should update multiple counts at once", () => {
      stateManager.updatePlayerCounts(1, {
        terrorists: 5,
        counterTerrorists: 5,
        spectators: 3,
      })

      const state = stateManager.getServerState(1)
      expect(state.teamCounts.terrorists).toBe(5)
      expect(state.teamCounts.counterTerrorists).toBe(5)
      expect(state.teamCounts.spectators).toBe(3)
    })

    it("should notify listeners on player count change", () => {
      const listener = vi.fn()
      stateManager.onStateChange(listener)

      stateManager.updatePlayerCounts(1, { terrorists: 5 })

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 1,
          changeType: "player_count",
        }),
      )
    })
  })

  describe("setMaxPlayers", () => {
    it("should set max players for server", () => {
      stateManager.setMaxPlayers(1, 32)

      const state = stateManager.getServerState(1)
      expect(state.maxPlayers).toBe(32)
    })
  })

  describe("setMatchState", () => {
    it("should set match state", () => {
      stateManager.setMatchState(1, "active")

      const state = stateManager.getServerState(1)
      expect(state.matchState).toBe("active")
    })

    it("should log match state change", () => {
      stateManager.setMatchState(1, "ended")

      expect(mockLogger.debug).toHaveBeenCalledWith("Match state changed for server 1", {
        matchState: "ended",
      })
    })
  })

  describe("clearServerState", () => {
    it("should remove server state", () => {
      stateManager.getServerState(1) // Create state
      stateManager.clearServerState(1)

      expect(stateManager.getActiveServers()).not.toContain(1)
    })

    it("should log when state is cleared", () => {
      stateManager.getServerState(1)
      stateManager.clearServerState(1)

      expect(mockLogger.debug).toHaveBeenCalledWith("Cleared state for server 1")
    })
  })

  describe("getActiveServers", () => {
    it("should return all server IDs with state", () => {
      stateManager.getServerState(1)
      stateManager.getServerState(2)
      stateManager.getServerState(5)

      const activeServers = stateManager.getActiveServers()

      expect(activeServers).toContain(1)
      expect(activeServers).toContain(2)
      expect(activeServers).toContain(5)
      expect(activeServers).toHaveLength(3)
    })
  })

  describe("onStateChange", () => {
    it("should register listener and receive events", () => {
      const listener = vi.fn()
      stateManager.onStateChange(listener)

      stateManager.startRound(1)

      expect(listener).toHaveBeenCalled()
    })

    it("should return unsubscribe function", () => {
      const listener = vi.fn()
      const unsubscribe = stateManager.onStateChange(listener)

      unsubscribe()
      stateManager.startRound(1)

      expect(listener).not.toHaveBeenCalled()
    })

    it("should handle listener errors gracefully", () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error("Listener error")
      })
      stateManager.onStateChange(errorListener)

      stateManager.startRound(1)

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error in state change listener",
        expect.objectContaining({ error: "Listener error" }),
      )
    })
  })

  describe("cleanupInactiveStates", () => {
    it("should remove states older than max age", () => {
      const oldTime = new Date("2024-01-01T12:00:00Z")
      const currentTime = new Date("2024-01-01T14:00:00Z")

      vi.setSystemTime(oldTime)
      stateManager.getServerState(1)

      vi.setSystemTime(currentTime)
      stateManager.cleanupInactiveStates(60) // 60 minute max age

      expect(stateManager.getActiveServers()).not.toContain(1)
    })

    it("should keep active states", () => {
      const now = new Date()
      vi.setSystemTime(now)

      stateManager.getServerState(1)
      stateManager.cleanupInactiveStates(60)

      expect(stateManager.getActiveServers()).toContain(1)
    })

    it("should log cleanup count", () => {
      const oldTime = new Date("2024-01-01T12:00:00Z")
      const currentTime = new Date("2024-01-01T14:00:00Z")

      vi.setSystemTime(oldTime)
      stateManager.getServerState(1)
      stateManager.getServerState(2)

      vi.setSystemTime(currentTime)
      stateManager.cleanupInactiveStates(60)

      expect(mockLogger.debug).toHaveBeenCalledWith("Cleaned up 2 inactive server states")
    })
  })

  describe("getStats", () => {
    it("should return state manager statistics", () => {
      stateManager.getServerState(1)
      stateManager.getServerState(2)
      stateManager.onStateChange(() => {})

      const stats = stateManager.getStats()

      expect(stats.activeServers).toBe(2)
      expect(stats.listeners).toBe(1)
    })
  })
})
