/**
 * Match Repository Integration Tests
 *
 * Tests round tracking, map changes, player history, and server stats
 * against a real MySQL database.
 */

import { DatabaseClient } from "@/database/client"
import { MatchRepository } from "@/modules/match/match.repository"
import type { ILogger } from "@/shared/utils/logger.types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTestDb } from "../helpers/test-db"

describe("MatchRepository (integration)", () => {
  let repo: MatchRepository
  let db: DatabaseClient
  let serverId: number
  let playerId: number

  const silentLogger: ILogger = {
    ok: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    event: vi.fn(),
    queue: vi.fn(),
    database: vi.fn(),
    rcon: vi.fn(),
    network: vi.fn(),
    fatal: vi.fn(),
    getLogLevel: vi.fn().mockReturnValue("silent"),
    setLogLevel: vi.fn(),
    formatDuration: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as ILogger

  beforeEach(async () => {
    const testPrisma = getTestDb()
    db = new DatabaseClient()
    Object.defineProperty(db, "prisma", { get: () => testPrisma, configurable: true })
    db.transaction = (cb) => testPrisma.$transaction(cb)

    repo = new MatchRepository(db, silentLogger)

    const server = await testPrisma.server.create({
      data: {
        name: "Match Test Server",
        address: "10.0.0.1",
        port: 27015,
        game: "cstrike",
        activeMap: "de_dust2",
        mapRounds: 0,
        rounds: 0,
      },
    })
    serverId = server.serverId

    const player = await testPrisma.player.create({
      data: {
        lastName: "MatchPlayer",
        game: "cstrike",
        skill: 1000,
        createdAt: new Date(),
      },
    })
    playerId = player.playerId
  })

  describe("incrementServerRounds", () => {
    it("should increment both mapRounds and rounds", async () => {
      await repo.incrementServerRounds(serverId)
      await repo.incrementServerRounds(serverId)

      const server = await getTestDb().server.findUnique({ where: { serverId } })
      expect(server!.mapRounds).toBe(2)
      expect(server!.rounds).toBe(2)
    })
  })

  describe("resetMapStats", () => {
    it("should reset map counters and update active map", async () => {
      // First increment some rounds
      await repo.incrementServerRounds(serverId)
      await repo.incrementServerRounds(serverId)

      // Reset to a new map
      await repo.resetMapStats(serverId, "de_inferno")

      const server = await getTestDb().server.findUnique({ where: { serverId } })
      expect(server!.activeMap).toBe("de_inferno")
      expect(server!.mapRounds).toBe(0)
      expect(server!.mapCtWins).toBe(0)
      expect(server!.mapTsWins).toBe(0)
    })
  })

  describe("updateTeamWins", () => {
    it("should increment CT wins", async () => {
      await repo.updateTeamWins(serverId, "CT")

      const server = await getTestDb().server.findUnique({ where: { serverId } })
      expect(server!.ctWins).toBe(1)
      expect(server!.mapCtWins).toBe(1)
    })

    it("should increment T wins", async () => {
      await repo.updateTeamWins(serverId, "TERRORIST")

      const server = await getTestDb().server.findUnique({ where: { serverId } })
      expect(server!.tsWins).toBe(1)
      expect(server!.mapTsWins).toBe(1)
    })
  })

  describe("createPlayerHistory", () => {
    it("should create a new history entry", async () => {
      await repo.createPlayerHistory({
        playerId,
        eventTime: new Date(),
        game: "cstrike",
        kills: 10,
        deaths: 5,
        skill: 1050,
      })

      const history = await getTestDb().playerHistory.findMany({
        where: { playerId },
      })
      expect(history).toHaveLength(1)
      expect(history[0]!.kills).toBe(10)
      expect(history[0]!.deaths).toBe(5)
    })

    it("should aggregate same-day history entries", async () => {
      const today = new Date()

      await repo.createPlayerHistory({
        playerId,
        eventTime: today,
        game: "cstrike",
        kills: 5,
        deaths: 2,
        skill: 1020,
      })

      await repo.createPlayerHistory({
        playerId,
        eventTime: today,
        game: "cstrike",
        kills: 3,
        deaths: 1,
        skill: 1040,
      })

      const history = await getTestDb().playerHistory.findMany({
        where: { playerId },
      })
      // Should be aggregated into one row for the same day
      expect(history).toHaveLength(1)
      expect(history[0]!.kills).toBe(8) // 5 + 3
      expect(history[0]!.deaths).toBe(3) // 2 + 1
    })
  })

  describe("findServerById", () => {
    it("should find a server", async () => {
      const found = await repo.findServerById(serverId)
      expect(found).not.toBeNull()
      expect(found!.serverId).toBe(serverId)
    })

    it("should return null for non-existent server", async () => {
      const found = await repo.findServerById(999999)
      expect(found).toBeNull()
    })
  })

  describe("getPlayerSkill", () => {
    it("should return player skill", async () => {
      const skill = await repo.getPlayerSkill(playerId)
      expect(skill).toBe(1000)
    })

    it("should return null for non-existent player", async () => {
      const skill = await repo.getPlayerSkill(999999)
      expect(skill).toBeNull()
    })
  })

  describe("updateMapCount", () => {
    it("should upsert map kill/headshot counts", async () => {
      await repo.updateMapCount("cstrike", "de_dust2", 5, 2)
      await repo.updateMapCount("cstrike", "de_dust2", 3, 1)

      const mapCount = await getTestDb().mapCount.findUnique({
        where: { game_map: { game: "cstrike", map: "de_dust2" } },
      })
      expect(mapCount!.kills).toBe(8) // 5 + 3
      expect(mapCount!.headshots).toBe(3) // 2 + 1
    })
  })
})
