/**
 * WeaponService Unit Tests
 */

import type { DatabaseClient } from "@/database/client"
import type { WeaponFireEvent, WeaponHitEvent, WeaponEvent } from "./weapon.types"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { EventType } from "@/shared/types/events"
import { WeaponService } from "./weapon.service"
import { WeaponRepository } from "./weapon.repository"
import { createMockLogger } from "../../test-support/mocks/logger"
import { createMockDatabaseClient } from "../../test-support/mocks/database"

describe("WeaponService", () => {
  let weaponService: WeaponService
  let mockRepository: WeaponRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()
    mockRepository = new WeaponRepository(mockDatabase as unknown as DatabaseClient, mockLogger)
    weaponService = new WeaponService(mockRepository, mockLogger)
  })

  describe("Service instantiation", () => {
    it("should create service instance", () => {
      expect(weaponService).toBeDefined()
      expect(weaponService).toBeInstanceOf(WeaponService)
    })

    it("should have required methods", () => {
      expect(weaponService.handleWeaponEvent).toBeDefined()
      expect(weaponService.updateWeaponStats).toBeDefined()
      expect(typeof weaponService.handleWeaponEvent).toBe("function")
      expect(typeof weaponService.updateWeaponStats).toBe("function")
    })
  })

  describe("handleWeaponEvent", () => {
    it("should handle WEAPON_FIRE events", async () => {
      const weaponFireEvent: WeaponFireEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.WEAPON_FIRE,
        data: {
          playerId: 1,
          weaponCode: "ak47",
          weaponName: "AK-47",
          team: "terrorist",
        },
      }

      vi.spyOn(mockRepository, "updateWeaponStats").mockResolvedValue(undefined)

      const result = await weaponService.handleWeaponEvent(weaponFireEvent)

      expect(result.success).toBe(true)
      expect(result.affected).toBe(1)
      expect(mockRepository.updateWeaponStats).toHaveBeenCalledWith("ak47", {
        shots: { increment: 1 },
      })
    })

    it("should handle WEAPON_HIT events", async () => {
      const weaponHitEvent: WeaponHitEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.WEAPON_HIT,
        data: {
          playerId: 1,
          victimId: 2,
          weaponCode: "m4a1",
          weaponName: "M4A1",
          team: "ct",
          damage: 25,
        },
      }

      vi.spyOn(mockRepository, "updateWeaponStats").mockResolvedValue(undefined)

      const result = await weaponService.handleWeaponEvent(weaponHitEvent)

      expect(result.success).toBe(true)
      expect(result.affected).toBe(1)
      expect(mockRepository.updateWeaponStats).toHaveBeenCalledWith("m4a1", {
        hits: { increment: 1 },
        damage: { increment: 25 },
      })
    })

    it("should handle WEAPON_HIT events without damage", async () => {
      const weaponHitEvent: WeaponHitEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.WEAPON_HIT,
        data: {
          playerId: 1,
          weaponCode: "glock",
          team: "terrorist",
        },
      }

      vi.spyOn(mockRepository, "updateWeaponStats").mockResolvedValue(undefined)

      const result = await weaponService.handleWeaponEvent(weaponHitEvent)

      expect(result.success).toBe(true)
      expect(mockRepository.updateWeaponStats).toHaveBeenCalledWith("glock", {
        hits: { increment: 1 },
        damage: { increment: 0 },
      })
    })

    it("should handle unknown event types gracefully", async () => {
      const unknownEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: "UNKNOWN_WEAPON_EVENT" as EventType,
        data: {
          weaponCode: "knife",
        },
      } as WeaponEvent

      const result = await weaponService.handleWeaponEvent(unknownEvent)

      expect(result.success).toBe(true)
    })

    it("should handle errors in weapon fire events", async () => {
      const weaponFireEvent: WeaponFireEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.WEAPON_FIRE,
        data: {
          playerId: 1,
          weaponCode: "ak47",
          team: "terrorist",
        },
      }

      vi.spyOn(mockRepository, "updateWeaponStats").mockRejectedValue(new Error("Database error"))

      const result = await weaponService.handleWeaponEvent(weaponFireEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Database error")
    })

    it("should handle errors in weapon hit events", async () => {
      const weaponHitEvent: WeaponHitEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.WEAPON_HIT,
        data: {
          playerId: 1,
          weaponCode: "awp",
          team: "ct",
          damage: 100,
        },
      }

      vi.spyOn(mockRepository, "updateWeaponStats").mockRejectedValue(new Error("Update failed"))

      const result = await weaponService.handleWeaponEvent(weaponHitEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Update failed")
    })
  })

  describe("updateWeaponStats", () => {
    it("should update weapon shots", async () => {
      vi.spyOn(mockRepository, "updateWeaponStats").mockResolvedValue(undefined)

      await weaponService.updateWeaponStats("ak47", { shots: 5 })

      expect(mockRepository.updateWeaponStats).toHaveBeenCalledWith("ak47", {
        shots: { increment: 5 },
      })
    })

    it("should update weapon hits", async () => {
      vi.spyOn(mockRepository, "updateWeaponStats").mockResolvedValue(undefined)

      await weaponService.updateWeaponStats("m4a1", { hits: 3 })

      expect(mockRepository.updateWeaponStats).toHaveBeenCalledWith("m4a1", {
        hits: { increment: 3 },
      })
    })

    it("should update weapon damage", async () => {
      vi.spyOn(mockRepository, "updateWeaponStats").mockResolvedValue(undefined)

      await weaponService.updateWeaponStats("awp", { damage: 150 })

      expect(mockRepository.updateWeaponStats).toHaveBeenCalledWith("awp", {
        damage: { increment: 150 },
      })
    })

    it("should update multiple weapon stats", async () => {
      vi.spyOn(mockRepository, "updateWeaponStats").mockResolvedValue(undefined)

      await weaponService.updateWeaponStats("deagle", {
        shots: 10,
        hits: 7,
        damage: 350,
      })

      expect(mockRepository.updateWeaponStats).toHaveBeenCalledWith("deagle", {
        shots: { increment: 10 },
        hits: { increment: 7 },
        damage: { increment: 350 },
      })
    })

    it("should ignore undefined stats", async () => {
      vi.spyOn(mockRepository, "updateWeaponStats").mockResolvedValue(undefined)

      await weaponService.updateWeaponStats("glock", {
        shots: 5,
        hits: undefined,
        damage: 25,
      })

      expect(mockRepository.updateWeaponStats).toHaveBeenCalledWith("glock", {
        shots: { increment: 5 },
        damage: { increment: 25 },
      })
    })

    it("should handle zero values", async () => {
      vi.spyOn(mockRepository, "updateWeaponStats").mockResolvedValue(undefined)

      await weaponService.updateWeaponStats("knife", {
        shots: 0,
        hits: 0,
        damage: 0,
      })

      expect(mockRepository.updateWeaponStats).toHaveBeenCalledWith("knife", {
        shots: { increment: 0 },
        hits: { increment: 0 },
        damage: { increment: 0 },
      })
    })

    it("should handle repository errors and rethrow", async () => {
      vi.spyOn(mockRepository, "updateWeaponStats").mockRejectedValue(
        new Error("Database connection failed"),
      )

      await expect(weaponService.updateWeaponStats("ak47", { shots: 1 })).rejects.toThrow(
        "Database connection failed",
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to update weapon stats for ak47: Error: Database connection failed",
      )
    })

    it("should handle non-Error exceptions", async () => {
      vi.spyOn(mockRepository, "updateWeaponStats").mockRejectedValue("String error")

      await expect(weaponService.updateWeaponStats("m4a1", { hits: 1 })).rejects.toBe(
        "String error",
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to update weapon stats for m4a1: String error",
      )
    })
  })

  describe("Edge cases", () => {
    it("should handle very large stat values", async () => {
      vi.spyOn(mockRepository, "updateWeaponStats").mockResolvedValue(undefined)

      await weaponService.updateWeaponStats("test_weapon", {
        shots: 999999,
        hits: 888888,
        damage: 1000000,
      })

      expect(mockRepository.updateWeaponStats).toHaveBeenCalledWith("test_weapon", {
        shots: { increment: 999999 },
        hits: { increment: 888888 },
        damage: { increment: 1000000 },
      })
    })

    it("should handle negative stat values", async () => {
      vi.spyOn(mockRepository, "updateWeaponStats").mockResolvedValue(undefined)

      await weaponService.updateWeaponStats("test_weapon", {
        shots: -5,
        hits: -3,
        damage: -100,
      })

      expect(mockRepository.updateWeaponStats).toHaveBeenCalledWith("test_weapon", {
        shots: { increment: -5 },
        hits: { increment: -3 },
        damage: { increment: -100 },
      })
    })

    it("should handle empty weapon codes", async () => {
      vi.spyOn(mockRepository, "updateWeaponStats").mockResolvedValue(undefined)

      await weaponService.updateWeaponStats("", { shots: 1 })

      expect(mockRepository.updateWeaponStats).toHaveBeenCalledWith("", { shots: { increment: 1 } })
    })
  })
})
