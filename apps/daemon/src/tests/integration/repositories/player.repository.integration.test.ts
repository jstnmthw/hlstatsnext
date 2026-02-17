/**
 * Player Repository Integration Tests
 *
 * Tests player CRUD, upsert, batch operations, and event logging
 * against a real MySQL database.
 */

import { DatabaseClient } from "@/database/client"
import { PlayerRepository } from "@/modules/player/repositories/player.repository"
import type { ILogger } from "@/shared/utils/logger.types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTestDb } from "../helpers/test-db"

describe("PlayerRepository (integration)", () => {
  let repo: PlayerRepository
  let db: DatabaseClient
  let serverId: number

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
    // Create a DatabaseClient that uses the test PrismaClient
    db = new DatabaseClient()
    // Override the prisma getter to use our test DB
    const testPrisma = getTestDb()
    Object.defineProperty(db, "prisma", { get: () => testPrisma, configurable: true })
    db.transaction = (cb) => testPrisma.$transaction(cb)

    repo = new PlayerRepository(db, silentLogger)

    // Create a server for FK references
    const server = await testPrisma.server.create({
      data: {
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
        game: "cstrike",
      },
    })
    serverId = server.serverId
  })

  describe("create", () => {
    it("should create a player with a unique ID", async () => {
      const player = await repo.create({
        lastName: "TestPlayer",
        game: "cstrike",
        steamId: "STEAM_0:1:12345",
      })

      expect(player).toBeDefined()
      expect(player.playerId).toBeGreaterThan(0)
      expect(player.lastName).toBe("TestPlayer")
      expect(player.game).toBe("cstrike")
      expect(player.skill).toBe(1000) // default
    })

    it("should create a player with custom skill", async () => {
      const player = await repo.create({
        lastName: "ProPlayer",
        game: "cstrike",
        steamId: "STEAM_0:1:99999",
        skill: 1500,
      })

      expect(player.skill).toBe(1500)
    })
  })

  describe("findById", () => {
    it("should find a player by ID", async () => {
      const created = await repo.create({
        lastName: "FindMe",
        game: "cstrike",
        steamId: "STEAM_0:1:11111",
      })

      const found = await repo.findById(created.playerId)
      expect(found).not.toBeNull()
      expect(found!.playerId).toBe(created.playerId)
      expect(found!.lastName).toBe("FindMe")
    })

    it("should return null for non-existent player", async () => {
      const found = await repo.findById(999999)
      expect(found).toBeNull()
    })
  })

  describe("findByUniqueId", () => {
    it("should find a player by Steam ID and game", async () => {
      const created = await repo.create({
        lastName: "SteamPlayer",
        game: "cstrike",
        steamId: "STEAM_0:0:54321",
      })

      const found = await repo.findByUniqueId("STEAM_0:0:54321", "cstrike")
      expect(found).not.toBeNull()
      expect(found!.playerId).toBe(created.playerId)
    })

    it("should return null for wrong game", async () => {
      await repo.create({
        lastName: "SteamPlayer",
        game: "cstrike",
        steamId: "STEAM_0:0:77777",
      })

      const found = await repo.findByUniqueId("STEAM_0:0:77777", "csgo")
      expect(found).toBeNull()
    })
  })

  describe("upsertPlayer", () => {
    it("should create a new player on first upsert", async () => {
      const player = await repo.upsertPlayer({
        lastName: "UpsertNew",
        game: "cstrike",
        steamId: "STEAM_0:1:55555",
      })

      expect(player).toBeDefined()
      expect(player.lastName).toBe("UpsertNew")
    })

    it("should update existing player on second upsert", async () => {
      await repo.upsertPlayer({
        lastName: "OriginalName",
        game: "cstrike",
        steamId: "STEAM_0:1:66666",
      })

      const updated = await repo.upsertPlayer({
        lastName: "UpdatedName",
        game: "cstrike",
        steamId: "STEAM_0:1:66666",
      })

      expect(updated.lastName).toBe("UpdatedName")
    })
  })

  describe("update", () => {
    it("should update player stats with increment", async () => {
      const player = await repo.create({
        lastName: "StatsPlayer",
        game: "cstrike",
        steamId: "STEAM_0:1:33333",
      })

      const updated = await repo.update(player.playerId, {
        kills: { increment: 5 } as never,
        deaths: { increment: 3 } as never,
      })

      expect(updated.kills).toBe(5)
      expect(updated.deaths).toBe(3)
    })

    it("should handle skill underflow by clamping to zero", async () => {
      const player = await repo.create({
        lastName: "LowSkill",
        game: "cstrike",
        steamId: "STEAM_0:1:44444",
        skill: 100,
      })

      // Try to decrement skill below zero (unsigned column)
      const updated = await repo.update(player.playerId, {
        skill: { increment: -200 } as never,
      })

      expect(updated.skill).toBe(0)
    })
  })

  describe("logEventFrag", () => {
    it("should log a frag event", async () => {
      const killer = await repo.create({
        lastName: "Killer",
        game: "cstrike",
        steamId: "STEAM_0:1:10001",
      })
      const victim = await repo.create({
        lastName: "Victim",
        game: "cstrike",
        steamId: "STEAM_0:1:10002",
      })

      await repo.logEventFrag(
        killer.playerId,
        victim.playerId,
        serverId,
        "de_dust2",
        "ak47",
        true, // headshot
      )

      // Verify frag was recorded
      const frags = await getTestDb().eventFrag.findMany({
        where: { killerId: killer.playerId, victimId: victim.playerId },
      })
      expect(frags).toHaveLength(1)
      expect(frags[0]!.weapon).toBe("ak47")
      expect(frags[0]!.headshot).toBe(1)
      expect(frags[0]!.map).toBe("de_dust2")
    })
  })

  describe("batch operations", () => {
    it("should find multiple players by ID", async () => {
      const p1 = await repo.create({
        lastName: "Batch1",
        game: "cstrike",
        steamId: "STEAM_0:1:20001",
      })
      const p2 = await repo.create({
        lastName: "Batch2",
        game: "cstrike",
        steamId: "STEAM_0:1:20002",
      })

      const result = await repo.findManyById([p1.playerId, p2.playerId])
      expect(result.size).toBe(2)
      expect(result.get(p1.playerId)!.lastName).toBe("Batch1")
      expect(result.get(p2.playerId)!.lastName).toBe("Batch2")
    })

    it("should return empty map for empty input", async () => {
      const result = await repo.findManyById([])
      expect(result.size).toBe(0)
    })
  })

  describe("event creation", () => {
    it("should create a chat event", async () => {
      const player = await repo.create({
        lastName: "Chatter",
        game: "cstrike",
        steamId: "STEAM_0:1:30001",
      })

      await repo.createChatEvent(player.playerId, serverId, "de_dust2", "Hello world", 0)

      const chats = await getTestDb().eventChat.findMany({
        where: { playerId: player.playerId },
      })
      expect(chats).toHaveLength(1)
      expect(chats[0]!.message).toBe("Hello world")
    })

    it("should create connect and disconnect events", async () => {
      const player = await repo.create({
        lastName: "Connector",
        game: "cstrike",
        steamId: "STEAM_0:1:30002",
      })

      await repo.createConnectEvent(player.playerId, serverId, "de_dust2", "192.168.1.100:27005")
      await repo.createDisconnectEvent(player.playerId, serverId, "de_dust2")

      const connects = await getTestDb().eventConnect.findMany({
        where: { playerId: player.playerId },
      })
      const disconnects = await getTestDb().eventDisconnect.findMany({
        where: { playerId: player.playerId },
      })

      expect(connects).toHaveLength(1)
      expect(disconnects).toHaveLength(1)
    })
  })

  describe("getPlayerRank", () => {
    it("should return rank based on skill", async () => {
      await repo.create({
        lastName: "High",
        game: "cstrike",
        steamId: "STEAM_0:1:40001",
        skill: 2000,
      })
      const mid = await repo.create({
        lastName: "Mid",
        game: "cstrike",
        steamId: "STEAM_0:1:40002",
        skill: 1500,
      })
      await repo.create({
        lastName: "Low",
        game: "cstrike",
        steamId: "STEAM_0:1:40003",
        skill: 1000,
      })

      const rank = await repo.getPlayerRank(mid.playerId)
      expect(rank).toBe(2) // second highest
    })
  })

  describe("getTotalPlayerCount", () => {
    it("should count all players", async () => {
      await repo.create({ lastName: "P1", game: "cstrike", steamId: "STEAM_0:1:50001" })
      await repo.create({ lastName: "P2", game: "cstrike", steamId: "STEAM_0:1:50002" })

      const count = await repo.getTotalPlayerCount()
      expect(count).toBe(2)
    })
  })
})
