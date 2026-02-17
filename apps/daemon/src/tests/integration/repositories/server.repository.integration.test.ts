/**
 * Server Repository Integration Tests
 *
 * Tests server lookups, config retrieval, and RCON credential checks
 * against a real MySQL database.
 */

import { DatabaseClient } from "@/database/client"
import { ServerRepository } from "@/modules/server/server.repository"
import type { ILogger } from "@/shared/utils/logger.types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTestDb } from "../helpers/test-db"

describe("ServerRepository (integration)", () => {
  let repo: ServerRepository
  let db: DatabaseClient

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

    repo = new ServerRepository(db, silentLogger)
  })

  describe("findById", () => {
    it("should find a server by ID", async () => {
      const server = await getTestDb().server.create({
        data: {
          name: "Find Test",
          address: "192.168.1.1",
          port: 27015,
          game: "cstrike",
        },
      })

      const found = await repo.findById(server.serverId)
      expect(found).not.toBeNull()
      expect(found!.name).toBe("Find Test")
      expect(found!.game).toBe("cstrike")
    })

    it("should return null for non-existent server", async () => {
      const found = await repo.findById(999999)
      expect(found).toBeNull()
    })
  })

  describe("findByAddress", () => {
    it("should find a server by address and port", async () => {
      await getTestDb().server.create({
        data: {
          name: "Address Test",
          address: "10.0.0.50",
          port: 27016,
          game: "csgo",
        },
      })

      const found = await repo.findByAddress("10.0.0.50", 27016)
      expect(found).not.toBeNull()
      expect(found!.name).toBe("Address Test")
    })

    it("should return null for wrong port", async () => {
      await getTestDb().server.create({
        data: {
          name: "Port Test",
          address: "10.0.0.51",
          port: 27015,
          game: "cstrike",
        },
      })

      const found = await repo.findByAddress("10.0.0.51", 27016)
      expect(found).toBeNull()
    })
  })

  describe("getServerConfig", () => {
    it("should return server-specific config", async () => {
      const server = await getTestDb().server.create({
        data: {
          name: "Config Test",
          address: "10.0.0.60",
          port: 27015,
          game: "cstrike",
        },
      })

      await getTestDb().serverConfig.create({
        data: {
          serverId: server.serverId,
          parameter: "MinPlayers",
          value: "5",
        },
      })

      const value = await repo.getServerConfig(server.serverId, "MinPlayers")
      expect(value).toBe("5")
    })

    it("should fall back to defaults when no server config exists", async () => {
      const server = await getTestDb().server.create({
        data: {
          name: "Default Config Test",
          address: "10.0.0.61",
          port: 27015,
          game: "cstrike",
        },
      })

      // "MinPlayers" default was seeded with value "0"
      const value = await repo.getServerConfig(server.serverId, "MinPlayers")
      expect(value).toBe("0")
    })

    it("should return null for unknown parameter", async () => {
      const server = await getTestDb().server.create({
        data: {
          name: "Unknown Config Test",
          address: "10.0.0.62",
          port: 27015,
          game: "cstrike",
        },
      })

      const value = await repo.getServerConfig(server.serverId, "NonExistentParam")
      expect(value).toBeNull()
    })
  })

  describe("findActiveServersWithRcon", () => {
    it("should return servers with RCON and recent activity", async () => {
      await getTestDb().server.create({
        data: {
          name: "RCON Server",
          address: "10.0.0.70",
          port: 27015,
          game: "cstrike",
          rconPassword: "secret123",
          lastEvent: new Date(), // now = active
        },
      })

      await getTestDb().server.create({
        data: {
          name: "No RCON Server",
          address: "10.0.0.71",
          port: 27015,
          game: "cstrike",
          rconPassword: "",
          lastEvent: new Date(),
        },
      })

      const servers = await repo.findActiveServersWithRcon(60)
      expect(servers.length).toBe(1)
      expect(servers[0]!.name).toBe("RCON Server")
    })

    it("should exclude servers with old lastEvent", async () => {
      const oldDate = new Date(Date.now() - 120 * 60 * 1000) // 2 hours ago
      await getTestDb().server.create({
        data: {
          name: "Stale Server",
          address: "10.0.0.72",
          port: 27015,
          game: "cstrike",
          rconPassword: "secret",
          lastEvent: oldDate,
        },
      })

      const servers = await repo.findActiveServersWithRcon(60) // 60 min window
      expect(servers.length).toBe(0)
    })
  })

  describe("hasRconCredentials", () => {
    it("should return true for server with RCON password", async () => {
      const server = await getTestDb().server.create({
        data: {
          name: "RCON Test",
          address: "10.0.0.80",
          port: 27015,
          game: "cstrike",
          rconPassword: "mypassword",
        },
      })

      const has = await repo.hasRconCredentials(server.serverId)
      expect(has).toBe(true)
    })

    it("should return false for server without RCON password", async () => {
      const server = await getTestDb().server.create({
        data: {
          name: "No RCON",
          address: "10.0.0.81",
          port: 27015,
          game: "cstrike",
          rconPassword: "",
        },
      })

      const has = await repo.hasRconCredentials(server.serverId)
      expect(has).toBe(false)
    })
  })

  describe("updateServerStatusFromRcon", () => {
    it("should update server status fields", async () => {
      const server = await getTestDb().server.create({
        data: {
          name: "Status Test",
          address: "10.0.0.90",
          port: 27015,
          game: "cstrike",
        },
      })

      await repo.updateServerStatusFromRcon(server.serverId, {
        activePlayers: 12,
        maxPlayers: 32,
        activeMap: "de_nuke",
        hostname: "Updated Name",
      })

      const updated = await getTestDb().server.findUnique({
        where: { serverId: server.serverId },
      })
      expect(updated!.activePlayers).toBe(12)
      expect(updated!.maxPlayers).toBe(32)
      expect(updated!.activeMap).toBe("de_nuke")
      expect(updated!.name).toBe("Updated Name")
    })
  })
})
