import { describe, it, expect, vi, beforeEach } from "vitest"
import { WeaponService } from "../../src/services/weapon/weapon.service"
import type { DatabaseClient } from "../../src/database/client"

// Re-use the default weapon-config for fallback assertions
import { getWeaponAttributes, DEFAULT_SKILL_MULTIPLIER } from "../../src/config/weapon-config"

// Helper to build a mock DatabaseClient that implements required methods
function createDbMock() {
  const spies = {
    getWeaponModifier: vi.fn(),
  } as const

  // Cast minimal implementation to DatabaseClient for typing purposes
  const db = {
    prisma: {},
    getWeaponModifier: spies.getWeaponModifier,
  } as unknown as DatabaseClient

  return { db, spies }
}

describe("WeaponService", () => {
  let dbMock: ReturnType<typeof createDbMock>
  let service: WeaponService

  beforeEach(() => {
    dbMock = createDbMock()
    service = new WeaponService(dbMock.db)
  })

  describe("getSkillMultiplier", () => {
    it("fetches multiplier from database when available", async () => {
      dbMock.spies.getWeaponModifier.mockResolvedValueOnce(1.4) // value from DB

      const result = await service.getSkillMultiplier("csgo", "awp")
      expect(result).toBeCloseTo(1.4)
      expect(dbMock.spies.getWeaponModifier).toHaveBeenCalledTimes(1)
    })

    it("caches the multiplier to avoid duplicate DB lookups", async () => {
      dbMock.spies.getWeaponModifier.mockResolvedValueOnce(1.2)

      const first = await service.getSkillMultiplier("csgo", "ak47")
      const second = await service.getSkillMultiplier("csgo", "ak47")

      expect(first).toBeCloseTo(1.2)
      expect(second).toBeCloseTo(1.2)
      expect(dbMock.spies.getWeaponModifier).toHaveBeenCalledTimes(1) // cached on second call
    })

    it("falls back to static config when DB returns null", async () => {
      dbMock.spies.getWeaponModifier.mockResolvedValueOnce(null)

      const fallback = await service.getSkillMultiplier("csgo", "ak47")
      const { skillMultiplier } = getWeaponAttributes("ak47", "csgo")

      expect(fallback).toBeCloseTo(skillMultiplier ?? DEFAULT_SKILL_MULTIPLIER)
    })

    it("resolves game aliases (e.g., cstrike → csgo)", async () => {
      dbMock.spies.getWeaponModifier.mockResolvedValueOnce(1.3)

      const result = await service.getSkillMultiplier("cstrike", "awp")

      expect(result).toBeCloseTo(1.3)
      // Ensure alias was resolved so DB got canonical game id
      expect(dbMock.spies.getWeaponModifier).toHaveBeenCalledWith("csgo", "awp")
    })
  })

  describe("getDamageMultiplier", () => {
    it("calculates correct damage for headshots", async () => {
      const ak47HeadshotDamage = await service.getDamageMultiplier("ak47", true)
      const { baseDamage } = getWeaponAttributes("ak47")
      expect(ak47HeadshotDamage).toBe(baseDamage * 4.0)
    })

    it("calculates correct damage for body shots", async () => {
      const ak47BodyDamage = await service.getDamageMultiplier("ak47", false)
      const { baseDamage } = getWeaponAttributes("ak47")
      expect(ak47BodyDamage).toBe(baseDamage)
    })

    it("handles unknown weapons with default damage", async () => {
      const unknownWeaponDamage = await service.getDamageMultiplier("unknown_weapon", false)
      const { baseDamage } = getWeaponAttributes("unknown_weapon")
      expect(unknownWeaponDamage).toBe(baseDamage)
    })
  })

  describe("cache management", () => {
    it("clears cache when requested", async () => {
      // Populate cache
      await service.getSkillMultiplier("csgo", "ak47")
      expect(service.getCacheSize()).toBeGreaterThan(0)

      // Clear cache
      service.clearCache()
      expect(service.getCacheSize()).toBe(0)
    })

    it("tracks cache size correctly", async () => {
      expect(service.getCacheSize()).toBe(0)

      await service.getSkillMultiplier("csgo", "ak47")
      expect(service.getCacheSize()).toBe(1)

      await service.getSkillMultiplier("csgo", "awp")
      expect(service.getCacheSize()).toBe(2)
    })
  })
})
