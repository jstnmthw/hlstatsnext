/**
 * Stat Update Builder
 *
 * Provides a fluent interface for building player statistics updates
 * with proper validation and type safety. Reduces cyclomatic complexity
 * by encapsulating conditional field building logic.
 */

import type { Player } from "@repo/database/client"
import type { PlayerStatsUpdate } from "@/modules/player/player.types"
import {
  validatePlayerStatsUpdate,
  sanitizePlayerStatsUpdate,
} from "@/shared/application/validators/player-stats.validator"

/**
 * Builder class for constructing player statistics updates
 */
export class StatUpdateBuilder {
  private updates: Record<string, unknown> = {}

  /**
   * Adds a kill increment to the update
   */
  addKills(count: number = 1): StatUpdateBuilder {
    if (count > 0) {
      this.updates.kills = { increment: count }
    }
    return this
  }

  /**
   * Adds a death increment to the update
   */
  addDeaths(count: number = 1): StatUpdateBuilder {
    if (count > 0) {
      this.updates.deaths = { increment: count }
    }
    return this
  }

  /**
   * Adds a suicide increment to the update
   */
  addSuicides(count: number = 1): StatUpdateBuilder {
    if (count > 0) {
      this.updates.suicides = { increment: count }
    }
    return this
  }

  /**
   * Adds a teamkill increment to the update
   */
  addTeamkills(count: number = 1): StatUpdateBuilder {
    if (count > 0) {
      this.updates.teamkills = { increment: count }
    }
    return this
  }

  /**
   * Adds a skill change (can be negative)
   */
  addSkillChange(change: number): StatUpdateBuilder {
    if (change !== 0) {
      this.updates.skill = { increment: change }
      this.updates.lastSkillChange = new Date()
    }
    return this
  }

  /**
   * Adds shot count increment
   */
  addShots(count: number = 1): StatUpdateBuilder {
    if (count > 0) {
      this.updates.shots = { increment: count }
    }
    return this
  }

  /**
   * Adds hit count increment
   */
  addHits(count: number = 1): StatUpdateBuilder {
    if (count > 0) {
      this.updates.hits = { increment: count }
    }
    return this
  }

  /**
   * Adds headshot increment
   */
  addHeadshots(count: number = 1): StatUpdateBuilder {
    if (count > 0) {
      this.updates.headshots = { increment: count }
    }
    return this
  }

  /**
   * Adds connection time increment
   */
  addConnectionTime(seconds: number): StatUpdateBuilder {
    if (seconds > 0) {
      this.updates.connectionTime = { increment: seconds }
    }
    return this
  }

  /**
   * Sets the kill streak value (direct value, not increment)
   */
  setKillStreak(streak: number): StatUpdateBuilder {
    this.updates.killStreak = Math.max(0, streak)
    return this
  }

  /**
   * Sets the death streak value (direct value, not increment)
   */
  setDeathStreak(streak: number): StatUpdateBuilder {
    this.updates.deathStreak = Math.max(0, streak)
    return this
  }

  /**
   * Updates the last event timestamp
   */
  updateLastEvent(timestamp: Date = new Date()): StatUpdateBuilder {
    this.updates.lastEvent = timestamp
    return this
  }

  /**
   * Updates the player's last known name
   */
  updateLastName(name: string): StatUpdateBuilder {
    if (name && name.trim().length > 0) {
      this.updates.lastName = name.trim()
    }
    return this
  }

  /**
   * Resets kill streak to 0 (typically on death)
   */
  resetKillStreak(): StatUpdateBuilder {
    this.updates.killStreak = 0
    return this
  }

  /**
   * Resets death streak to 0 (typically on kill)
   */
  resetDeathStreak(): StatUpdateBuilder {
    this.updates.deathStreak = 0
    return this
  }

  /**
   * Adds geographic information updates
   */
  updateGeoInfo(geoData: {
    city?: string
    country?: string
    flag?: string
    lat?: number
    lng?: number
    lastAddress?: string
  }): StatUpdateBuilder {
    if (geoData.city !== undefined) {
      this.updates.city = geoData.city
    }
    if (geoData.country !== undefined) {
      this.updates.country = geoData.country
    }
    if (geoData.flag !== undefined) {
      this.updates.flag = geoData.flag
    }
    if (geoData.lat !== undefined) {
      this.updates.lat = geoData.lat
    }
    if (geoData.lng !== undefined) {
      this.updates.lng = geoData.lng
    }
    if (geoData.lastAddress !== undefined) {
      this.updates.lastAddress = geoData.lastAddress
    }
    return this
  }

  /**
   * Builds the final update object with validation
   */
  build(): Partial<Player> {
    if (Object.keys(this.updates).length === 0) {
      throw new Error("No updates specified - use builder methods to add updates")
    }

    return this.updates as Partial<Player>
  }

  /**
   * Builds and validates as PlayerStatsUpdate type
   */
  buildAsStatsUpdate(): PlayerStatsUpdate {
    const statsUpdate: PlayerStatsUpdate = {}

    // Map increment operations to simple numbers for validation
    if (
      this.updates.kills &&
      typeof this.updates.kills === "object" &&
      "increment" in this.updates.kills
    ) {
      statsUpdate.kills = (this.updates.kills as { increment: number }).increment
    }
    if (
      this.updates.deaths &&
      typeof this.updates.deaths === "object" &&
      "increment" in this.updates.deaths
    ) {
      statsUpdate.deaths = (this.updates.deaths as { increment: number }).increment
    }
    if (
      this.updates.suicides &&
      typeof this.updates.suicides === "object" &&
      "increment" in this.updates.suicides
    ) {
      statsUpdate.suicides = (this.updates.suicides as { increment: number }).increment
    }
    if (
      this.updates.teamkills &&
      typeof this.updates.teamkills === "object" &&
      "increment" in this.updates.teamkills
    ) {
      statsUpdate.teamkills = (this.updates.teamkills as { increment: number }).increment
    }
    if (
      this.updates.skill &&
      typeof this.updates.skill === "object" &&
      "increment" in this.updates.skill
    ) {
      statsUpdate.skill = (this.updates.skill as { increment: number }).increment
    }
    if (
      this.updates.shots &&
      typeof this.updates.shots === "object" &&
      "increment" in this.updates.shots
    ) {
      statsUpdate.shots = (this.updates.shots as { increment: number }).increment
    }
    if (
      this.updates.hits &&
      typeof this.updates.hits === "object" &&
      "increment" in this.updates.hits
    ) {
      statsUpdate.hits = (this.updates.hits as { increment: number }).increment
    }
    if (
      this.updates.headshots &&
      typeof this.updates.headshots === "object" &&
      "increment" in this.updates.headshots
    ) {
      statsUpdate.headshots = (this.updates.headshots as { increment: number }).increment
    }
    if (
      this.updates.connectionTime &&
      typeof this.updates.connectionTime === "object" &&
      "increment" in this.updates.connectionTime
    ) {
      statsUpdate.connectionTime = (this.updates.connectionTime as { increment: number }).increment
    }

    // Direct value assignments
    if (typeof this.updates.killStreak === "number") {
      statsUpdate.killStreak = this.updates.killStreak
    }
    if (typeof this.updates.deathStreak === "number") {
      statsUpdate.deathStreak = this.updates.deathStreak
    }
    if (this.updates.lastEvent instanceof Date) {
      statsUpdate.lastEvent = this.updates.lastEvent
    }
    if (typeof this.updates.lastName === "string") {
      statsUpdate.lastName = this.updates.lastName
    }

    // Validate the stats update
    validatePlayerStatsUpdate(statsUpdate)

    return sanitizePlayerStatsUpdate(statsUpdate)
  }

  /**
   * Checks if any updates have been added
   */
  hasUpdates(): boolean {
    return Object.keys(this.updates).length > 0
  }

  /**
   * Clears all updates and returns a fresh builder
   */
  clear(): StatUpdateBuilder {
    this.updates = {}
    return this
  }

  /**
   * Creates a new builder instance
   */
  static create(): StatUpdateBuilder {
    return new StatUpdateBuilder()
  }
}
