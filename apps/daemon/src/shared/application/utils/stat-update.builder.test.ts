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
  })
})
