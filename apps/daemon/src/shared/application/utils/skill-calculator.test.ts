/**
 * Skill Calculator Unit Tests
 *
 * Comprehensive tests for all skill calculation formulas.
 * These tests ensure mathematical correctness and edge case handling.
 */

import { describe, expect, it } from "vitest"
import {
  applyKillModifiers,
  applyRatingBounds,
  calculateBaseRatingChange,
  calculateExpectedScore,
  calculateKillSkillAdjustment,
  calculateStandardRatingAdjustment,
  calculateSuicidePenalty,
  calculateTeamKillPenalty,
  getKFactor,
  validateSkillConfig,
  type KillContextInput,
  type SkillCalculationConfig,
  type SkillRatingInput,
} from "./skill-calculator"

describe("Skill Calculator", () => {
  describe("calculateExpectedScore", () => {
    it("should calculate 50% expected score for equal ratings", () => {
      const score = calculateExpectedScore(1500, 1500)
      expect(score).toBe(0.5)
    })

    it("should calculate higher expected score for lower rated player", () => {
      const score = calculateExpectedScore(1200, 1800)
      expect(score).toBeLessThan(0.5)
      // Expected score for 600 rating difference: 1 / (1 + 10^(600/400)) = 0.0307
      expect(score).toBeCloseTo(0.0307, 3)
    })

    it("should calculate lower expected score for higher rated player", () => {
      const score = calculateExpectedScore(1800, 1200)
      expect(score).toBeGreaterThan(0.5)
      // Expected score for -600 rating difference: 1 / (1 + 10^(-600/400)) = 0.9693
      expect(score).toBeCloseTo(0.9693, 3)
    })

    it("should handle extreme rating differences", () => {
      const veryLow = calculateExpectedScore(100, 3000)
      expect(veryLow).toBeCloseTo(0, 3)

      const veryHigh = calculateExpectedScore(3000, 100)
      expect(veryHigh).toBeCloseTo(1, 3)
    })

    it("should use custom volatility divisor", () => {
      const defaultScore = calculateExpectedScore(1500, 1700, 400)
      const customScore = calculateExpectedScore(1500, 1700, 200)

      expect(customScore).toBeLessThan(defaultScore)
    })
  })

  describe("getKFactor", () => {
    it("should apply 1.5x multiplier for new players", () => {
      const kFactor = getKFactor(5, 1000)
      expect(kFactor).toBe(48) // 32 * 1.5
    })

    it("should apply 1.2x multiplier for learning players", () => {
      const kFactor = getKFactor(25, 1000)
      expect(kFactor).toBe(38.4) // 32 * 1.2
    })

    it("should apply 0.8x multiplier for elite players", () => {
      const kFactor = getKFactor(200, 2200)
      expect(kFactor).toBe(25.6) // 32 * 0.8
    })

    it("should use base K-factor for experienced players", () => {
      const kFactor = getKFactor(75, 1500)
      expect(kFactor).toBe(32)
    })

    it("should respect custom configuration", () => {
      const config: Partial<SkillCalculationConfig> = {
        baseKFactor: 40,
        kFactorNewPlayerMultiplier: 2.0,
        newPlayerGamesThreshold: 20,
      }

      const kFactor = getKFactor(15, 1000, config)
      expect(kFactor).toBe(80) // 40 * 2.0
    })

    it("should prioritize experience over rating for K-factor", () => {
      // High rated but new player should get new player multiplier
      const newElite = getKFactor(5, 2500)
      expect(newElite).toBe(48) // New player multiplier applies

      // Low rated but experienced player should get base K-factor
      const experiencedLow = getKFactor(100, 800)
      expect(experiencedLow).toBe(32) // Base K-factor
    })
  })

  describe("applyRatingBounds", () => {
    it("should allow changes within bounds", () => {
      const change = applyRatingBounds(1500, 50)
      expect(change).toBe(50)

      const negativeChange = applyRatingBounds(1500, -50)
      expect(negativeChange).toBe(-50)
    })

    it("should prevent rating from going below minimum", () => {
      const change = applyRatingBounds(150, -100)
      expect(change).toBe(-50) // Should only go down to 100

      const atMin = applyRatingBounds(100, -50)
      expect(atMin).toBe(0) // Already at minimum
    })

    it("should prevent rating from going above maximum", () => {
      const change = applyRatingBounds(2950, 100)
      expect(change).toBe(50) // Should only go up to 3000

      const atMax = applyRatingBounds(3000, 50)
      expect(atMax).toBe(0) // Already at maximum
    })

    it("should respect custom bounds", () => {
      const change = applyRatingBounds(450, -100, 400, 500)
      expect(change).toBe(-50) // Should only go down to 400

      const upChange = applyRatingBounds(480, 50, 400, 500)
      expect(upChange).toBe(20) // Should only go up to 500
    })
  })

  describe("calculateBaseRatingChange", () => {
    it("should calculate correct change for win", () => {
      const change = calculateBaseRatingChange(0.5, 32, 1)
      expect(change).toBe(16) // 32 * (1 - 0.5)
    })

    it("should calculate correct change for loss", () => {
      const change = calculateBaseRatingChange(0.5, 32, 0)
      expect(change).toBe(-16) // 32 * (0 - 0.5)
    })

    it("should give larger gains for unexpected wins", () => {
      const change = calculateBaseRatingChange(0.1, 32, 1)
      expect(change).toBeCloseTo(28.8) // 32 * (1 - 0.1)
    })

    it("should give smaller gains for expected wins", () => {
      const change = calculateBaseRatingChange(0.9, 32, 1)
      expect(change).toBeCloseTo(3.2) // 32 * (1 - 0.9)
    })
  })

  describe("applyKillModifiers", () => {
    it("should apply weapon modifier", () => {
      const context: KillContextInput = {
        weapon: "awp",
        weaponModifier: 1.4,
        headshot: false,
        isTeamKill: false,
      }

      const modified = applyKillModifiers(20, context)
      expect(modified).toBe(28) // 20 * 1.4
    })

    it("should apply headshot bonus", () => {
      const context: KillContextInput = {
        weapon: "ak47",
        weaponModifier: 1.0,
        headshot: true,
        isTeamKill: false,
      }

      const modified = applyKillModifiers(20, context)
      expect(modified).toBe(24) // 20 * 1.0 * 1.2
    })

    it("should apply both weapon and headshot modifiers", () => {
      const context: KillContextInput = {
        weapon: "awp",
        weaponModifier: 1.4,
        headshot: true,
        isTeamKill: false,
      }

      const modified = applyKillModifiers(20, context)
      expect(modified).toBe(33.6) // 20 * 1.4 * 1.2
    })

    it("should cap at maximum skill change", () => {
      const context: KillContextInput = {
        weapon: "knife",
        weaponModifier: 3.0,
        headshot: true,
        isTeamKill: false,
      }

      const modified = applyKillModifiers(40, context)
      expect(modified).toBe(50) // Capped at max
    })

    it("should respect custom configuration", () => {
      const context: KillContextInput = {
        weapon: "pistol",
        weaponModifier: 1.5,
        headshot: true,
        isTeamKill: false,
      }

      const config: Partial<SkillCalculationConfig> = {
        headshotBonus: 1.5,
        maxSkillChange: 30,
      }

      const modified = applyKillModifiers(20, context, config)
      expect(modified).toBe(30) // 20 * 1.5 * 1.5 = 45, capped at 30
    })
  })

  describe("calculateKillSkillAdjustment", () => {
    it("should calculate adjustment for equal skill kill", () => {
      const killer: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }
      const victim: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }
      const context: KillContextInput = {
        weapon: "ak47",
        weaponModifier: 1.0,
        headshot: false,
        isTeamKill: false,
      }

      const adjustment = calculateKillSkillAdjustment(killer, victim, context)
      expect(adjustment.killerChange).toBe(16) // Base case
      expect(adjustment.victimChange).toBe(-13) // 80% of killer's gain
    })

    it("should give smaller reward for killing lower skilled player", () => {
      const killer: SkillRatingInput = { rating: 1800, gamesPlayed: 100 }
      const victim: SkillRatingInput = { rating: 1200, gamesPlayed: 50 }
      const context: KillContextInput = {
        weapon: "ak47",
        weaponModifier: 1.0,
        headshot: false,
        isTeamKill: false,
      }

      const adjustment = calculateKillSkillAdjustment(killer, victim, context)
      expect(adjustment.killerChange).toBeLessThan(10)
      expect(adjustment.victimChange).toBeGreaterThan(-10)
    })

    it("should give larger reward for killing higher skilled player", () => {
      const killer: SkillRatingInput = { rating: 1200, gamesPlayed: 50 }
      const victim: SkillRatingInput = { rating: 1800, gamesPlayed: 100 }
      const context: KillContextInput = {
        weapon: "ak47",
        weaponModifier: 1.0,
        headshot: false,
        isTeamKill: false,
      }

      const adjustment = calculateKillSkillAdjustment(killer, victim, context)
      expect(adjustment.killerChange).toBeGreaterThan(25)
      expect(adjustment.victimChange).toBeLessThan(-20)
    })

    it("should apply weapon modifier correctly", () => {
      const killer: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }
      const victim: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }
      const context: KillContextInput = {
        weapon: "awp",
        weaponModifier: 1.4,
        headshot: false,
        isTeamKill: false,
      }

      const adjustment = calculateKillSkillAdjustment(killer, victim, context)
      expect(adjustment.killerChange).toBe(22) // 16 * 1.4
      expect(adjustment.victimChange).toBe(-18) // -22 * 0.8
    })

    it("should apply headshot bonus", () => {
      const killer: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }
      const victim: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }
      const context: KillContextInput = {
        weapon: "ak47",
        weaponModifier: 1.0,
        headshot: true,
        isTeamKill: false,
      }

      const adjustment = calculateKillSkillAdjustment(killer, victim, context)
      expect(adjustment.killerChange).toBe(19) // 16 * 1.2
      expect(adjustment.victimChange).toBe(-15) // -19 * 0.8
    })

    it("should handle team kills", () => {
      const killer: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }
      const victim: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }
      const context: KillContextInput = {
        weapon: "ak47",
        weaponModifier: 1.0,
        headshot: false,
        isTeamKill: true,
      }

      const adjustment = calculateKillSkillAdjustment(killer, victim, context)
      expect(adjustment.killerChange).toBe(-10) // Penalty
      expect(adjustment.victimChange).toBe(2) // Compensation
    })

    it("should apply new player K-factor", () => {
      const killer: SkillRatingInput = { rating: 1000, gamesPlayed: 5 }
      const victim: SkillRatingInput = { rating: 1000, gamesPlayed: 100 }
      const context: KillContextInput = {
        weapon: "ak47",
        weaponModifier: 1.0,
        headshot: false,
        isTeamKill: false,
      }

      const adjustment = calculateKillSkillAdjustment(killer, victim, context)
      expect(adjustment.killerChange).toBe(24) // 48 * 0.5
      expect(adjustment.victimChange).toBe(-19) // -24 * 0.8
    })

    it("should cap at maximum skill change", () => {
      const killer: SkillRatingInput = { rating: 800, gamesPlayed: 5 }
      const victim: SkillRatingInput = { rating: 2500, gamesPlayed: 500 }
      const context: KillContextInput = {
        weapon: "knife",
        weaponModifier: 3.0,
        headshot: false,
        isTeamKill: false,
      }

      const adjustment = calculateKillSkillAdjustment(killer, victim, context)
      expect(adjustment.killerChange).toBe(50) // Capped
      expect(adjustment.victimChange).toBe(-40) // -50 * 0.8
    })

    it("should respect rating bounds", () => {
      const killer: SkillRatingInput = { rating: 2990, gamesPlayed: 500 }
      const victim: SkillRatingInput = { rating: 105, gamesPlayed: 5 }
      const context: KillContextInput = {
        weapon: "ak47",
        weaponModifier: 1.0,
        headshot: false,
        isTeamKill: false,
      }

      const adjustment = calculateKillSkillAdjustment(killer, victim, context)

      // Killer shouldn't exceed 3000
      expect(killer.rating + adjustment.killerChange).toBeLessThanOrEqual(3000)

      // Victim shouldn't go below 100
      expect(victim.rating + adjustment.victimChange).toBeGreaterThanOrEqual(100)
    })
  })

  describe("calculateStandardRatingAdjustment", () => {
    it("should calculate adjustment for equal ratings", () => {
      const winner: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }
      const loser: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }

      const adjustment = calculateStandardRatingAdjustment(winner, loser)
      expect(adjustment.winner).toBe(16)
      expect(adjustment.loser).toBe(-13)
    })

    it("should give smaller adjustment when favorite wins", () => {
      const winner: SkillRatingInput = { rating: 1800, gamesPlayed: 100 }
      const loser: SkillRatingInput = { rating: 1200, gamesPlayed: 50 }

      const adjustment = calculateStandardRatingAdjustment(winner, loser)
      expect(adjustment.winner).toBeLessThan(8)
      expect(adjustment.loser).toBeGreaterThan(-7)
    })

    it("should give larger adjustment when underdog wins", () => {
      const winner: SkillRatingInput = { rating: 1200, gamesPlayed: 50 }
      const loser: SkillRatingInput = { rating: 1800, gamesPlayed: 100 }

      const adjustment = calculateStandardRatingAdjustment(winner, loser)
      expect(adjustment.winner).toBeGreaterThan(25)
      expect(adjustment.loser).toBeLessThan(-20)
    })

    it("should apply experience-based K-factors", () => {
      const newWinner: SkillRatingInput = { rating: 1000, gamesPlayed: 5 }
      const expLoser: SkillRatingInput = { rating: 1000, gamesPlayed: 100 }

      const adjustment = calculateStandardRatingAdjustment(newWinner, expLoser)
      expect(adjustment.winner).toBe(24) // 48 * 0.5 for new player
      expect(adjustment.loser).toBe(-19)
    })

    it("should respect custom configuration", () => {
      const winner: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }
      const loser: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }

      const config: Partial<SkillCalculationConfig> = {
        baseKFactor: 40,
        victimLossRatio: 0.5,
      }

      const adjustment = calculateStandardRatingAdjustment(winner, loser, config)
      expect(adjustment.winner).toBe(20) // 40 * 0.5
      expect(adjustment.loser).toBe(-10) // -20 * 0.5
    })
  })

  describe("calculateSuicidePenalty", () => {
    it("should return default suicide penalty", () => {
      const penalty = calculateSuicidePenalty()
      expect(penalty).toBe(-5)
    })

    it("should respect custom configuration", () => {
      const config: Partial<SkillCalculationConfig> = {
        suicidePenalty: -10,
      }

      const penalty = calculateSuicidePenalty(config)
      expect(penalty).toBe(-10)
    })
  })

  describe("calculateTeamKillPenalty", () => {
    it("should return default team kill penalties", () => {
      const penalties = calculateTeamKillPenalty()
      expect(penalties.killerChange).toBe(-10)
      expect(penalties.victimChange).toBe(2)
    })

    it("should respect custom configuration", () => {
      const config: Partial<SkillCalculationConfig> = {
        teamKillPenalty: -15,
        teamKillVictimCompensation: 5,
      }

      const penalties = calculateTeamKillPenalty(config)
      expect(penalties.killerChange).toBe(-15)
      expect(penalties.victimChange).toBe(5)
    })
  })

  describe("validateSkillConfig", () => {
    it("should validate default configuration", () => {
      expect(() => validateSkillConfig({})).not.toThrow()
    })

    it("should accept valid custom configuration", () => {
      const config: Partial<SkillCalculationConfig> = {
        minRating: 0,
        maxRating: 5000,
        baseKFactor: 50,
        victimLossRatio: 0.6,
      }

      expect(() => validateSkillConfig(config)).not.toThrow()
    })

    it("should reject invalid rating bounds", () => {
      const config: Partial<SkillCalculationConfig> = {
        minRating: 2000,
        maxRating: 1000,
      }

      expect(() => validateSkillConfig(config)).toThrow("minRating must be less than maxRating")
    })

    it("should reject negative maxSkillChange", () => {
      const config: Partial<SkillCalculationConfig> = {
        maxSkillChange: -10,
      }

      expect(() => validateSkillConfig(config)).toThrow("maxSkillChange must be positive")
    })

    it("should reject invalid victimLossRatio", () => {
      const config1: Partial<SkillCalculationConfig> = {
        victimLossRatio: -0.5,
      }

      expect(() => validateSkillConfig(config1)).toThrow("victimLossRatio must be between 0 and 1")

      const config2: Partial<SkillCalculationConfig> = {
        victimLossRatio: 1.5,
      }

      expect(() => validateSkillConfig(config2)).toThrow("victimLossRatio must be between 0 and 1")
    })

    it("should reject invalid headshotBonus", () => {
      const config: Partial<SkillCalculationConfig> = {
        headshotBonus: 0.8,
      }

      expect(() => validateSkillConfig(config)).toThrow("headshotBonus must be at least 1")
    })
  })

  describe("Mathematical Properties", () => {
    it("should maintain ELO zero-sum property (adjusted for victimLossRatio)", () => {
      const ratings: SkillRatingInput[] = [
        { rating: 1000, gamesPlayed: 50 },
        { rating: 1500, gamesPlayed: 50 },
        { rating: 2000, gamesPlayed: 50 },
      ]

      for (const winner of ratings) {
        for (const loser of ratings) {
          if (winner === loser) continue

          const adjustment = calculateStandardRatingAdjustment(winner, loser)

          // Total change should be negative due to victimLossRatio < 1
          // or small positive due to rating bounds
          if (adjustment.winner > 0) {
            // The ratio should approximately match victimLossRatio when not bounded
            const ratio = Math.abs(adjustment.loser) / adjustment.winner
            // Allow some variance due to rounding and bounds
            expect(ratio).toBeLessThanOrEqual(1.0)
          }
        }
      }
    })

    it("should be monotonic with respect to rating difference", () => {
      const baseRating = 1500
      const opponent = { rating: baseRating, gamesPlayed: 50 }

      let previousGain = Infinity

      for (let killerRating = 1000; killerRating <= 2000; killerRating += 100) {
        const killer: SkillRatingInput = { rating: killerRating, gamesPlayed: 50 }
        const context: KillContextInput = {
          weapon: "ak47",
          weaponModifier: 1.0,
          headshot: false,
          isTeamKill: false,
        }

        const adjustment = calculateKillSkillAdjustment(killer, opponent, context)

        // As killer rating increases, gain should decrease
        expect(adjustment.killerChange).toBeLessThanOrEqual(previousGain)
        previousGain = adjustment.killerChange
      }
    })

    it("should handle floating point precision correctly", () => {
      const killer: SkillRatingInput = { rating: 1547.3, gamesPlayed: 87 }
      const victim: SkillRatingInput = { rating: 1423.7, gamesPlayed: 64 }
      const context: KillContextInput = {
        weapon: "weapon",
        weaponModifier: 1.234,
        headshot: true,
        isTeamKill: false,
      }

      const adjustment = calculateKillSkillAdjustment(killer, victim, context)

      expect(Number.isInteger(adjustment.killerChange)).toBe(true)
      expect(Number.isInteger(adjustment.victimChange)).toBe(true)
      expect(Number.isFinite(adjustment.killerChange)).toBe(true)
      expect(Number.isFinite(adjustment.victimChange)).toBe(true)
    })
  })

  describe("Edge Cases", () => {
    it("should handle zero games played", () => {
      const killer: SkillRatingInput = { rating: 1000, gamesPlayed: 0 }
      const victim: SkillRatingInput = { rating: 1000, gamesPlayed: 0 }
      const context: KillContextInput = {
        weapon: "ak47",
        weaponModifier: 1.0,
        headshot: false,
        isTeamKill: false,
      }

      const adjustment = calculateKillSkillAdjustment(killer, victim, context)

      expect(adjustment.killerChange).toBe(24) // New player multiplier
      expect(adjustment.victimChange).toBe(-19)
    })

    it("should handle extreme weapon modifiers", () => {
      const killer: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }
      const victim: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }
      const context: KillContextInput = {
        weapon: "super_weapon",
        weaponModifier: 10.0,
        headshot: true,
        isTeamKill: false,
      }

      const adjustment = calculateKillSkillAdjustment(killer, victim, context)

      expect(adjustment.killerChange).toBe(50) // Should be capped
      expect(adjustment.victimChange).toBe(-40)
    })

    it("should handle negative weapon modifiers gracefully", () => {
      const killer: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }
      const victim: SkillRatingInput = { rating: 1500, gamesPlayed: 50 }
      const context: KillContextInput = {
        weapon: "negative",
        weaponModifier: -1.0,
        headshot: false,
        isTeamKill: false,
      }

      const adjustment = calculateKillSkillAdjustment(killer, victim, context)

      // Should still produce a result, even if negative
      expect(Number.isFinite(adjustment.killerChange)).toBe(true)
      expect(Number.isFinite(adjustment.victimChange)).toBe(true)
    })
  })
})
