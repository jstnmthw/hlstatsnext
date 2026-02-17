/**
 * Ranking Service Integration Tests
 *
 * Tests skill calculation with real weapon modifiers from the database.
 */

import { GameConfig } from "@/config/game.config"
import { DatabaseClient } from "@/database/client"
import { RankingService } from "@/modules/ranking/ranking.service"
import type { SkillRating } from "@/modules/ranking/ranking.types"
import { WeaponRepository } from "@/modules/weapon/weapon.repository"
import type { ILogger } from "@/shared/utils/logger.types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTestDb } from "../helpers/test-db"

function makeRating(rating: number, gamesPlayed: number, playerId = 1): SkillRating {
  return { playerId, rating, confidence: 1, volatility: 0, gamesPlayed }
}

describe("RankingService (integration)", () => {
  let rankingService: RankingService
  let weaponRepo: WeaponRepository
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
    const db = new DatabaseClient()
    Object.defineProperty(db, "prisma", { get: () => testPrisma, configurable: true })
    db.transaction = (cb) => testPrisma.$transaction(cb)

    weaponRepo = new WeaponRepository(db, silentLogger)
    rankingService = new RankingService(silentLogger, weaponRepo, testPrisma as never)

    // Seed weapons with different modifiers
    await testPrisma.weapon.createMany({
      data: [
        { game, code: "ak47", name: "AK-47", modifier: 1.0, kills: 0, headshots: 0 },
        { game, code: "knife", name: "Knife", modifier: 2.0, kills: 0, headshots: 0 },
        { game, code: "awp", name: "AWP", modifier: 0.8, kills: 0, headshots: 0 },
      ],
      skipDuplicates: true,
    })
  })

  describe("calculateSkillAdjustment", () => {
    it("should calculate standard kill adjustment", async () => {
      const result = await rankingService.calculateSkillAdjustment(
        makeRating(1000, 50, 1),
        makeRating(1000, 50, 2),
        { weapon: "ak47", headshot: false, killerTeam: "CT", victimTeam: "TERRORIST" },
      )

      expect(result.killerChange).toBeGreaterThan(0)
      expect(result.victimChange).toBeLessThan(0)
      // Victim loses ~80% of what killer gains
      expect(Math.abs(result.victimChange)).toBeLessThan(Math.abs(result.killerChange))
    })

    it("should give higher reward for knife kills (modifier 2.0)", async () => {
      const knifeResult = await rankingService.calculateSkillAdjustment(
        makeRating(1000, 50, 1),
        makeRating(1000, 50, 2),
        { weapon: "knife", headshot: false, killerTeam: "CT", victimTeam: "TERRORIST" },
      )

      const ak47Result = await rankingService.calculateSkillAdjustment(
        makeRating(1000, 50, 1),
        makeRating(1000, 50, 2),
        { weapon: "ak47", headshot: false, killerTeam: "CT", victimTeam: "TERRORIST" },
      )

      // Knife modifier (2.0) should yield higher reward than AK-47 (1.0)
      expect(knifeResult.killerChange).toBeGreaterThan(ak47Result.killerChange)
    })

    it("should apply headshot bonus", async () => {
      const noHeadshot = await rankingService.calculateSkillAdjustment(
        makeRating(1000, 50, 1),
        makeRating(1000, 50, 2),
        { weapon: "ak47", headshot: false, killerTeam: "CT", victimTeam: "TERRORIST" },
      )

      const headshot = await rankingService.calculateSkillAdjustment(
        makeRating(1000, 50, 1),
        makeRating(1000, 50, 2),
        { weapon: "ak47", headshot: true, killerTeam: "CT", victimTeam: "TERRORIST" },
      )

      expect(headshot.killerChange).toBeGreaterThan(noHeadshot.killerChange)
    })

    it("should penalize team kills", async () => {
      const result = await rankingService.calculateSkillAdjustment(
        makeRating(1000, 50, 1),
        makeRating(1000, 50, 2),
        { weapon: "ak47", headshot: false, killerTeam: "CT", victimTeam: "CT" }, // same team
      )

      expect(result.killerChange).toBeLessThan(0) // penalty
      expect(result.victimChange).toBeGreaterThan(0) // compensation
    })

    it("should use default modifier for unknown weapons", async () => {
      const result = await rankingService.calculateSkillAdjustment(
        makeRating(1000, 50, 1),
        makeRating(1000, 50, 2),
        {
          weapon: "unknown_weapon_xyz",
          headshot: false,
          killerTeam: "CT",
          victimTeam: "TERRORIST",
        },
      )

      // Should still calculate (using default modifier 1.0)
      expect(result.killerChange).toBeGreaterThan(0)
    })
  })

  describe("calculateSuicidePenalty", () => {
    it("should return a negative penalty", () => {
      const penalty = rankingService.calculateSuicidePenalty()
      expect(penalty).toBeLessThan(0)
      expect(penalty).toBe(-5)
    })
  })

  describe("calculateTeamkillPenalty", () => {
    it("should return double the suicide penalty", () => {
      const penalty = rankingService.calculateTeamkillPenalty()
      expect(penalty).toBe(-10)
    })
  })

  describe("calculateRatingAdjustment", () => {
    it("should calculate standard ELO for win/loss", async () => {
      const result = await rankingService.calculateRatingAdjustment(
        makeRating(1000, 50, 1),
        makeRating(1000, 50, 2),
      )

      expect(result.winner).toBeGreaterThan(0)
      expect(result.loser).toBeLessThan(0)
    })

    it("should give lower-rated winner more points", async () => {
      const upset = await rankingService.calculateRatingAdjustment(
        makeRating(800, 50, 1), // underdog wins
        makeRating(1200, 50, 2),
      )

      const expected = await rankingService.calculateRatingAdjustment(
        makeRating(1200, 50, 1), // favorite wins
        makeRating(800, 50, 2),
      )

      // Underdog winning should yield more points
      expect(upset.winner).toBeGreaterThan(expected.winner)
    })
  })
})
