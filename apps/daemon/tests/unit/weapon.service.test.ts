import { describe, it, expect, beforeEach } from "vitest"
import { WeaponService } from "../../src/services/weapon/weapon.service"
import { createMockDatabaseClient, createMockLogger } from "../types/test-mocks"
import type { DatabaseClient } from "../../src/database/client"

// Re-use the default weapon-config for fallback assertions
import { getWeaponAttributes } from "../../src/config/weapon-config"

// Helper to build a mock DatabaseClient that implements required methods
function createDbMock() {
  const mockDb = createMockDatabaseClient()

  return {
    db: mockDb as unknown as DatabaseClient,
    spies: {
      weaponFindFirst: mockDb.prisma.weapon.findFirst,
    },
  }
}

describe("WeaponService", () => {
  let service: WeaponService
  let dbMock: ReturnType<typeof createDbMock>
  const loggerMock = createMockLogger()

  beforeEach(() => {
    dbMock = createDbMock()
    service = new WeaponService(dbMock.db, loggerMock)
    service.clearCache() // Ensure cache is clean before each test
  })

  describe("getSkillMultiplier", () => {
    it("fetches multiplier from database when available", async () => {
      // Mock DB response
      dbMock.spies.weaponFindFirst.mockResolvedValueOnce({ modifier: 1.4 })

      const result = await service.getSkillMultiplier("csgo", "awp")
      expect(result).toBeCloseTo(1.4)
      expect(dbMock.spies.weaponFindFirst).toHaveBeenCalledTimes(1)
    })

    it("caches the multiplier to avoid duplicate DB lookups", async () => {
      dbMock.spies.weaponFindFirst.mockResolvedValueOnce({ modifier: 1.2 })

      const first = await service.getSkillMultiplier("csgo", "ak47")
      const second = await service.getSkillMultiplier("csgo", "ak47")

      expect(first).toBeCloseTo(1.2)
      expect(second).toBeCloseTo(1.2)
      expect(dbMock.spies.weaponFindFirst).toHaveBeenCalledTimes(1) // cached on second call
    })

    it("falls back to static config when DB returns null", async () => {
      dbMock.spies.weaponFindFirst.mockResolvedValueOnce(null)

      const result = await service.getSkillMultiplier("csgo", "ak47")

      // Should fall back to static config
      const { skillMultiplier } = getWeaponAttributes("ak47", "csgo")
      expect(result).toBeCloseTo(skillMultiplier)
    })

    it("handles database errors gracefully", async () => {
      const dbError = new Error("DB connection failed")
      dbMock.spies.weaponFindFirst.mockRejectedValue(dbError)
      const multiplier = await service.getSkillMultiplier("csgo", "awp")
      // Should not throw, but log an error and return default
      expect(loggerMock.error).toHaveBeenCalledWith(
        `Failed to fetch weapon modifier for csgo:awp: ${dbError}`,
      )
      expect(multiplier).toBe(1.0) // Default skill multiplier
    })

    it("resolves game aliases (e.g., cstrike → csgo)", async () => {
      dbMock.spies.weaponFindFirst.mockResolvedValueOnce({ modifier: 1.3 })

      const result = await service.getSkillMultiplier("cstrike", "awp")

      expect(result).toBeCloseTo(1.3)
      // Ensure alias was resolved so DB got canonical game id
      expect(dbMock.spies.weaponFindFirst).toHaveBeenCalledWith({
        where: { game: "csgo", code: "awp" },
        select: { modifier: true },
      })
    })
  })

  describe("getDamageMultiplier", () => {
    it("calculates correct damage for headshots", async () => {
      const result = await service.getDamageMultiplier("ak47", true)
      const { baseDamage } = getWeaponAttributes("ak47")
      expect(result).toBeCloseTo(baseDamage * 4.0) // 4x headshot multiplier
    })

    it("calculates correct damage for body shots", async () => {
      const result = await service.getDamageMultiplier("ak47", false)
      const { baseDamage } = getWeaponAttributes("ak47")
      expect(result).toBeCloseTo(baseDamage * 1.0) // 1x body shot multiplier
    })

    it("handles unknown weapons with default damage", async () => {
      const result = await service.getDamageMultiplier("unknown_weapon", false)
      expect(result).toBeGreaterThan(0) // Should return some default damage
    })
  })

  describe("cache management", () => {
    it("clears cache when requested", async () => {
      dbMock.spies.weaponFindFirst.mockResolvedValue({ modifier: 1.5 })

      // Populate cache
      await service.getSkillMultiplier("csgo", "m4a1")
      expect(service.getCacheSize()).toBe(1)

      // Clear cache
      service.clearCache()
      expect(service.getCacheSize()).toBe(0)

      // Should hit DB again after cache clear
      await service.getSkillMultiplier("csgo", "m4a1")
      expect(dbMock.spies.weaponFindFirst).toHaveBeenCalledTimes(2)
      expect(loggerMock.info).toHaveBeenCalledWith("Weapon service cache cleared")
    })

    it("tracks cache size correctly", async () => {
      dbMock.spies.weaponFindFirst.mockResolvedValue({ modifier: 1.0 })

      expect(service.getCacheSize()).toBe(0)

      await service.getSkillMultiplier("csgo", "glock")
      expect(service.getCacheSize()).toBe(1)

      await service.getSkillMultiplier("csgo", "usp")
      expect(service.getCacheSize()).toBe(2)
    })
  })
})
