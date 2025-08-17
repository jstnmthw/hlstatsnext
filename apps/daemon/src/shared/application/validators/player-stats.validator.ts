/**
 * Player Statistics Validation Utilities
 *
 * Provides validation functions for player statistics updates to ensure
 * data integrity and prevent invalid stat modifications.
 */

import type { PlayerStatsUpdate } from "@/modules/player/player.types"

/**
 * Validates that a numeric stat update value is within acceptable bounds
 */
export function validateStatValue(value: number, fieldName: string): boolean {
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer`)
  }

  if (value < -1000 || value > 10000) {
    throw new Error(`${fieldName} value ${value} is outside acceptable range (-1000 to 10000)`)
  }

  return true
}

/**
 * Validates skill rating updates to prevent extreme changes
 */
export function validateSkillChange(skillChange: number): boolean {
  if (!Number.isInteger(skillChange)) {
    throw new Error("Skill change must be an integer")
  }

  if (skillChange < -100 || skillChange > 100) {
    throw new Error(`Skill change ${skillChange} is too extreme (max ±100 per event)`)
  }

  return true
}

/**
 * Validates streak values to ensure they remain non-negative
 */
export function validateStreakValue(streak: number, fieldName: string): boolean {
  if (!Number.isInteger(streak) || streak < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`)
  }

  if (streak > 500) {
    throw new Error(`${fieldName} value ${streak} exceeds maximum allowed (500)`)
  }

  return true
}

/**
 * Validates connection time to ensure reasonable values
 */
export function validateConnectionTime(connectionTime: number): boolean {
  if (!Number.isInteger(connectionTime) || connectionTime < 0) {
    throw new Error("Connection time must be a non-negative integer")
  }

  // 30 days in seconds
  const MAX_CONNECTION_TIME = 30 * 24 * 60 * 60
  if (connectionTime > MAX_CONNECTION_TIME) {
    throw new Error(`Connection time ${connectionTime} exceeds maximum allowed (30 days)`)
  }

  return true
}

/**
 * Validates player name updates
 */
export function validatePlayerName(name: string): boolean {
  if (!name || typeof name !== "string") {
    throw new Error("Player name must be a non-empty string")
  }

  if (name.length < 1 || name.length > 64) {
    throw new Error("Player name must be between 1 and 64 characters")
  }

  // Check for basic sanitization - no control characters
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(name)) {
    throw new Error("Player name contains invalid control characters")
  }

  return true
}

/**
 * Comprehensive validation for player stats update objects
 */
export function validatePlayerStatsUpdate(updates: PlayerStatsUpdate): boolean {
  // Validate numeric stat fields
  if (updates.kills !== undefined) {
    validateStatValue(updates.kills, "kills")
  }

  if (updates.deaths !== undefined) {
    validateStatValue(updates.deaths, "deaths")
  }

  if (updates.suicides !== undefined) {
    validateStatValue(updates.suicides, "suicides")
  }

  if (updates.teamkills !== undefined) {
    validateStatValue(updates.teamkills, "teamkills")
  }

  if (updates.headshots !== undefined) {
    validateStatValue(updates.headshots, "headshots")
  }

  if (updates.shots !== undefined) {
    validateStatValue(updates.shots, "shots")
  }

  if (updates.hits !== undefined) {
    validateStatValue(updates.hits, "hits")
  }

  // Validate skill changes
  if (updates.skill !== undefined) {
    validateSkillChange(updates.skill)
  }

  // Validate streak values
  if (updates.killStreak !== undefined) {
    validateStreakValue(updates.killStreak, "killStreak")
  }

  if (updates.deathStreak !== undefined) {
    validateStreakValue(updates.deathStreak, "deathStreak")
  }

  // Validate connection time
  if (updates.connectionTime !== undefined) {
    validateConnectionTime(updates.connectionTime)
  }

  // Validate player name
  if (updates.lastName !== undefined) {
    validatePlayerName(updates.lastName)
  }

  // Validate timestamp
  if (updates.lastEvent !== undefined && !(updates.lastEvent instanceof Date)) {
    throw new Error("lastEvent must be a Date object")
  }

  return true
}

/**
 * Sanitizes and normalizes a player stats update object
 */
export function sanitizePlayerStatsUpdate(updates: PlayerStatsUpdate): PlayerStatsUpdate {
  const sanitized: PlayerStatsUpdate = {}

  // Copy and validate numeric fields
  const numericFields = [
    "kills",
    "deaths", 
    "suicides",
    "teamkills",
    "headshots",
    "shots",
    "hits",
    "skill",
    "killStreak",
    "deathStreak",
    "connectionTime",
  ] as const

  for (const field of numericFields) {
    if (updates[field] !== undefined) {
      const value = Math.floor(Number(updates[field]))
      if (!isNaN(value)) {
        sanitized[field] = value
      }
    }
  }

  // Handle player name
  if (updates.lastName !== undefined && typeof updates.lastName === "string") {
    sanitized.lastName = updates.lastName.trim()
  }

  // Handle timestamp
  if (updates.lastEvent !== undefined) {
    sanitized.lastEvent = updates.lastEvent instanceof Date ? updates.lastEvent : new Date()
  }

  return sanitized
}