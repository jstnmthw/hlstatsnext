import { describe, it, expect, vi, beforeEach } from "vitest"
import { WeaponService } from "../../src/services/weapon/weapon.service"
import type { DatabaseClient } from "../../src/database/client"

// Re-use the default weapon-config for fallback assertions
import { getWeaponAttributes, DEFAULT_SKILL_MULTIPLIER } from "../../src/config/weapon-config"

// Helper to build a mock DatabaseClient that only implements getWeaponModifier
function createDbMock(): { db: DatabaseClient; spy: ReturnType<typeof vi.fn> } {
  const spy = vi.fn()
  // Cast minimal implementation to DatabaseClient for typing purposes
  const db = { getWeaponModifier: spy } as unknown as DatabaseClient
  return { db, spy }
}

describe("WeaponService", () => {
  let dbMock: ReturnType<typeof createDbMock>
  let service: WeaponService

  beforeEach(() => {
    dbMock = createDbMock()
    service = new WeaponService(dbMock.db)
  })

  it("fetches multiplier from database when available", async () => {
    dbMock.spy.mockResolvedValueOnce(1.4) // value from DB

    const result = await service.getSkillMultiplier("csgo", "awp")
    expect(result).toBeCloseTo(1.4)
    expect(dbMock.spy).toHaveBeenCalledTimes(1)
  })

  it("caches the multiplier to avoid duplicate DB lookups", async () => {
    dbMock.spy.mockResolvedValueOnce(1.2)

    const first = await service.getSkillMultiplier("csgo", "ak47")
    const second = await service.getSkillMultiplier("csgo", "ak47")

    expect(first).toBeCloseTo(1.2)
    expect(second).toBeCloseTo(1.2)
    expect(dbMock.spy).toHaveBeenCalledTimes(1) // cached on second call
  })

  it("falls back to static config when DB returns null", async () => {
    dbMock.spy.mockResolvedValueOnce(null)

    const fallback = await service.getSkillMultiplier("csgo", "ak47")
    const { skillMultiplier } = getWeaponAttributes("ak47", "csgo")

    expect(fallback).toBeCloseTo(skillMultiplier ?? DEFAULT_SKILL_MULTIPLIER)
  })

  it("resolves game aliases (e.g., cstrike → csgo)", async () => {
    dbMock.spy.mockResolvedValueOnce(1.3)

    const result = await service.getSkillMultiplier("cstrike", "awp")

    expect(result).toBeCloseTo(1.3)
    // Ensure alias was resolved so DB got canonical game id
    expect(dbMock.spy).toHaveBeenCalledWith("csgo", "awp")
  })
})
