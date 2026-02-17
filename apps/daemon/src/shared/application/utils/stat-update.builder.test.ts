/**
 * StatUpdateBuilder Unit Tests
 */

import { describe, expect, it } from "vitest"
import { StatUpdateBuilder } from "./stat-update.builder"

describe("StatUpdateBuilder", () => {
  describe("create", () => {
    it("should create a new builder instance", () => {
      const builder = StatUpdateBuilder.create()
      expect(builder).toBeInstanceOf(StatUpdateBuilder)
      expect(builder.hasUpdates()).toBe(false)
    })
  })

  describe("addKills", () => {
    it("should add kill increment", () => {
      const builder = StatUpdateBuilder.create()
      builder.addKills(5)

      const result = builder.build()
      expect(result.kills).toEqual({ increment: 5 })
    })

    it("should ignore zero or negative kills", () => {
      const builder = StatUpdateBuilder.create()
      builder.addKills(0)
      builder.addKills(-5)

      expect(builder.hasUpdates()).toBe(false)
    })
  })

  describe("addSkillChange", () => {
    it("should add skill change with timestamp", () => {
      const builder = StatUpdateBuilder.create()
      builder.addSkillChange(25)

      const result = builder.build()
      expect(result.skill).toEqual({ increment: 25 })
      expect(result.lastSkillChange).toBeInstanceOf(Date)
    })

    it("should handle negative skill changes", () => {
      const builder = StatUpdateBuilder.create()
      builder.addSkillChange(-15)

      const result = builder.build()
      expect(result.skill).toEqual({ increment: -15 })
    })

    it("should ignore zero skill change", () => {
      const builder = StatUpdateBuilder.create()
      builder.addSkillChange(0)

      expect(builder.hasUpdates()).toBe(false)
    })
  })

  describe("setKillStreak", () => {
    it("should set kill streak value", () => {
      const builder = StatUpdateBuilder.create()
      builder.setKillStreak(10)

      const result = builder.build()
      expect(result.killStreak).toBe(10)
    })

    it("should enforce minimum value of 0", () => {
      const builder = StatUpdateBuilder.create()
      builder.setKillStreak(-5)

      const result = builder.build()
      expect(result.killStreak).toBe(0)
    })
  })

  describe("updateGeoInfo", () => {
    it("should update geographic information", () => {
      const builder = StatUpdateBuilder.create()
      const geoData = {
        city: "New York",
        country: "US",
        lat: 40.7128,
        lng: -74.006,
        lastAddress: "192.168.1.1",
      }

      builder.updateGeoInfo(geoData)

      const result = builder.build()
      expect(result.city).toBe("New York")
      expect(result.country).toBe("US")
      expect(result.lat).toBe(40.7128)
      expect(result.lng).toBe(-74.006)
      expect(result.lastAddress).toBe("192.168.1.1")
    })

    it("should handle partial geo data", () => {
      const builder = StatUpdateBuilder.create()
      builder.updateGeoInfo({ city: "London" })

      const result = builder.build()
      expect(result.city).toBe("London")
      expect(result.country).toBeUndefined()
    })
  })

  describe("resetStreaks", () => {
    it("should reset kill streak", () => {
      const builder = StatUpdateBuilder.create()
      builder.resetKillStreak()

      const result = builder.build()
      expect(result.killStreak).toBe(0)
    })

    it("should reset death streak", () => {
      const builder = StatUpdateBuilder.create()
      builder.resetDeathStreak()

      const result = builder.build()
      expect(result.deathStreak).toBe(0)
    })
  })

  describe("fluent interface", () => {
    it("should allow method chaining", () => {
      const result = StatUpdateBuilder.create()
        .addKills(2)
        .addDeaths(1)
        .addSkillChange(15)
        .setKillStreak(2)
        .resetDeathStreak()
        .updateLastEvent()
        .build()

      expect(result.kills).toEqual({ increment: 2 })
      expect(result.deaths).toEqual({ increment: 1 })
      expect(result.skill).toEqual({ increment: 15 })
      expect(result.killStreak).toBe(2)
      expect(result.deathStreak).toBe(0)
      expect(result.lastEvent).toBeInstanceOf(Date)
    })
  })

  describe("buildAsStatsUpdate", () => {
    it("should build validated PlayerStatsUpdate", () => {
      const builder = StatUpdateBuilder.create().addKills(1).addHeadshots(1).setKillStreak(5)

      const statsUpdate = builder.buildAsStatsUpdate()

      expect(statsUpdate.kills).toBe(1)
      expect(statsUpdate.headshots).toBe(1)
      expect(statsUpdate.killStreak).toBe(5)
    })
  })

  describe("error handling", () => {
    it("should throw error when building with no updates", () => {
      const builder = StatUpdateBuilder.create()

      expect(() => builder.build()).toThrow("No updates specified")
    })
  })

  describe("clear", () => {
    it("should clear all updates", () => {
      const builder = StatUpdateBuilder.create().addKills(1).addDeaths(1)

      expect(builder.hasUpdates()).toBe(true)

      builder.clear()
      expect(builder.hasUpdates()).toBe(false)
    })

    it("should return the builder for chaining", () => {
      const builder = StatUpdateBuilder.create()
      const returned = builder.clear()
      expect(returned).toBe(builder)
    })
  })

  // -------------------------------------------------------------------
  // addDeaths
  // -------------------------------------------------------------------
  describe("addDeaths", () => {
    it("should add death increment", () => {
      const result = StatUpdateBuilder.create().addDeaths(3).build()
      expect(result.deaths).toEqual({ increment: 3 })
    })

    it("should use default count of 1", () => {
      const result = StatUpdateBuilder.create().addDeaths().build()
      expect(result.deaths).toEqual({ increment: 1 })
    })

    it("should ignore zero or negative counts", () => {
      const builder = StatUpdateBuilder.create()
      builder.addDeaths(0)
      builder.addDeaths(-1)
      expect(builder.hasUpdates()).toBe(false)
    })
  })

  // -------------------------------------------------------------------
  // addSuicides
  // -------------------------------------------------------------------
  describe("addSuicides", () => {
    it("should add suicide increment", () => {
      const result = StatUpdateBuilder.create().addSuicides(2).build()
      expect(result.suicides).toEqual({ increment: 2 })
    })

    it("should use default count of 1", () => {
      const result = StatUpdateBuilder.create().addSuicides().build()
      expect(result.suicides).toEqual({ increment: 1 })
    })

    it("should ignore zero or negative counts", () => {
      const builder = StatUpdateBuilder.create()
      builder.addSuicides(0)
      builder.addSuicides(-3)
      expect(builder.hasUpdates()).toBe(false)
    })
  })

  // -------------------------------------------------------------------
  // addTeamkills
  // -------------------------------------------------------------------
  describe("addTeamkills", () => {
    it("should add teamkill increment", () => {
      const result = StatUpdateBuilder.create().addTeamkills(1).build()
      expect(result.teamkills).toEqual({ increment: 1 })
    })

    it("should use default count of 1", () => {
      const result = StatUpdateBuilder.create().addTeamkills().build()
      expect(result.teamkills).toEqual({ increment: 1 })
    })

    it("should ignore zero or negative counts", () => {
      const builder = StatUpdateBuilder.create()
      builder.addTeamkills(0)
      builder.addTeamkills(-2)
      expect(builder.hasUpdates()).toBe(false)
    })
  })

  // -------------------------------------------------------------------
  // addShots
  // -------------------------------------------------------------------
  describe("addShots", () => {
    it("should add shot increment", () => {
      const result = StatUpdateBuilder.create().addShots(10).build()
      expect(result.shots).toEqual({ increment: 10 })
    })

    it("should use default count of 1", () => {
      const result = StatUpdateBuilder.create().addShots().build()
      expect(result.shots).toEqual({ increment: 1 })
    })

    it("should ignore zero or negative counts", () => {
      const builder = StatUpdateBuilder.create()
      builder.addShots(0)
      builder.addShots(-5)
      expect(builder.hasUpdates()).toBe(false)
    })
  })

  // -------------------------------------------------------------------
  // addHits
  // -------------------------------------------------------------------
  describe("addHits", () => {
    it("should add hit increment", () => {
      const result = StatUpdateBuilder.create().addHits(7).build()
      expect(result.hits).toEqual({ increment: 7 })
    })

    it("should use default count of 1", () => {
      const result = StatUpdateBuilder.create().addHits().build()
      expect(result.hits).toEqual({ increment: 1 })
    })

    it("should ignore zero or negative counts", () => {
      const builder = StatUpdateBuilder.create()
      builder.addHits(0)
      builder.addHits(-1)
      expect(builder.hasUpdates()).toBe(false)
    })
  })

  // -------------------------------------------------------------------
  // addHeadshots
  // -------------------------------------------------------------------
  describe("addHeadshots", () => {
    it("should add headshot increment", () => {
      const result = StatUpdateBuilder.create().addHeadshots(3).build()
      expect(result.headshots).toEqual({ increment: 3 })
    })

    it("should use default count of 1", () => {
      const result = StatUpdateBuilder.create().addHeadshots().build()
      expect(result.headshots).toEqual({ increment: 1 })
    })

    it("should ignore zero or negative counts", () => {
      const builder = StatUpdateBuilder.create()
      builder.addHeadshots(0)
      builder.addHeadshots(-2)
      expect(builder.hasUpdates()).toBe(false)
    })
  })

  // -------------------------------------------------------------------
  // addConnectionTime
  // -------------------------------------------------------------------
  describe("addConnectionTime", () => {
    it("should add connection time increment", () => {
      const result = StatUpdateBuilder.create().addConnectionTime(300).build()
      expect(result.connectionTime).toEqual({ increment: 300 })
    })

    it("should ignore zero or negative values", () => {
      const builder = StatUpdateBuilder.create()
      builder.addConnectionTime(0)
      builder.addConnectionTime(-100)
      expect(builder.hasUpdates()).toBe(false)
    })
  })

  // -------------------------------------------------------------------
  // setDeathStreak
  // -------------------------------------------------------------------
  describe("setDeathStreak", () => {
    it("should set death streak value", () => {
      const result = StatUpdateBuilder.create().setDeathStreak(5).build()
      expect(result.deathStreak).toBe(5)
    })

    it("should enforce minimum value of 0", () => {
      const result = StatUpdateBuilder.create().setDeathStreak(-3).build()
      expect(result.deathStreak).toBe(0)
    })
  })

  // -------------------------------------------------------------------
  // updateLastEvent
  // -------------------------------------------------------------------
  describe("updateLastEvent", () => {
    it("should set last event to current date when no argument provided", () => {
      const before = new Date()
      const result = StatUpdateBuilder.create().updateLastEvent().build()
      expect(result.lastEvent).toBeInstanceOf(Date)
      expect((result.lastEvent as Date).getTime()).toBeGreaterThanOrEqual(before.getTime())
    })

    it("should use provided timestamp", () => {
      const specificDate = new Date("2023-06-15T12:00:00Z")
      const result = StatUpdateBuilder.create().updateLastEvent(specificDate).build()
      expect(result.lastEvent).toBe(specificDate)
    })
  })

  // -------------------------------------------------------------------
  // updateLastName
  // -------------------------------------------------------------------
  describe("updateLastName", () => {
    it("should set last name", () => {
      const result = StatUpdateBuilder.create().updateLastName("NewName").build()
      expect(result.lastName).toBe("NewName")
    })

    it("should trim the name", () => {
      const result = StatUpdateBuilder.create().updateLastName("  Trimmed  ").build()
      expect(result.lastName).toBe("Trimmed")
    })

    it("should ignore empty string", () => {
      const builder = StatUpdateBuilder.create()
      builder.updateLastName("")
      expect(builder.hasUpdates()).toBe(false)
    })

    it("should ignore whitespace-only string", () => {
      const builder = StatUpdateBuilder.create()
      builder.updateLastName("   ")
      expect(builder.hasUpdates()).toBe(false)
    })

    it("should ignore falsy values", () => {
      const builder = StatUpdateBuilder.create()
      builder.updateLastName(null as any)
      builder.updateLastName(undefined as any)
      expect(builder.hasUpdates()).toBe(false)
    })
  })

  // -------------------------------------------------------------------
  // updateGeoInfo - additional field coverage
  // -------------------------------------------------------------------
  describe("updateGeoInfo - additional branches", () => {
    it("should set flag field", () => {
      const result = StatUpdateBuilder.create().updateGeoInfo({ flag: "us" }).build()
      expect(result.flag).toBe("us")
    })

    it("should handle all fields together", () => {
      const result = StatUpdateBuilder.create()
        .updateGeoInfo({
          city: "Berlin",
          country: "DE",
          flag: "de",
          lat: 52.52,
          lng: 13.405,
          lastAddress: "10.0.0.1",
        })
        .build()

      expect(result.city).toBe("Berlin")
      expect(result.country).toBe("DE")
      expect(result.flag).toBe("de")
      expect(result.lat).toBe(52.52)
      expect(result.lng).toBe(13.405)
      expect(result.lastAddress).toBe("10.0.0.1")
    })

    it("should handle empty geo data object (no fields set)", () => {
      const builder = StatUpdateBuilder.create()
      builder.updateGeoInfo({})
      expect(builder.hasUpdates()).toBe(false)
    })

    it("should handle individual fields in isolation", () => {
      expect(StatUpdateBuilder.create().updateGeoInfo({ lat: 0 }).build().lat).toBe(0)
      expect(StatUpdateBuilder.create().updateGeoInfo({ lng: 0 }).build().lng).toBe(0)
      expect(
        StatUpdateBuilder.create().updateGeoInfo({ lastAddress: "1.2.3.4" }).build().lastAddress,
      ).toBe("1.2.3.4")
    })
  })

  // -------------------------------------------------------------------
  // addKills - default parameter
  // -------------------------------------------------------------------
  describe("addKills - default parameter", () => {
    it("should use default count of 1", () => {
      const result = StatUpdateBuilder.create().addKills().build()
      expect(result.kills).toEqual({ increment: 1 })
    })
  })

  // -------------------------------------------------------------------
  // buildAsStatsUpdate - comprehensive branch coverage
  // -------------------------------------------------------------------
  describe("buildAsStatsUpdate - comprehensive", () => {
    it("should map all increment operations", () => {
      const stats = StatUpdateBuilder.create()
        .addKills(2)
        .addDeaths(3)
        .addSuicides(1)
        .addTeamkills(1)
        .addSkillChange(10)
        .addShots(50)
        .addHits(25)
        .addHeadshots(5)
        .addConnectionTime(600)
        .buildAsStatsUpdate()

      expect(stats.kills).toBe(2)
      expect(stats.deaths).toBe(3)
      expect(stats.suicides).toBe(1)
      expect(stats.teamkills).toBe(1)
      expect(stats.skill).toBe(10)
      expect(stats.shots).toBe(50)
      expect(stats.hits).toBe(25)
      expect(stats.headshots).toBe(5)
      expect(stats.connectionTime).toBe(600)
    })

    it("should map direct value assignments", () => {
      const date = new Date("2024-01-01T00:00:00Z")
      const stats = StatUpdateBuilder.create()
        .setKillStreak(5)
        .setDeathStreak(2)
        .updateLastEvent(date)
        .updateLastName("TestPlayer")
        .buildAsStatsUpdate()

      expect(stats.killStreak).toBe(5)
      expect(stats.deathStreak).toBe(2)
      expect(stats.lastEvent).toBe(date)
      expect(stats.lastName).toBe("TestPlayer")
    })

    it("should not include fields that were not set", () => {
      const stats = StatUpdateBuilder.create().addKills(1).buildAsStatsUpdate()

      expect(stats.kills).toBe(1)
      expect(stats.deaths).toBeUndefined()
      expect(stats.suicides).toBeUndefined()
      expect(stats.teamkills).toBeUndefined()
      expect(stats.shots).toBeUndefined()
      expect(stats.hits).toBeUndefined()
      expect(stats.headshots).toBeUndefined()
      expect(stats.connectionTime).toBeUndefined()
      expect(stats.killStreak).toBeUndefined()
      expect(stats.deathStreak).toBeUndefined()
      expect(stats.lastEvent).toBeUndefined()
      expect(stats.lastName).toBeUndefined()
    })

    it("should handle killStreak=0 as a valid number", () => {
      const stats = StatUpdateBuilder.create().resetKillStreak().buildAsStatsUpdate()
      expect(stats.killStreak).toBe(0)
    })

    it("should handle deathStreak=0 as a valid number", () => {
      const stats = StatUpdateBuilder.create().resetDeathStreak().buildAsStatsUpdate()
      expect(stats.deathStreak).toBe(0)
    })

    it("should not include skill when skill change was 0 (ignored by addSkillChange)", () => {
      const stats = StatUpdateBuilder.create()
        .addSkillChange(0)
        .addKills(1) // Need at least one update to avoid empty build error
        .buildAsStatsUpdate()

      expect(stats.skill).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------
  // hasUpdates
  // -------------------------------------------------------------------
  describe("hasUpdates", () => {
    it("should return false for fresh builder", () => {
      expect(StatUpdateBuilder.create().hasUpdates()).toBe(false)
    })

    it("should return true after any update", () => {
      expect(StatUpdateBuilder.create().addKills(1).hasUpdates()).toBe(true)
      expect(StatUpdateBuilder.create().setKillStreak(0).hasUpdates()).toBe(true)
      expect(StatUpdateBuilder.create().updateLastEvent().hasUpdates()).toBe(true)
      expect(StatUpdateBuilder.create().updateLastName("N").hasUpdates()).toBe(true)
      expect(StatUpdateBuilder.create().updateGeoInfo({ city: "X" }).hasUpdates()).toBe(true)
    })
  })

  // -------------------------------------------------------------------
  // build - error
  // -------------------------------------------------------------------
  describe("build - error on empty", () => {
    it("should throw when no updates exist", () => {
      expect(() => StatUpdateBuilder.create().build()).toThrow("No updates specified")
    })

    it("should throw after clear", () => {
      const builder = StatUpdateBuilder.create().addKills(1)
      builder.clear()
      expect(() => builder.build()).toThrow("No updates specified")
    })
  })

  // -------------------------------------------------------------------
  // addSkillChange - additional
  // -------------------------------------------------------------------
  describe("addSkillChange - additional", () => {
    it("should set lastSkillChange date alongside skill increment", () => {
      const before = new Date()
      const result = StatUpdateBuilder.create().addSkillChange(5).build()
      expect(result.skill).toEqual({ increment: 5 })
      expect(result.lastSkillChange).toBeInstanceOf(Date)
      expect((result.lastSkillChange as Date).getTime()).toBeGreaterThanOrEqual(before.getTime())
    })
  })
})
