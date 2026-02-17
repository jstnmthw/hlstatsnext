/**
 * Weapon Repository Integration Tests
 *
 * Tests weapon stats upsert and lookup against a real MySQL database.
 */

import { GameConfig } from "@/config/game.config"
import { DatabaseClient } from "@/database/client"
import { WeaponRepository } from "@/modules/weapon/weapon.repository"
import type { ILogger } from "@/shared/utils/logger.types"
import type { Weapon } from "@repo/db/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTestDb } from "../helpers/test-db"

describe("WeaponRepository (integration)", () => {
  let repo: WeaponRepository
  let db: DatabaseClient
  const game = GameConfig.getDefaultGame()

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

    repo = new WeaponRepository(db, silentLogger)
  })

  describe("updateWeaponStats", () => {
    it("should create a weapon on first upsert", async () => {
      await repo.updateWeaponStats("ak47", {
        kills: { increment: 5 },
        headshots: { increment: 2 },
      })

      const weapon = (await getTestDb().weapon.findUnique({
        where: { gamecode: { game, code: "ak47" } },
      })) as Weapon | null
      expect(weapon).not.toBeNull()
      expect(weapon!.code).toBe("ak47")
      expect(weapon!.name).toBe("ak47")
    })

    it("should update existing weapon stats on subsequent upsert", async () => {
      // First upsert creates the weapon
      await repo.updateWeaponStats("m4a1", {
        kills: { increment: 3 },
        headshots: { increment: 1 },
      })

      // Second upsert increments
      await repo.updateWeaponStats("m4a1", {
        kills: { increment: 2 },
        headshots: { increment: 1 },
      })

      const weapon = (await getTestDb().weapon.findUnique({
        where: { gamecode: { game, code: "m4a1" } },
      })) as Weapon | null
      expect(weapon).not.toBeNull()
      expect(weapon!.kills).toBe(5) // 3 + 2
      expect(weapon!.headshots).toBe(2) // 1 + 1
    })
  })

  describe("findWeaponByCode", () => {
    it("should find a weapon by code", async () => {
      await getTestDb().weapon.create({
        data: {
          game,
          code: "awp",
          name: "AWP",
          modifier: 1.5,
          kills: 0,
          headshots: 0,
        },
      })

      const weapon = (await repo.findWeaponByCode("awp")) as Weapon | null
      expect(weapon).not.toBeNull()
      expect(weapon!.code).toBe("awp")
      expect(Number(weapon!.modifier)).toBe(1.5)
    })

    it("should return null for non-existent weapon", async () => {
      const weapon = await repo.findWeaponByCode("nonexistent_weapon")
      expect(weapon).toBeNull()
    })
  })
})
