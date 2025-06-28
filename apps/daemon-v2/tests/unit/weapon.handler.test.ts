import { describe, it, expect, vi, beforeEach } from "vitest"
import { WeaponHandler } from "../../src/services/processor/handlers/weapon.handler"
import { EventType, PlayerConnectEvent, PlayerKillEvent } from "../../src/types/common/events"

// Mock the weapon config
vi.mock("../../src/config/weapon-config", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    DEFAULT_SKILL_MULTIPLIER: 1.0,
    DEFAULT_BASE_DAMAGE: 20,
    getWeaponAttributes: vi.fn((weapon: string) => {
      if (weapon === "ak47") {
        return { baseDamage: 36, skillMultiplier: 1.0 }
      }
      if (weapon === "knife") {
        return { baseDamage: 65, skillMultiplier: 2.0 }
      }
      return { baseDamage: 20, skillMultiplier: 1.0 }
    }),
  }
})

// Extended WeaponHandler class to access private methods for testing
class TestableWeaponHandler extends WeaponHandler {
  constructor() {
    super()
  }

  // Expose private methods for testing
  public async updateWeaponAccuracyPublic(playerId: number, weapon: string, hit: boolean) {
    return this.updateWeaponAccuracy(playerId, weapon, hit)
  }

  public async getWeaponDamageMultiplierPublic(weapon: string, headshot: boolean) {
    return this.getWeaponDamageMultiplier(weapon, headshot)
  }

  public async handleWeaponKillPublic(event: PlayerKillEvent) {
    return this.handleWeaponKill(event)
  }
}

describe("WeaponHandler", () => {
  let handler: TestableWeaponHandler

  beforeEach(() => {
    handler = new TestableWeaponHandler()
    vi.clearAllMocks()
  })

  describe("handleEvent", () => {
    it("should call handleWeaponKill for PLAYER_KILL events", async () => {
      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: true,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      const result = await handler.handleEvent(killEvent)
      expect(result.success).toBe(true)
      expect(result.weaponsAffected).toEqual(["ak47"])
    })

    it("should handle headshot kills correctly", async () => {
      const headshotKill: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: true,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      const result = await handler.handleEvent(headshotKill)
      expect(result.success).toBe(true)
      expect(result.weaponsAffected).toContain("ak47")
    })

    it("should handle regular kills correctly", async () => {
      const regularKill: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "m4a1",
          headshot: false,
          killerTeam: "CT",
          victimTeam: "TERRORIST",
        },
      }

      const result = await handler.handleEvent(regularKill)
      expect(result.success).toBe(true)
      expect(result.weaponsAffected).toContain("m4a1")
    })

    it("should handle knife kills", async () => {
      const knifeKill: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "knife",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      const result = await handler.handleEvent(knifeKill)
      expect(result.success).toBe(true)
      expect(result.weaponsAffected).toContain("knife")
    })

    it("should ignore events other than PLAYER_KILL", async () => {
      const otherEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      } as PlayerConnectEvent

      const result = await handler.handleEvent(otherEvent)
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.weaponsAffected).toBeUndefined()
    })
  })

  describe("getWeaponDamageMultiplier", () => {
    it("should calculate correct damage for headshots", async () => {
      const ak47HeadshotDamage = await handler.getWeaponDamageMultiplierPublic("ak47", true)
      expect(ak47HeadshotDamage).toBe(36 * 4.0) // 144

      const knifeHeadshotDamage = await handler.getWeaponDamageMultiplierPublic("knife", true)
      expect(knifeHeadshotDamage).toBe(65 * 4.0) // 260
    })

    it("should calculate correct damage for body shots", async () => {
      const ak47BodyDamage = await handler.getWeaponDamageMultiplierPublic("ak47", false)
      expect(ak47BodyDamage).toBe(36) // Base damage

      const knifeBodyDamage = await handler.getWeaponDamageMultiplierPublic("knife", false)
      expect(knifeBodyDamage).toBe(65) // Base damage
    })

    it("should handle unknown weapons", async () => {
      const unknownWeaponDamage = await handler.getWeaponDamageMultiplierPublic("unknown_weapon", false)
      expect(unknownWeaponDamage).toBe(20) // Default base damage

      const unknownWeaponHeadshot = await handler.getWeaponDamageMultiplierPublic("unknown_weapon", true)
      expect(unknownWeaponHeadshot).toBe(20 * 4.0) // 80
    })
  })

  describe("updateWeaponAccuracy", () => {
    it("should handle accuracy updates", async () => {
      // This method is currently a TODO but we test it doesn't throw
      await expect(handler.updateWeaponAccuracyPublic(1, "ak47", true)).resolves.toBeUndefined()
      await expect(handler.updateWeaponAccuracyPublic(1, "ak47", false)).resolves.toBeUndefined()
    })

    it("should handle different weapons", async () => {
      const weapons = ["ak47", "m4a1", "awp", "glock", "knife"]

      for (const weapon of weapons) {
        await expect(handler.updateWeaponAccuracyPublic(1, weapon, true)).resolves.toBeUndefined()
        await expect(handler.updateWeaponAccuracyPublic(1, weapon, false)).resolves.toBeUndefined()
      }
    })
  })

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      // Mock an error in the database operation (future implementation)
      const handler = new WeaponHandler()

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      // Currently this doesn't throw errors, but test it doesn't crash
      const result = await handler.handleEvent(killEvent)
      expect(result.success).toBe(true)
    })

    it("should handle invalid weapon names", async () => {
      const invalidWeaponKill: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "", // Empty weapon name
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      const result = await handler.handleEvent(invalidWeaponKill)
      expect(result.success).toBe(true)
      expect(result.weaponsAffected).toContain("")
    })

    it("should handle null player IDs", async () => {
      const nullPlayerKill: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 0, // Invalid player ID
          victimId: 0, // Invalid player ID
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      const result = await handler.handleEvent(nullPlayerKill)
      expect(result.success).toBe(true)
    })
  })

  describe("Weapon Statistics", () => {
    it("should track different weapon types", async () => {
      const weapons = [
        { name: "ak47", category: "rifle" },
        { name: "awp", category: "sniper" },
        { name: "glock", category: "pistol" },
        { name: "knife", category: "melee" },
        { name: "hegrenade", category: "grenade" },
      ]

      for (const weapon of weapons) {
        const killEvent: PlayerKillEvent = {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(),
          data: {
            killerId: 1,
            victimId: 2,
            weapon: weapon.name,
            headshot: weapon.name !== "knife", // Knives typically don't headshot
            killerTeam: "TERRORIST",
            victimTeam: "CT",
          },
        }

        const result = await handler.handleEvent(killEvent)
        expect(result.success).toBe(true)
        expect(result.weaponsAffected).toContain(weapon.name)
      }
    })

    it("should handle rapid successive kills", async () => {
      const rapidKills = Array.from({ length: 10 }, (_, i) => ({
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(Date.now() + i * 100), // 100ms apart
        data: {
          killerId: 1,
          victimId: i + 2,
          weapon: "ak47",
          headshot: i % 2 === 0, // Alternate headshots
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      })) as PlayerKillEvent[]

      const results = await Promise.all(rapidKills.map((kill) => handler.handleEvent(kill)))

      results.forEach((result) => {
        expect(result.success).toBe(true)
        expect(result.weaponsAffected).toContain("ak47")
      })
    })
  })

  describe("Performance Tests", () => {
    it("should handle high-volume weapon events efficiently", async () => {
      const weaponEvents = Array.from({ length: 1000 }, (_, i) => ({
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: Math.floor(i / 10) + 1,
          victimId: (i % 10) + 100,
          weapon: ["ak47", "m4a1", "awp", "glock"][i % 4],
          headshot: i % 3 === 0,
          killerTeam: i % 2 === 0 ? "TERRORIST" : "CT",
          victimTeam: i % 2 === 0 ? "CT" : "TERRORIST",
        },
      })) as PlayerKillEvent[]

      const start = Date.now()
      const results = await Promise.all(weaponEvents.map((event) => handler.handleEvent(event)))
      const duration = Date.now() - start

      // Should process 1000 events in under 5 seconds
      expect(duration).toBeLessThan(5000)

      // All events should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true)
      })
    })
  })

  describe("Integration Scenarios", () => {
    it("should handle mixed weapon types in sequence", async () => {
      const mixedEvents: PlayerKillEvent[] = [
        {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(),
          data: {
            killerId: 1,
            victimId: 2,
            weapon: "ak47",
            headshot: true,
            killerTeam: "TERRORIST",
            victimTeam: "CT",
          },
        },
        {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(),
          data: {
            killerId: 2,
            victimId: 3,
            weapon: "knife",
            headshot: false,
            killerTeam: "CT",
            victimTeam: "TERRORIST",
          },
        },
        {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(),
          data: {
            killerId: 3,
            victimId: 1,
            weapon: "awp",
            headshot: true,
            killerTeam: "TERRORIST",
            victimTeam: "CT",
          },
        },
      ]

      const results = await Promise.all(mixedEvents.map((event) => handler.handleEvent(event)))

      expect(results).toHaveLength(3)
      results.forEach((result) => expect(result.success).toBe(true))

      const allWeapons = results.flatMap((r) => r.weaponsAffected || [])
      expect(allWeapons).toContain("ak47")
      expect(allWeapons).toContain("knife")
      expect(allWeapons).toContain("awp")
    })
  })
})
