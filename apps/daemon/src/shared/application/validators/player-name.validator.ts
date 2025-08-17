/**
 * Player Name Validation Utilities
 *
 * Provides validation functions for player name operations and alias management.
 */

import type { PlayerNameStatsUpdate } from "@/modules/player/player.types"

/**
 * Validates that a player name meets basic requirements
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
 * Validates player ID for name operations
 */
export function validatePlayerId(playerId: number): boolean {
  if (!Number.isInteger(playerId) || playerId <= 0) {
    throw new Error("Player ID must be a positive integer")
  }

  return true
}

/**
 * Validates usage count values for player names
 */
export function validateUsageCount(count: number, fieldName: string): boolean {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`)
  }

  if (count > 100000) {
    throw new Error(`${fieldName} value ${count} exceeds maximum allowed (100,000)`)
  }

  return true
}

/**
 * Validates connection time for player name stats
 */
export function validateNameConnectionTime(connectionTime: number): boolean {
  if (!Number.isInteger(connectionTime) || connectionTime < 0) {
    throw new Error("Connection time must be a non-negative integer")
  }

  // 365 days in seconds (more lenient for accumulated time per alias)
  const MAX_CONNECTION_TIME = 365 * 24 * 60 * 60
  if (connectionTime > MAX_CONNECTION_TIME) {
    throw new Error(`Connection time ${connectionTime} exceeds maximum allowed (365 days)`)
  }

  return true
}

/**
 * Validates kill/death/suicide stats for player names
 */
export function validateNameStatValue(value: number, fieldName: string): boolean {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`)
  }

  if (value > 1000000) {
    throw new Error(`${fieldName} value ${value} exceeds maximum allowed (1,000,000)`)
  }

  return true
}

/**
 * Validates shot/hit stats for player names
 */
export function validateNameShotStats(value: number, fieldName: string): boolean {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`)
  }

  if (value > 10000000) {
    throw new Error(`${fieldName} value ${value} exceeds maximum allowed (10,000,000)`)
  }

  return true
}

/**
 * Comprehensive validation for player name stats update objects
 */
export function validatePlayerNameStatsUpdate(updates: PlayerNameStatsUpdate): boolean {
  // Validate usage counts
  if (updates.numUses !== undefined) {
    validateUsageCount(updates.numUses, "numUses")
  }

  // Validate connection time
  if (updates.connectionTime !== undefined) {
    validateNameConnectionTime(updates.connectionTime)
  }

  // Validate kill/death/suicide stats
  if (updates.kills !== undefined) {
    validateNameStatValue(updates.kills, "kills")
  }

  if (updates.deaths !== undefined) {
    validateNameStatValue(updates.deaths, "deaths")
  }

  if (updates.suicides !== undefined) {
    validateNameStatValue(updates.suicides, "suicides")
  }

  if (updates.headshots !== undefined) {
    validateNameStatValue(updates.headshots, "headshots")
  }

  // Validate shot/hit stats
  if (updates.shots !== undefined) {
    validateNameShotStats(updates.shots, "shots")
  }

  if (updates.hits !== undefined) {
    validateNameShotStats(updates.hits, "hits")
  }

  // Validate timestamp
  if (updates.lastUse !== undefined && !(updates.lastUse instanceof Date)) {
    throw new Error("lastUse must be a Date object")
  }

  return true
}

/**
 * Sanitizes and normalizes a player name stats update object
 */
export function sanitizePlayerNameStatsUpdate(updates: PlayerNameStatsUpdate): PlayerNameStatsUpdate {
  const sanitized: PlayerNameStatsUpdate = {}

  // Copy and validate numeric fields
  const numericFields = [
    "numUses",
    "connectionTime",
    "kills",
    "deaths",
    "suicides",
    "shots",
    "hits",
    "headshots",
  ] as const

  for (const field of numericFields) {
    if (updates[field] !== undefined) {
      const value = Math.floor(Number(updates[field]))
      if (!isNaN(value) && value >= 0) {
        sanitized[field] = value
      }
    }
  }

  // Handle timestamp
  if (updates.lastUse !== undefined) {
    sanitized.lastUse = updates.lastUse instanceof Date ? updates.lastUse : new Date()
  }

  return sanitized
}

/**
 * Sanitizes a player name string
 */
export function sanitizePlayerName(name: string): string {
  if (!name || typeof name !== "string") {
    return ""
  }

  return name
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "") // Remove control characters
    .substring(0, 64) // Enforce max length
}