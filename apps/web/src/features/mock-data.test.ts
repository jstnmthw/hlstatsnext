import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  getGameByCode,
  getPlayerById,
  getServerById,
  isOnline,
  MOCK_GAMES,
  MOCK_PLAYERS,
  MOCK_SERVERS,
} from "./mock-data"

describe("getServerById", () => {
  it("returns the server for a valid id", () => {
    const server = getServerById(1)
    expect(server).toBeDefined()
    expect(server!.serverId).toBe(1)
    expect(server!.name).toBe("Dust2 24/7 | Competitive")
  })

  it("returns undefined for invalid id", () => {
    expect(getServerById(999)).toBeUndefined()
  })
})

describe("getGameByCode", () => {
  it("returns the game for a valid code", () => {
    const game = getGameByCode("css")
    expect(game).toBeDefined()
    expect(game!.name).toBe("Counter-Strike: Source")
  })

  it("returns undefined for invalid code", () => {
    expect(getGameByCode("xxx")).toBeUndefined()
  })
})

describe("getPlayerById", () => {
  it("returns the player for a valid id", () => {
    const player = getPlayerById(1)
    expect(player).toBeDefined()
    expect(player!.lastName).toBe("FragMaster")
  })

  it("returns undefined for invalid id", () => {
    expect(getPlayerById(999)).toBeUndefined()
  })
})

describe("isOnline", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns true for dates within 5 minutes", () => {
    const recent = new Date("2025-06-15T11:56:00Z")
    expect(isOnline(recent)).toBe(true)
  })

  it("returns false for dates older than 5 minutes", () => {
    const old = new Date("2025-06-15T11:54:00Z")
    expect(isOnline(old)).toBe(false)
  })

  it("returns false for null", () => {
    expect(isOnline(null)).toBe(false)
  })
})

describe("mock data integrity", () => {
  it("has servers with required fields", () => {
    for (const server of MOCK_SERVERS) {
      expect(server.serverId).toBeGreaterThan(0)
      expect(server.name).toBeTruthy()
      expect(server.port).toBeGreaterThan(0)
      expect(server.game).toBeTruthy()
    }
  })

  it("has games with required fields", () => {
    for (const game of MOCK_GAMES) {
      expect(game.code).toBeTruthy()
      expect(game.name).toBeTruthy()
    }
  })

  it("has players with required fields", () => {
    for (const player of MOCK_PLAYERS) {
      expect(player.playerId).toBeGreaterThan(0)
      expect(player.lastName).toBeTruthy()
    }
  })
})
